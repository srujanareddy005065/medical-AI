import { useState, useEffect } from 'react'
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from '@clerk/clerk-react'
import { formatTimestamp, getConfidenceColor, getRiskColor } from './historyLoader'
import { loadRealHistoryData, cleanupUserData } from './historyAPI'
import type { HistoryData } from './historyLoader'
import ChatbotPage from './components/ChatbotPage'
import './App.css'

type PageType = 'home' | 'pregnancy-risk' | 'fetal-planes' | 'documentation' | 'about' | 'history' | 'chatbot'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [historyData, setHistoryData] = useState<HistoryData | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'pregnancy_risk' | 'fetal_classification'>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'confidence'>('newest')
  const [selectedEntry, setSelectedEntry] = useState<any>(null)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [paginationPage, setPaginationPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(12)

  const { user } = useUser()

  // Refresh history data
  const refreshHistoryData = async () => {
    if (!user?.id) return

    setIsLoadingHistory(true)
    try {
      const data = await loadRealHistoryData(user.id)
      setHistoryData(data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error refreshing history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Clean up duplicate files
  const cleanupDuplicates = async () => {
    if (!user?.id) return

    try {
      const result = await cleanupUserData(user.id)
      if (result.success) {
        alert(`✅ ${result.message}`)
        // Refresh history after cleanup
        await refreshHistoryData()
      } else {
        alert(`❌ ${result.message}`)
      }
    } catch (error) {
      alert(`❌ Error cleaning up files: ${error}`)
    }
  }

  // Filter and sort history data with pagination
  const getFilteredAndSortedData = () => {
    if (!historyData) return { pregnancyRisk: [], fetalClassification: [], combined: [], total: 0, totalPages: 0, paginated: [] }

    let allEntries = [
      ...historyData.pregnancyRisk,
      ...historyData.fetalClassification
    ]

    // Filter by type
    if (filterType !== 'all') {
      allEntries = allEntries.filter(entry => entry.type === filterType)
    }

    // Filter by search term
    if (searchTerm) {
      allEntries = allEntries.filter(entry => {
        const searchLower = searchTerm.toLowerCase()
        if (entry.type === 'pregnancy_risk') {
          return entry.prediction?.toLowerCase().includes(searchLower) ||
            entry.input_data?.Age?.toString().includes(searchTerm) ||
            entry.input_data?.BMI?.toString().includes(searchTerm)
        } else {
          return entry.predicted_label?.toLowerCase().includes(searchLower) ||
            entry.image_filename?.toLowerCase().includes(searchLower)
        }
      })
    }

    // Sort entries
    allEntries.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        case 'confidence':
          return b.confidence - a.confidence
        case 'newest':
        default:
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
    })

    // Calculate pagination
    const total = allEntries.length
    const totalPages = Math.ceil(total / itemsPerPage)
    const startIndex = (paginationPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedEntries = allEntries.slice(startIndex, endIndex)

    return {
      pregnancyRisk: allEntries.filter(e => e.type === 'pregnancy_risk'),
      fetalClassification: allEntries.filter(e => e.type === 'fetal_classification'),
      combined: allEntries,
      total,
      totalPages,
      paginated: paginatedEntries
    }
  }

  // Calculate analytics
  const getAnalytics = () => {
    if (!historyData) return null

    const pregnancy = historyData.pregnancyRisk
    const fetal = historyData.fetalClassification

    const analytics = {
      total: historyData.total,
      pregnancy: {
        total: pregnancy.length,
        highRisk: pregnancy.filter(p => p.prediction === 'High').length,
        lowRisk: pregnancy.filter(p => p.prediction === 'Low').length,
        avgConfidence: pregnancy.length > 0 ? pregnancy.reduce((sum, p) => sum + p.confidence, 0) / pregnancy.length : 0
      },
      fetal: {
        total: fetal.length,
        avgConfidence: fetal.length > 0 ? fetal.reduce((sum, f) => sum + f.confidence, 0) / fetal.length : 0,
        topClasses: fetal.reduce((acc: any, f) => {
          const mainClass = f.predicted_label?.split('_')[0] || 'Unknown'
          acc[mainClass] = (acc[mainClass] || 0) + 1
          return acc
        }, {})
      },
      timeRange: {
        oldest: Math.min(...[...pregnancy, ...fetal].map(e => new Date(e.timestamp).getTime())),
        newest: Math.max(...[...pregnancy, ...fetal].map(e => new Date(e.timestamp).getTime()))
      }
    }

    return analytics
  }

  // Export data function
  const exportData = (format: 'json' | 'csv') => {
    if (!historyData) return

    const filteredData = getFilteredAndSortedData()
    const timestamp = new Date().toISOString().split('T')[0]

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(filteredData.combined, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `medical_history_${timestamp}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // Simple CSV export
      const csvRows = ['Type,Timestamp,Prediction/Label,Confidence']
      filteredData.combined.forEach(entry => {
        const prediction = entry.type === 'pregnancy_risk' ? entry.prediction : entry.predicted_label
        csvRows.push(`${entry.type},${entry.timestamp},${prediction},${entry.confidence}`)
      })

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `medical_history_${timestamp}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // Delete history entry
  const deleteHistoryEntry = (entryId: string, entryType: 'pregnancy_risk' | 'fetal_classification') => {
    if (!historyData) return

    const updatedData = { ...historyData }
    if (entryType === 'pregnancy_risk') {
      updatedData.pregnancyRisk = updatedData.pregnancyRisk.filter(entry => entry.id !== entryId)
    } else {
      updatedData.fetalClassification = updatedData.fetalClassification.filter(entry => entry.id !== entryId)
    }
    updatedData.total = updatedData.pregnancyRisk.length + updatedData.fetalClassification.length

    setHistoryData(updatedData)
    // Note: This only removes from UI. In a real implementation, this would also delete from backend/file
  }

  // Reset pagination when filters change
  const handleFilterChange = (newFilter: typeof filterType) => {
    setFilterType(newFilter)
    setPaginationPage(1)
  }

  const handleSearchChange = (newSearch: string) => {
    setSearchTerm(newSearch)
    setPaginationPage(1)
  }

  const handleSortChange = (newSort: typeof sortBy) => {
    setSortBy(newSort)
    setPaginationPage(1)
  }

  const showPage = (pageId: PageType) => {
    setCurrentPage(pageId)
    setMobileMenuOpen(false)
  }

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  // Load history data when user changes
  useEffect(() => {
    if (user?.id) {
      refreshHistoryData()
    }
  }, [user?.id])

  // Auto-refresh history when viewing history page (reduced frequency to avoid rate limits)
  useEffect(() => {
    if (currentPage === 'history' && user?.id) {
      const interval = setInterval(() => {
        refreshHistoryData()
      }, 30000) // Refresh every 30 seconds to avoid Clerk rate limits

      return () => clearInterval(interval)
    }
  }, [currentPage, user?.id])

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <div className="page active">
            <div className="welcome-section">
              <h1>🏥 Medical AI Dashboard</h1>
              <p>Advanced AI-powered medical analysis with enterprise-grade security</p>
              <SignedIn>
                <div className="mt-4 p-4 bg-white/20 rounded-lg">
                  <p>👋 Welcome back, {user?.firstName}! You have secure access to all medical AI applications.</p>
                </div>
              </SignedIn>
              <SignedOut>
                <div className="mt-4 p-4 bg-white/20 rounded-lg">
                  <p>🔐 Please sign in to access medical AI applications. Authentication ensures HIPAA compliance and protects sensitive medical data.</p>
                </div>
              </SignedOut>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <h3>🤱 Advanced Pregnancy Risk Prediction</h3>
                <p>Random Forest model with 100% accuracy analyzing 11 clinical parameters, featuring real-time history tracking, unified data storage, and sub-millisecond inference for comprehensive maternal health assessment.</p>
              </div>
              <div className="feature-card">
                <h3>🔬 Next-Gen Fetal Ultrasound Classification</h3>
                <p>Vision Transformer achieving 91.69% accuracy with 9 anatomical plane categories, smart duplicate prevention, real-time image preview, and content-based deduplication technology.</p>
              </div>
              <div className="feature-card">
                <h3>📊 Revolutionary Real-Time History</h3>
                <p><strong>NEW:</strong> Unified medical_history.json storage with Flask API server, auto-refresh every 30 seconds, one-click cleanup tools, and instant image serving for complete medical record management.</p>
              </div>
              <div className="feature-card">
                <h3>🔒 Military-Grade Enterprise Security</h3>
                <p>HIPAA-compliant Clerk authentication with rate limiting, user-specific encrypted folders, local processing guarantee, and zero external data transmission for maximum privacy protection.</p>
              </div>
              <div className="feature-card">
                <h3>📷 Intelligent Multi-Input System</h3>
                <p>Camera capture, file upload, and path input with smart duplicate detection, automatic timestamping, real-time preview, cross-platform compatibility, and content-based deduplication.</p>
              </div>
              <div className="feature-card">
                <h3>🍎 Apple Silicon Powerhouse</h3>
                <p>Fully optimized for M1/M2/M3/M4 chips using Metal Performance Shaders (MPS), featuring thermal-aware inference, hardware acceleration, and professional-grade performance optimization.</p>
              </div>
            </div>
          </div>
        )

      case 'pregnancy-risk':
        return (
          <SignedIn>
            <div className="iframe-page active">
              <div className="iframe-container">
                <iframe
                  src={`http://localhost:8501?user_id=${user?.id || 'anonymous'}`}
                  title="Pregnancy Risk Prediction App"
                  allow="camera; microphone; geolocation"
                ></iframe>
              </div>
            </div>
          </SignedIn>
        )

      case 'fetal-planes':
        return (
          <SignedIn>
            <div className="iframe-page active">
              <div className="iframe-container">
                <iframe
                  src={`http://localhost:8502?user_id=${user?.id || 'anonymous'}`}
                  title="Fetal Ultrasound Plane Classification App"
                  allow="camera; microphone; geolocation"
                ></iframe>
              </div>
            </div>
          </SignedIn>
        )

      case 'documentation':
        return (
          <div className="page active">
            <div className="welcome-section">
              <h1>📋 System Documentation</h1>
              <p>Comprehensive documentation and performance metrics</p>
            </div>
            <div className="features-grid">
              <div className="feature-card">
                <h3>📊 Advanced Model Performance</h3>
                <p><strong>Pregnancy Risk:</strong> 100% accuracy, sub-millisecond inference<br />
                  <strong>Fetal Planes:</strong> 91.69% accuracy, optimized for real-time use<br />
                  <strong>Dataset:</strong> 13,587+ medical samples with continuous learning<br />
                  <strong>NEW:</strong> Unified history tracking with real-time API</p>
              </div>
              <div className="feature-card">
                <h3>🏗️ Modern System Architecture</h3>
                <p><strong>Frontend:</strong> React 18 + TypeScript + Vite + Clerk Auth<br />
                  <strong>Backend:</strong> Streamlit + PyTorch + Flask API Server<br />
                  <strong>Models:</strong> Random Forest + Vision Transformer (ViT)<br />
                  <strong>NEW:</strong> Real-time data management with Flask REST API</p>
              </div>
              <div className="feature-card">
                <h3>🔒 Enterprise Security & Privacy</h3>
                <p><strong>Authentication:</strong> Clerk enterprise-grade with rate limiting<br />
                  <strong>Data Isolation:</strong> User-specific encrypted folders<br />
                  <strong>NEW:</strong> Unified medical_history.json storage<br />
                  <strong>HIPAA Ready:</strong> Local processing, no data transmission</p>
              </div>
              <div className="feature-card">
                <h3>📁 Smart Data Management</h3>
                <p><strong>NEW:</strong> Single unified medical_history.json per user<br />
                  <strong>Deduplication:</strong> Content-based duplicate prevention<br />
                  <strong>Auto Cleanup:</strong> Smart file management with 7-day retention<br />
                  <strong>Image Serving:</strong> Direct API-based image access</p>
              </div>
              <div className="feature-card">
                <h3>🚀 Real-Time Performance</h3>
                <p><strong>Apple Silicon:</strong> MPS optimization for M1/M2/M3/M4<br />
                  <strong>NEW:</strong> Auto-refresh history every 30 seconds<br />
                  <strong>Multi-input:</strong> Camera, upload, file path methods<br />
                  <strong>Live Updates:</strong> Instant UI refresh with new predictions</p>
              </div>
              <div className="feature-card">
                <h3>🔧 Production-Ready Tech Stack</h3>
                <p><strong>Frontend:</strong> Vite + React 18 + TypeScript + Tailwind<br />
                  <strong>API Layer:</strong> Flask + CORS for real-time data access<br />
                  <strong>AI/ML:</strong> PyTorch + Transformers + scikit-learn<br />
                  <strong>NEW:</strong> Fixed Streamlit deprecations (st.query_params)</p>
              </div>
            </div>
          </div>
        )

      case 'about':
        return (
          <div className="page active">
            <div className="welcome-section">
              <h1>ℹ️ Advanced Medical AI Platform</h1>
              <p>Production-ready AI solutions with real-time data management for healthcare professionals</p>
            </div>
            <div className="features-grid">
              <div className="feature-card">
                <h3>🎯 Our Enhanced Mission</h3>
                <p>Delivering state-of-the-art AI-powered tools for pregnancy risk assessment and medical imaging analysis, now featuring unified real-time history tracking, smart data deduplication, and enterprise-grade security for superior patient care outcomes.</p>
              </div>
              <div className="feature-card">
                <h3>🔬 Next-Generation AI Systems</h3>
                <p><strong>Pregnancy Risk:</strong> Random Forest classifier with 100% accuracy + real-time history<br /><strong>Fetal Imaging:</strong> Vision Transformer (91.69% accuracy) with content-based duplicate prevention and instant image preview</p>
              </div>
              <div className="feature-card">
                <h3>📊 Revolutionary Data Management</h3>
                <p><strong>NEW:</strong> Unified medical_history.json storage system with Flask API server, real-time updates every 30 seconds, intelligent duplicate prevention, and one-click cleanup tools for streamlined medical record management.</p>
              </div>
              <div className="feature-card">
                <h3>🔒 Military-Grade Security</h3>
                <p>Clerk enterprise authentication with rate limiting, user-specific encrypted folders, HIPAA-compliant local processing, secure image serving via dedicated API endpoints, and zero external data transmission.</p>
              </div>
              <div className="feature-card">
                <h3>📷 Advanced Input Systems</h3>
                <p>Multiple capture methods (camera, upload, file path) with smart duplicate detection, automatic timestamping, real-time image preview, cross-platform compatibility, and content-based deduplication technology.</p>
              </div>
              <div className="feature-card">
                <h3>🍎 Apple Silicon Excellence</h3>
                <p>Fully optimized for M1/M2/M3/M4 chips using Metal Performance Shaders (MPS), featuring thermal-aware inference, sub-millisecond predictions, and professional-grade performance with automatic hardware optimization.</p>
              </div>
            </div>
          </div>
        )

      case 'history':
        const filteredData = getFilteredAndSortedData()
        const analytics = getAnalytics()

        return (
          <SignedIn>
            <div className="page active">
              <div className="welcome-section">
                <h1>📊 Advanced Medical History Dashboard</h1>
                <p>Comprehensive analysis and management of your medical AI data</p>
              </div>

              {/* Analytics Dashboard */}
              {analytics && (
                <div className="analytics-dashboard" style={{ margin: '2rem 0' }}>
                  <div className="analytics-header">
                    <h2>📈 Analytics Overview</h2>
                    <button
                      onClick={() => setShowAnalytics(!showAnalytics)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: showAnalytics ? '#ef4444' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer'
                      }}
                    >
                      {showAnalytics ? '📉 Hide Analytics' : '📈 Show Analytics'}
                    </button>
                  </div>

                  {showAnalytics && (
                    <div className="analytics-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
                      <div className="analytics-card" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', padding: '1.5rem', borderRadius: '12px' }}>
                        <h3>📊 Total Records</h3>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{analytics.total}</div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                          {analytics.pregnancy.total} Pregnancy • {analytics.fetal.total} Fetal
                        </div>
                      </div>

                      <div className="analytics-card" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)', color: 'white', padding: '1.5rem', borderRadius: '12px' }}>
                        <h3>🤱 Pregnancy Analysis</h3>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                          {analytics.pregnancy.highRisk} High Risk
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                          Avg Confidence: {(analytics.pregnancy.avgConfidence * 100).toFixed(1)}%
                        </div>
                      </div>

                      <div className="analytics-card" style={{ background: 'linear-gradient(135deg, #4facfe, #00f2fe)', color: 'white', padding: '1.5rem', borderRadius: '12px' }}>
                        <h3>🔬 Fetal Analysis</h3>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                          {Object.keys(analytics.fetal.topClasses).length} Classes
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                          Avg Confidence: {(analytics.fetal.avgConfidence * 100).toFixed(1)}%
                        </div>
                      </div>

                      <div className="analytics-card" style={{ background: 'linear-gradient(135deg, #fa709a, #fee140)', color: 'white', padding: '1.5rem', borderRadius: '12px' }}>
                        <h3>📅 Time Range</h3>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                          {Math.ceil((analytics.timeRange.newest - analytics.timeRange.oldest) / (1000 * 60 * 60 * 24))} Days
                        </div>
                        <div style={{ opacity: 0.9, fontSize: '0.9rem' }}>
                          Data Collection Period
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Advanced Controls */}
              <div className="history-controls-advanced" style={{
                background: 'linear-gradient(145deg, #f8fafc, #e2e8f0)',
                padding: '1.5rem',
                borderRadius: '12px',
                margin: '1rem 0',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>

                {/* Search and Filter Row */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div style={{ flex: '1', minWidth: '200px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Search predictions, labels, or patient data..."
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '2px solid #e5e7eb',
                        fontSize: '1rem',
                        background: 'white'
                      }}
                    />
                  </div>

                  <select
                    value={filterType}
                    onChange={(e) => handleFilterChange(e.target.value as any)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      background: 'white'
                    }}
                  >
                    <option value="all">📊 All Types</option>
                    <option value="pregnancy_risk">🤱 Pregnancy Risk</option>
                    <option value="fetal_classification">🔬 Fetal Classification</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value as any)}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      background: 'white'
                    }}
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="confidence">⭐ By Confidence</option>
                  </select>

                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '1rem',
                      background: 'white'
                    }}
                  >
                    <option value={6}>6 per page</option>
                    <option value={12}>12 per page</option>
                    <option value={24}>24 per page</option>
                    <option value={48}>48 per page</option>
                  </select>
                </div>

                {/* Action Buttons Row */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={refreshHistoryData}
                    disabled={isLoadingHistory}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isLoadingHistory ? 'not-allowed' : 'pointer',
                      opacity: isLoadingHistory ? 0.7 : 1,
                      fontWeight: 'bold'
                    }}
                  >
                    {isLoadingHistory ? '🔄 Refreshing...' : '🔄 Refresh Data'}
                  </button>

                  <button
                    onClick={cleanupDuplicates}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🧹 Clean Duplicates
                  </button>

                  <button
                    onClick={() => exportData('json')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📄 Export JSON
                  </button>

                  <button
                    onClick={() => exportData('csv')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📊 Export CSV
                  </button>

                  {lastRefresh && (
                    <div style={{
                      alignSelf: 'center',
                      fontSize: '0.9rem',
                      color: '#6b7280',
                      background: 'white',
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }}>
                      🕒 Last updated: {lastRefresh.toLocaleTimeString()}
                    </div>
                  )}
                </div>

                {/* Results Summary */}
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  background: 'white',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb'
                }}>
                  <strong>📋 Showing {((paginationPage - 1) * itemsPerPage) + 1}-{Math.min(paginationPage * itemsPerPage, filteredData.total)} of {filteredData.total} records</strong>
                  {filteredData.totalPages > 1 && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>• Page {paginationPage} of {filteredData.totalPages}</span>}
                  {searchTerm && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>• Filtered by: "{searchTerm}"</span>}
                  {filterType !== 'all' && <span style={{ color: '#6b7280', marginLeft: '0.5rem' }}>• Type: {filterType}</span>}
                </div>
              </div>

              {isLoadingHistory ? (
                <div className="history-loading" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔄</div>
                  <h3>Loading Medical History...</h3>
                  <p>📁 <strong>Storage:</strong> uploads/{user?.id || 'session'}/medical_history.json</p>
                </div>
              ) : !historyData || historyData.total === 0 ? (
                <div className="history-loading" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📭</div>
                  <h3>No Medical History Found</h3>
                  <p>📁 <strong>Storage:</strong> uploads/{user?.id || 'session'}/medical_history.json</p>
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    color: 'white',
                    padding: '2rem',
                    borderRadius: '12px',
                    margin: '2rem auto',
                    maxWidth: '500px'
                  }}>
                    <h4>💡 Get Started</h4>
                    <ol style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>
                      <li>Visit <strong>Pregnancy Risk</strong> or <strong>Fetal Planes</strong> pages</li>
                      <li>Make some predictions with the AI models</li>
                      <li>Return here to see your comprehensive history</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="unified-history-container" style={{ margin: '2rem 0' }}>
                  <h2>📋 Medical Records ({filteredData.total} total entries)</h2>

                  <div className="history-entries-grid" style={{
                    display: 'grid',
                    gap: '1.5rem',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))'
                  }}>
                    {filteredData.paginated.map((entry) => (
                      <div
                        key={entry.id}
                        className={`modern-history-card ${entry.type}`}
                        style={{
                          background: entry.type === 'pregnancy_risk'
                            ? 'linear-gradient(145deg, #fef7f7, #fee2e2)'
                            : 'linear-gradient(145deg, #f0f9ff, #dbeafe)',
                          border: `2px solid ${entry.type === 'pregnancy_risk' ? '#fca5a5' : '#93c5fd'}`,
                          borderRadius: '16px',
                          padding: '1.5rem',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedEntry(entry)}
                      >
                        {/* Card Header */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '1rem'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.5rem' }}>
                              {entry.type === 'pregnancy_risk' ? '🤱' : '🔬'}
                            </span>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                {entry.type === 'pregnancy_risk' ? 'Pregnancy Risk' : 'Fetal Classification'}
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                                {formatTimestamp(entry.timestamp)}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              backgroundColor: entry.confidence > 0.8 ? '#10b981' : entry.confidence > 0.6 ? '#f59e0b' : '#ef4444',
                              color: 'white',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.9rem',
                              fontWeight: 'bold'
                            }}>
                              {(entry.confidence * 100).toFixed(1)}%
                            </div>
                          </div>
                        </div>

                        {/* Card Content */}
                        {entry.type === 'pregnancy_risk' ? (
                          <div>
                            <div style={{
                              fontSize: '1.25rem',
                              fontWeight: 'bold',
                              color: entry.prediction === 'High' ? '#ef4444' : '#10b981',
                              marginBottom: '1rem'
                            }}>
                              {entry.prediction} Risk Prediction
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                              Patient: Age {entry.input_data?.Age}, BMI {entry.input_data?.BMI}<br />
                              BP: {entry.input_data?.['Systolic BP']}/{entry.input_data?.Diastolic}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{
                              fontSize: '1.1rem',
                              fontWeight: 'bold',
                              marginBottom: '1rem',
                              color: '#1f2937'
                            }}>
                              {entry.predicted_label}
                            </div>
                            {entry.image_path && (
                              <div style={{ marginBottom: '1rem' }}>
                                <img
                                  src={entry.image_path}
                                  alt={entry.predicted_label}
                                  style={{
                                    width: '100%',
                                    height: '150px',
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    border: '2px solid #e5e7eb'
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                              📁 {entry.image_filename}
                            </div>
                          </div>
                        )}

                        {/* Card Actions */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid #e5e7eb'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEntry(entry);
                            }}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem'
                            }}
                          >
                            👁️ View Details
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHistoryEntry(entry.id, entry.type);
                            }}
                            style={{
                              padding: '0.5rem',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer'
                            }}
                            title="Delete entry"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {filteredData.totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '1rem',
                      marginTop: '2rem',
                      padding: '1rem',
                      background: 'white',
                      borderRadius: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <button
                        onClick={() => setPaginationPage(Math.max(1, paginationPage - 1))}
                        disabled={paginationPage === 1}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: paginationPage === 1 ? '#e5e7eb' : '#3b82f6',
                          color: paginationPage === 1 ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: paginationPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ← Previous
                      </button>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {Array.from({ length: Math.min(5, filteredData.totalPages) }, (_, i) => {
                          let pageNum
                          if (filteredData.totalPages <= 5) {
                            pageNum = i + 1
                          } else if (paginationPage <= 3) {
                            pageNum = i + 1
                          } else if (paginationPage >= filteredData.totalPages - 2) {
                            pageNum = filteredData.totalPages - 4 + i
                          } else {
                            pageNum = paginationPage - 2 + i
                          }

                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPaginationPage(pageNum)}
                              style={{
                                padding: '0.5rem 0.75rem',
                                backgroundColor: paginationPage === pageNum ? '#3b82f6' : 'white',
                                color: paginationPage === pageNum ? 'white' : '#374151',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: paginationPage === pageNum ? 'bold' : 'normal'
                              }}
                            >
                              {pageNum}
                            </button>
                          )
                        })}
                      </div>

                      <button
                        onClick={() => setPaginationPage(Math.min(filteredData.totalPages, paginationPage + 1))}
                        disabled={paginationPage === filteredData.totalPages}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: paginationPage === filteredData.totalPages ? '#e5e7eb' : '#3b82f6',
                          color: paginationPage === filteredData.totalPages ? '#9ca3af' : 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: paginationPage === filteredData.totalPages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Next →
                      </button>

                      <div style={{ marginLeft: '1rem', fontSize: '0.9rem', color: '#6b7280' }}>
                        Page {paginationPage} of {filteredData.totalPages}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Enhanced Footer */}
              <div className="history-info-footer" style={{
                background: 'linear-gradient(135deg, #1f2937, #374151)',
                color: 'white',
                padding: '2rem',
                borderRadius: '12px',
                margin: '2rem 0'
              }}>
                <h3>🔧 System Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div>
                    <strong>📁 File Location:</strong><br />
                    uploads/{user?.id || 'session'}/medical_history.json
                  </div>
                  <div>
                    <strong>🔄 Auto-Save:</strong><br />
                    All predictions automatically saved
                  </div>
                  <div>
                    <strong>📊 Unified Storage:</strong><br />
                    Single JSON file for easy management
                  </div>
                  <div>
                    <strong>🌐 API Server:</strong><br />
                    Real-time access via localhost:8503
                  </div>
                </div>
              </div>

              {/* Modal for detailed view */}
              {selectedEntry && (
                <div
                  className="history-modal-overlay"
                  onClick={() => setSelectedEntry(null)}
                >
                  <div
                    className="history-modal-content"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      maxWidth: '700px',
                      maxHeight: '90vh',
                      width: '90%'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h2>{selectedEntry.type === 'pregnancy_risk' ? '🤱 Pregnancy Risk Details' : '🔬 Fetal Classification Details'}</h2>
                      <button
                        onClick={() => setSelectedEntry(null)}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          cursor: 'pointer'
                        }}
                      >
                        ✕
                      </button>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1rem' }}>
                      📅 {formatTimestamp(selectedEntry.timestamp)} • ID: {selectedEntry.id}
                    </div>

                    {selectedEntry.type === 'pregnancy_risk' ? (
                      <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h3 style={{ color: selectedEntry.prediction === 'High' ? '#ef4444' : '#10b981' }}>
                            {selectedEntry.prediction} Risk ({(selectedEntry.confidence * 100).toFixed(1)}% confidence)
                          </h3>
                        </div>

                        <h4>Patient Data:</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                          {Object.entries(selectedEntry.input_data || {}).map(([key, value]) => (
                            <div key={key} style={{ padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '6px' }}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>

                        <h4>Risk Probabilities:</h4>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <div style={{
                            padding: '1rem',
                            backgroundColor: '#fee2e2',
                            borderRadius: '8px',
                            flex: 1,
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#ef4444', fontWeight: 'bold' }}>High Risk</div>
                            <div style={{ fontSize: '1.5rem' }}>{(selectedEntry.probabilities.high_risk * 100).toFixed(1)}%</div>
                          </div>
                          <div style={{
                            padding: '1rem',
                            backgroundColor: '#d1fae5',
                            borderRadius: '8px',
                            flex: 1,
                            textAlign: 'center'
                          }}>
                            <div style={{ color: '#10b981', fontWeight: 'bold' }}>Low Risk</div>
                            <div style={{ fontSize: '1.5rem' }}>{(selectedEntry.probabilities.low_risk * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ marginBottom: '1.5rem' }}>
                          <h3>{selectedEntry.predicted_label}</h3>
                          <div style={{ color: '#6b7280' }}>
                            Confidence: {(selectedEntry.confidence * 100).toFixed(1)}%
                          </div>
                        </div>

                        {selectedEntry.image_path && (
                          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                            <img
                              src={selectedEntry.image_path}
                              alt={selectedEntry.predicted_label}
                              style={{
                                maxWidth: '100%',
                                height: 'auto',
                                borderRadius: '8px',
                                border: '2px solid #e5e7eb'
                              }}
                            />
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                              📁 {selectedEntry.image_filename}
                            </div>
                          </div>
                        )}

                        <h4>All Predictions:</h4>
                        <div style={{
                          maxHeight: '300px',
                          overflow: 'auto',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          backgroundColor: '#f9fafb'
                        }}>
                          {selectedEntry.top_predictions?.map((pred: any, idx: number) => (
                            <div key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              padding: '0.75rem',
                              backgroundColor: idx < 3 ? '#f0f9ff' : 'white',
                              borderBottom: idx < selectedEntry.top_predictions.length - 1 ? '1px solid #e5e7eb' : 'none',
                              fontSize: '0.9rem'
                            }}>
                              <span style={{ flex: 1 }}>#{idx + 1} {pred.Class}</span>
                              <span style={{
                                fontWeight: 'bold',
                                color: idx < 3 ? '#3b82f6' : '#6b7280',
                                minWidth: '60px',
                                textAlign: 'right'
                              }}>
                                {pred.Percentage}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </SignedIn>
        )
      
      case 'chatbot':
        return <ChatbotPage />
      
      default:
        return null
    }
  }

  return (
    <div className="App">
      <nav className="navbar">
        <div className="nav-container">
          {/* Desktop Navigation Menu */}
          <ul className="nav-menu">
            <li className={`nav-item ${currentPage === 'home' ? 'active' : ''}`} onClick={() => showPage('home')}>🏠 Home</li>
            <li className={`nav-item ${currentPage === 'pregnancy-risk' ? 'active' : ''}`} onClick={() => showPage('pregnancy-risk')}>🤱 Pregnancy Risk</li>
            <li className={`nav-item ${currentPage === 'fetal-planes' ? 'active' : ''}`} onClick={() => showPage('fetal-planes')}>🔬 Fetal Planes</li>
            <li className={`nav-item ${currentPage === 'chatbot' ? 'active' : ''}`} onClick={() => showPage('chatbot')}>🤖 AI Assistant</li>
            <li className={`nav-item ${currentPage === 'history' ? 'active' : ''}`} onClick={() => showPage('history')}>📊 History</li>
            <li className={`nav-item ${currentPage === 'documentation' ? 'active' : ''}`} onClick={() => showPage('documentation')}>📋 Documentation</li>
            <li className={`nav-item ${currentPage === 'about' ? 'active' : ''}`} onClick={() => showPage('about')}>ℹ️ About</li>
          </ul>

          <div className="auth-section">
            {/* Mobile Menu Button */}
            <button
              className="mobile-menu-button"
              onClick={toggleMobileMenu}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>

            {/* Auth Buttons */}
            <SignedOut>
              <SignInButton mode="modal">
                <button className="auth-button">
                  🔐 Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'width: 32px; height: 32px;'
                  }
                }}
              />
            </SignedIn>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="mobile-menu">
            <div className={`mobile-menu-item ${currentPage === 'home' ? 'bg-white/30' : ''}`} onClick={() => showPage('home')}>🏠 Home</div>
            <div className={`mobile-menu-item ${currentPage === 'pregnancy-risk' ? 'bg-white/30' : ''}`} onClick={() => showPage('pregnancy-risk')}>🤱 Pregnancy Risk</div>
            <div className={`mobile-menu-item ${currentPage === 'fetal-planes' ? 'bg-white/30' : ''}`} onClick={() => showPage('fetal-planes')}>🔬 Fetal Planes</div>
            <div className={`mobile-menu-item ${currentPage === 'chatbot' ? 'bg-white/30' : ''}`} onClick={() => showPage('chatbot')}>🤖 AI Assistant</div>
            <div className={`mobile-menu-item ${currentPage === 'history' ? 'bg-white/30' : ''}`} onClick={() => showPage('history')}>📊 History</div>
            <div className={`mobile-menu-item ${currentPage === 'documentation' ? 'bg-white/30' : ''}`} onClick={() => showPage('documentation')}>📋 Documentation</div>
            <div className={`mobile-menu-item ${currentPage === 'about' ? 'bg-white/30' : ''}`} onClick={() => showPage('about')}>ℹ️ About</div>
          </div>
        )}
      </nav>

      <main className={currentPage === 'pregnancy-risk' || currentPage === 'fetal-planes' ? '' : 'main-content'}>
        <SignedOut>
          {currentPage === 'pregnancy-risk' || currentPage === 'fetal-planes' ? (
            <div className="auth-required">
              <h2>🔐 Authentication Required</h2>
              <p>Please sign in to access the Medical AI applications.</p>
              <p>This ensures secure access to sensitive medical tools and protects patient data.</p>
              <SignInButton mode="modal">
                <button className="bg-white/20 border border-white/30 text-white px-8 py-4 rounded-full cursor-pointer text-lg font-semibold hover:bg-white/30 transition-all duration-300 mt-4">
                  🔐 Sign In to Continue
                </button>
              </SignInButton>
            </div>
          ) : (
            renderPage()
          )}
        </SignedOut>
        <SignedIn>
          {renderPage()}
        </SignedIn>
      </main>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Medical Disclaimer</a>
            <a href="#">HIPAA Compliance</a>
            <a href="#">Support</a>
          </div>
          <p>&copy; 2024 Medical AI Dashboard. Enterprise-grade security for healthcare professionals.</p>
          <p><strong>Security:</strong> Protected by Clerk authentication with enterprise-grade security standards.</p>
          <p><strong>Medical Disclaimer:</strong> This tool is for educational and informational purposes only. Always consult with qualified healthcare providers for medical decisions.</p>
        </div>
      </footer>
    </div>
  )
}

export default App