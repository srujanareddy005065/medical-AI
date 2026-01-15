// Real history data loader for medical AI dashboard
// This reads actual JSON files from the API server

import type { HistoryEntry, HistoryData } from './historyLoader';

// API base URL - adjust based on your setup
const API_BASE_URL = 'http://localhost:8503/api';

// Load real history data from actual medical_history.json file via API
export const loadRealHistoryData = async (userId: string): Promise<HistoryData> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${userId}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Ensure all required fields are present and fix any path issues
    const processedData = {
      pregnancyRisk: data.pregnancyRisk.map((entry: any) => ({
        ...entry,
        // Ensure all required fields are present
        id: entry.id || `preg_${Date.now()}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        type: 'pregnancy_risk' as const,
        user_id: userId,
        confidence: entry.confidence || 0,
        prediction: entry.prediction || 'Unknown',
        input_data: entry.input_data || {},
        probabilities: entry.probabilities || { high_risk: 0, low_risk: 0 }
      })),
      fetalClassification: data.fetalClassification.map((entry: any) => ({
        ...entry,
        // Ensure all required fields are present
        id: entry.id || `fetal_${Date.now()}`,
        timestamp: entry.timestamp || new Date().toISOString(),
        type: 'fetal_classification' as const,
        user_id: userId,
        confidence: entry.confidence || 0,
        predicted_label: entry.predicted_label || 'Unknown',
        image_filename: entry.image_filename || 'unknown.png',
        // Fix image path to use API server
        image_path: entry.image_path ? `http://localhost:8503/${entry.image_path}` : null,
        top_predictions: entry.top_predictions || []
      })),
      total: data.total || 0
    };
    
    return processedData;
  } catch (error) {
    console.error('Error loading real history data:', error);
    
    // Fallback to empty data instead of mock data
    return {
      pregnancyRisk: [],
      fetalClassification: [],
      total: 0
    };
  }
};

// Check if user has any history files via API
export const hasHistoryData = async (userId: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/history/${userId}`);
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.total > 0;
  } catch {
    return false;
  }
};

// Get list of all users with history data
export const getUsersWithHistory = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/users`);
    if (!response.ok) return [];
    
    return await response.json();
  } catch {
    return [];
  }
};

// Clean up duplicate files for a user
export const cleanupUserData = async (userId: string): Promise<{success: boolean, message: string}> => {
  try {
    const response = await fetch(`${API_BASE_URL}/cleanup/${userId}`);
    if (!response.ok) {
      return { success: false, message: 'API request failed' };
    }
    
    const data = await response.json();
    return { success: true, message: data.message };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
};