import streamlit as st
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib
import os
import uuid
import datetime
from pathlib import Path

def get_user_id():
    """Get user ID from Clerk authentication or generate a session ID"""
    # Try to get user ID from query params (passed from frontend)
    query_params = st.query_params
    user_id = query_params.get('user_id', None)
    
    if not user_id:
        # Fallback: use session state for anonymous users
        if 'session_user_id' not in st.session_state:
            st.session_state.session_user_id = str(uuid.uuid4())
        user_id = st.session_state.session_user_id
    
    return user_id

def create_user_upload_folder(user_id):
    """Create user-specific upload folder"""
    # Use absolute path relative to project root
    base_upload_dir = Path(__file__).parent.parent / 'uploads'
    user_upload_dir = base_upload_dir / user_id
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    return user_upload_dir

# Removed individual prediction file saving - now using unified medical_history.json only

def save_prediction_history(user_id, input_data, prediction, confidence, probability):
    """Save prediction result to unified medical history"""
    try:
        user_folder = create_user_upload_folder(user_id)
        history_file = user_folder / 'medical_history.json'
        
        # Create history entry
        history_entry = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.datetime.now().isoformat(),
            'type': 'pregnancy_risk',
            'input_data': input_data,
            'prediction': prediction,
            'confidence': float(confidence),
            'probabilities': {
                'high_risk': float(probability[1]),
                'low_risk': float(probability[0])
            },
            'user_id': user_id
        }
        
        # Load existing history or create new
        history = []
        if history_file.exists():
            import json
            with open(history_file, 'r') as f:
                history = json.load(f)
        
        # Add new entry at the beginning
        history.insert(0, history_entry)
        
        # Keep only last 100 entries total
        history = history[:100]
        
        # Save updated history
        import json
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)
        
        return True
    
    except Exception as e:
        st.warning(f"Could not save to history: {e}")
        return False

st.set_page_config(
    page_title="Pregnancy Risk Prediction",
    page_icon="🤱",
    layout="wide"
)

with open('../assets/static/css/style.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

# Initialize user session
user_id = get_user_id()

st.title("🤱 Pregnancy Risk Prediction Model")
st.markdown("""
This application predicts pregnancy risk levels based on various health parameters.
Please enter the patient's information below to get a risk assessment with secure user-specific storage.
""")

# Display user info
if 'session_user_id' in st.session_state and user_id == st.session_state.session_user_id:
    st.info(f"🔐 Session ID: {user_id[:8]}... (Anonymous session)")
else:
    st.success(f"👤 Authenticated User: {user_id[:8]}...")

@st.cache_data
def load_and_train_model():
    df = pd.read_csv('../data/Dataset - Updated.csv')
    
    df = df.dropna(subset=['Risk Level'])
    
    numerical_cols = ['Age', 'Systolic BP', 'Diastolic', 'BS', 'Body Temp', 'BMI', 'Heart Rate']
    for col in numerical_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].median())
    
    categorical_cols = ['Previous Complications', 'Preexisting Diabetes', 'Gestational Diabetes', 'Mental Health']
    for col in categorical_cols:
        if col in df.columns:
            df[col] = df[col].fillna(df[col].mode()[0])
    
    feature_columns = ['Age', 'Systolic BP', 'Diastolic', 'BS', 'Body Temp', 'BMI', 
                      'Previous Complications', 'Preexisting Diabetes', 'Gestational Diabetes', 
                      'Mental Health', 'Heart Rate']
    
    X = df[feature_columns]
    y = df['Risk Level']
    
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded)
    
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    
    return model, le, feature_columns, accuracy, df

model, label_encoder, feature_columns, accuracy, df = load_and_train_model()

st.sidebar.header("Model Information")
st.sidebar.metric("Model Accuracy", f"{accuracy:.2%}")
st.sidebar.metric("Total Samples", len(df))
st.sidebar.metric("High Risk Cases", len(df[df['Risk Level'] == 'High']))
st.sidebar.metric("Low Risk Cases", len(df[df['Risk Level'] == 'Low']))

st.header("Patient Information")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Basic Information")
    age = st.number_input("Age", min_value=15, max_value=50, value=25, help="Patient's age in years")
    bmi = st.number_input("BMI", min_value=15.0, max_value=50.0, value=24.0, step=0.1, help="Body Mass Index")
    body_temp = st.number_input("Body Temperature (°F)", min_value=95.0, max_value=105.0, value=98.6, step=0.1)
    
    st.subheader("Blood Pressure")
    systolic_bp = st.number_input("Systolic BP", min_value=80, max_value=200, value=120, help="Systolic blood pressure")
    diastolic_bp = st.number_input("Diastolic BP", min_value=50, max_value=120, value=80, help="Diastolic blood pressure")
    
with col2:
    st.subheader("Health Metrics")
    blood_sugar = st.number_input("Blood Sugar", min_value=3.0, max_value=20.0, value=7.0, step=0.1, help="Blood sugar level")
    heart_rate = st.number_input("Heart Rate", min_value=50, max_value=120, value=75, help="Heart rate in BPM")
    
    st.subheader("Medical History")
    prev_complications = st.selectbox("Previous Complications", [0, 1], format_func=lambda x: "No" if x == 0 else "Yes")
    preexisting_diabetes = st.selectbox("Preexisting Diabetes", [0, 1], format_func=lambda x: "No" if x == 0 else "Yes")
    gestational_diabetes = st.selectbox("Gestational Diabetes", [0, 1], format_func=lambda x: "No" if x == 0 else "Yes")
    mental_health = st.selectbox("Mental Health Issues", [0, 1], format_func=lambda x: "No" if x == 0 else "Yes")

if st.button("Predict Risk Level", type="primary"):
    patient_data = {
        'Age': age,
        'Systolic BP': systolic_bp,
        'Diastolic': diastolic_bp,
        'BS': blood_sugar,
        'Body Temp': body_temp,
        'BMI': bmi,
        'Previous Complications': prev_complications,
        'Preexisting Diabetes': preexisting_diabetes,
        'Gestational Diabetes': gestational_diabetes,
        'Mental Health': mental_health,
        'Heart Rate': heart_rate
    }
    
    patient_df = pd.DataFrame([patient_data], columns=feature_columns)
    
    prediction = model.predict(patient_df)[0]
    probability = model.predict_proba(patient_df)[0]
    
    risk_level = label_encoder.inverse_transform([prediction])[0]
    
    # Save to unified medical history
    save_prediction_history(user_id, patient_data, risk_level, float(max(probability)), probability)
    
    st.success("✅ Prediction saved to medical history")
    
    st.header("Prediction Results")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if risk_level == "High":
            st.error(f"🚨 **Risk Level: {risk_level}**")
        else:
            st.success(f"✅ **Risk Level: {risk_level}**")
    
    with col2:
        st.metric("High Risk Probability", f"{probability[1]:.1%}")
    
    with col3:
        st.metric("Low Risk Probability", f"{probability[0]:.1%}")
    
    st.subheader("Risk Factors Analysis")
    
    feature_importance = pd.DataFrame({
        'Feature': feature_columns,
        'Importance': model.feature_importances_,
        'Patient_Value': [patient_data[col] for col in feature_columns]
    }).sort_values('Importance', ascending=False)
    
    st.write("**Model-based Risk Assessment:**")
    if risk_level == "High":
        st.warning(f"The model predicts **{risk_level} Risk** with {probability[1]:.1%} confidence.")
    else:
        st.success(f"The model predicts **{risk_level} Risk** with {probability[0]:.1%} confidence.")
    
    st.write("**Top Contributing Factors (by model importance):**")
    top_features = feature_importance.head(5)
    for _, row in top_features.iterrows():
        importance_pct = row['Importance'] * 100
        st.write(f"• **{row['Feature']}**: {row['Patient_Value']} (Model weight: {importance_pct:.1f}%)")
    
    st.subheader("Recommendations")
    if risk_level == "High":
        st.markdown("""
        **High Risk - Immediate Actions Recommended:**
        - Consult with healthcare provider immediately
        - Regular monitoring of blood pressure and blood sugar
        - Follow prescribed medication regimen
        - Maintain regular prenatal appointments
        - Monitor fetal movements and report any concerns
        """)
    else:
        st.markdown("""
        **Low Risk - Preventive Care:**
        - Continue regular prenatal care
        - Maintain healthy diet and exercise routine
        - Monitor weight gain as recommended
        - Take prenatal vitamins as prescribed
        - Report any unusual symptoms to healthcare provider
        """)

if st.checkbox("Show Feature Importance"):
    st.subheader("Model Feature Importance")
    
    feature_importance = pd.DataFrame({
        'Feature': feature_columns,
        'Importance': model.feature_importances_
    }).sort_values('Importance', ascending=True)
    
    st.bar_chart(feature_importance.set_index('Feature'))

st.markdown("""
---
**Disclaimer:** This prediction model is for educational and informational purposes only. 
It should not replace professional medical advice, diagnosis, or treatment. 
Always consult with qualified healthcare providers for medical decisions.
""")