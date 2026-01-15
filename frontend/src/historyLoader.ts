// Simple history loader for medical AI dashboard
// This reads the unified medical_history.json file and formats it for display

export interface HistoryEntry {
  id: string;
  timestamp: string;
  type: 'pregnancy_risk' | 'fetal_classification';
  user_id: string;
  confidence: number;
  // Pregnancy risk specific
  input_data?: any;
  prediction?: string;
  probabilities?: {
    high_risk: number;
    low_risk: number;
  };
  // Fetal classification specific
  image_filename?: string;
  image_path?: string;
  predicted_label?: string;
  top_predictions?: Array<{
    Class: string;
    Probability: number;
    Percentage: string;
  }>;
}

export interface HistoryData {
  pregnancyRisk: HistoryEntry[];
  fetalClassification: HistoryEntry[];
  total: number;
}

// Mock data for demonstration (in real app, this would fetch from backend)
export const getMockHistoryData = (userId: string): HistoryData => {
  const mockEntries: HistoryEntry[] = [
    {
      id: '1',
      timestamp: '2024-01-15T10:30:00.000Z',
      type: 'pregnancy_risk',
      user_id: userId,
      confidence: 0.95,
      input_data: {
        Age: 28,
        BMI: 24.5,
        'Systolic BP': 120,
        Diastolic: 80,
        BS: 7.2,
        'Body Temp': 98.6,
        'Heart Rate': 75,
        'Previous Complications': 0,
        'Preexisting Diabetes': 0,
        'Gestational Diabetes': 0,
        'Mental Health': 0
      },
      prediction: 'Low',
      probabilities: {
        high_risk: 0.05,
        low_risk: 0.95
      }
    },
    {
      id: '2',
      timestamp: '2024-01-15T10:35:00.000Z',
      type: 'fetal_classification',
      user_id: userId,
      confidence: 0.92,
      image_filename: '20240115_103500_ultrasound.png',
      predicted_label: 'Fetal Brain_Trans-thalamic',
      top_predictions: [
        { Class: 'Fetal Brain_Trans-thalamic', Probability: 0.92, Percentage: '92.0%' },
        { Class: 'Fetal Brain_Trans-ventricular', Probability: 0.05, Percentage: '5.0%' },
        { Class: 'Fetal Brain_Trans-cerebellum', Probability: 0.02, Percentage: '2.0%' },
        { Class: 'Fetal Brain_Other', Probability: 0.01, Percentage: '1.0%' },
        { Class: 'Fetal Brain_Not A Brain', Probability: 0.00, Percentage: '0.0%' }
      ]
    },
    {
      id: '3',
      timestamp: '2024-01-15T09:15:00.000Z',
      type: 'pregnancy_risk',
      user_id: userId,
      confidence: 0.88,
      input_data: {
        Age: 32,
        BMI: 26.8,
        'Systolic BP': 135,
        Diastolic: 85,
        BS: 8.1,
        'Body Temp': 99.2,
        'Heart Rate': 82,
        'Previous Complications': 1,
        'Preexisting Diabetes': 0,
        'Gestational Diabetes': 1,
        'Mental Health': 0
      },
      prediction: 'High',
      probabilities: {
        high_risk: 0.88,
        low_risk: 0.12
      }
    }
  ];

  const pregnancyRisk = mockEntries.filter(entry => entry.type === 'pregnancy_risk');
  const fetalClassification = mockEntries.filter(entry => entry.type === 'fetal_classification');

  return {
    pregnancyRisk,
    fetalClassification,
    total: mockEntries.length
  };
};

export const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.8) return '#10b981'; // green
  if (confidence >= 0.6) return '#f59e0b'; // yellow
  return '#ef4444'; // red
};

export const getRiskColor = (prediction: string): string => {
  return prediction === 'High' ? '#ef4444' : '#10b981';
};