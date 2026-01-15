import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import warnings
warnings.filterwarnings('ignore')

def load_and_preprocess_data(file_path):
    df = pd.read_csv(file_path)
    
    df = df.dropna(subset=['Risk Level'])
    
    numerical_cols = ['Age', 'Systolic BP', 'Diastolic', 'BS', 'Body Temp', 'BMI', 'Heart Rate']
    for col in numerical_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())
    
    categorical_cols = ['Previous Complications', 'Preexisting Diabetes', 'Gestational Diabetes', 'Mental Health']
    for col in categorical_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].mode()[0])
    
    return df

def train_model(df):
    feature_columns = ['Age', 'Systolic BP', 'Diastolic', 'BS', 'Body Temp', 'BMI', 
                      'Previous Complications', 'Preexisting Diabetes', 'Gestational Diabetes', 
                      'Mental Health', 'Heart Rate']
    
    X = df[feature_columns]
    y = df['Risk Level']
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42
    )
    
    rf_model.fit(X_train, y_train)
    
    y_pred = rf_model.predict(X_test)
    
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"Model Accuracy: {accuracy:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))
    
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': rf_model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nFeature Importance:")
    print(feature_importance)
    
    return rf_model, le, feature_columns

def predict_risk(model, label_encoder, feature_columns, patient_data):
    patient_df = pd.DataFrame([patient_data], columns=feature_columns)
    
    prediction = model.predict(patient_df)[0]
    probability = model.predict_proba(patient_df)[0]
    
    risk_level = label_encoder.inverse_transform([prediction])[0]
    
    return risk_level, probability

def main():
    print("Loading and preprocessing data...")
    df = load_and_preprocess_data('/Users/karthik/Projects/hackathon15092025/data/Dataset - Updated.csv')
    
    print(f"Dataset shape: {df.shape}")
    print(f"Risk Level distribution:")
    print(df['Risk Level'].value_counts())
    
    print("\nTraining model...")
    model, label_encoder, feature_columns = train_model(df)
    
    joblib.dump(model, '/Users/karthik/Projects/hackathon15092025/models/pregnancy_risk_model.pkl')
    joblib.dump(label_encoder, '/Users/karthik/Projects/hackathon15092025/models/label_encoder.pkl')
    joblib.dump(feature_columns, '/Users/karthik/Projects/hackathon15092025/models/feature_columns.pkl')
    print("\nModel saved successfully!")
    
    print("\nModel training completed successfully!")
    print("Use the predict_risk() function to make predictions for new patients.")

if __name__ == "__main__":
    main()