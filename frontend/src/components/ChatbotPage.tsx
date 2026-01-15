import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './ChatbotPage.css'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your medical AI assistant. I can help you understand medical concepts, explain procedures, and provide general health information. How can I assist you today?",
      sender: 'bot',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
    }
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [inputValue])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'openai/gpt-oss-20b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful medical AI assistant. Provide concise, accurate medical information and guidance. Always remind users to consult healthcare professionals for medical decisions. Keep responses brief and helpful.'
          },
          {
            role: 'user',
            content: userMessage.text
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      }, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Medical AI Dashboard'
        }
      })

      const botResponse = response.data.choices[0]?.message?.content || 'Sorry, I could not generate a response. Please try again.'

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error: any) {
      console.error('Error sending message:', error)

      let errorText = 'Sorry, I encountered an error. Please try again.'
      if (error.response?.status === 404) {
        errorText = 'API endpoint not found. Please check the model name or API configuration.'
      } else if (error.response?.status === 401) {
        errorText = 'Invalid API key. Please check your OpenRouter API key configuration.'
      } else if (error.response?.status === 429) {
        errorText = 'Rate limit exceeded. Please wait a moment and try again.'
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: '1',
      text: "Hi! I'm your medical AI assistant. I can help you understand medical concepts, explain procedures, and provide general health information. How can I assist you today?",
      sender: 'bot',
      timestamp: new Date()
    }])
  }

  const exportChat = () => {
    const chatData = {
      messages,
      exportedAt: new Date().toISOString(),
      totalMessages: messages.length
    }

    const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `medical_chat_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="chatbot-page">
      {/* Header */}
      <div className="chatbot-header">
        <div className="header-content">
          <div className="header-left">
            <div className="ai-avatar">
              <span className="avatar-emoji">🤖</span>
            </div>
            <div className="header-text">
              <h1>Medical AI Assistant</h1>
              <p>Your intelligent healthcare companion</p>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={exportChat} className="action-btn export-btn" title="Export Chat">
              <span>📥</span>
              Export
            </button>
            <button onClick={clearChat} className="action-btn clear-btn" title="Clear Chat">
              <span>🗑️</span>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Messages Area */}
        <div className="messages-area">
          <div className="messages-wrapper">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
              >
                <div className="message-avatar">
                  {message.sender === 'user' ? (
                    <div className="user-avatar">👤</div>
                  ) : (
                    <div className="bot-avatar">
                      🤖
                    </div>
                  )}
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    {message.sender === 'bot' && (
                      <div className="message-header">
                        <span className="sender-name">AI Assistant</span>
                        <div className="status-indicator">
                          <div className="status-dot"></div>
                          <span>Online</span>
                        </div>
                      </div>
                    )}
                    <p className="message-text">{message.text}</p>
                    <div className="message-timestamp">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message bot-message loading-message">
                <div className="message-avatar">
                  <div className="bot-avatar">
                    🤖
                  </div>
                </div>
                <div className="message-content">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <div className="typing-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                      <span className="typing-text">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="input-area">
          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about health and medicine..."
                className="message-input"
                rows={1}
                disabled={isLoading}
                maxLength={1000}
              />
              <div className="input-actions">
                <div className="character-count">
                  {inputValue.length}/1000
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="send-button"
                  title="Send message"
                >
                  {isLoading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <span className="send-icon">🚀</span>
                  )}
                </button>
              </div>
            </div>

            <div className="input-footer">
              <div className="powered-by">
                <span className="icon">⚡</span>
                <span>Powered by OpenRouter • Always consult healthcare professionals for medical decisions</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}