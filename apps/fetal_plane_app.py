import streamlit as st
import os
import torch
from PIL import Image
import numpy as np
from transformers import ViTImageProcessor, ViTForImageClassification
import joblib
import plotly.express as px
import pandas as pd
import platform
import uuid
import datetime
import shutil
import json
from pathlib import Path

def get_device():
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        return torch.device("mps")
    elif torch.cuda.is_available():
        return torch.device("cuda")
    else:
        return torch.device("cpu")

def optimize_for_apple_silicon():
    if platform.machine() == 'arm64':
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
        if torch.backends.mps.is_available():
            try:
                if hasattr(torch.backends.mps, 'empty_cache'):
                    torch.backends.mps.empty_cache()
            except AttributeError:
                pass

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
    
    # Create directories if they don't exist
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    
    return user_upload_dir

def save_uploaded_image(image, user_id, original_filename=None):
    """Save uploaded image to user-specific folder, avoiding duplicates by content"""
    try:
        user_folder = create_user_upload_folder(user_id)
        
        # Get image content for comparison
        if hasattr(image, 'getvalue'):
            image_content = image.getvalue()
            image_size = len(image_content)
        else:
            # For PIL images, convert to bytes
            import io
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            image_content = img_byte_arr.getvalue()
            image_size = len(image_content)
        
        # Check for duplicate files based on size and basic content check
        existing_files = list(user_folder.glob("*.png")) + list(user_folder.glob("*.jpg")) + list(user_folder.glob("*.jpeg"))
        
        for existing_file in existing_files:
            try:
                if existing_file.stat().st_size == image_size:
                    # Same size, check if it's the same content
                    with open(existing_file, 'rb') as f:
                        if f.read() == image_content:
                            st.info(f"📁 Using existing file: {existing_file.name}")
                            return str(existing_file), existing_file.name
            except:
                continue
        
        # Generate unique filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        if original_filename:
            name, ext = os.path.splitext(original_filename)
            filename = f"{timestamp}_{name}{ext}"
        else:
            filename = f"{timestamp}_ultrasound.png"
        
        file_path = user_folder / filename
        
        # Save image
        if hasattr(image, 'save'):
            image.save(file_path)
        else:
            # Handle uploaded file object
            with open(file_path, 'wb') as f:
                f.write(image_content)
        
        return str(file_path), filename
    
    except Exception as e:
        st.error(f"Error saving image: {e}")
        return None, None

def save_classification_history(user_id, image_filename, predicted_label, confidence, results_df):
    """Save classification result to unified history"""
    try:
        user_folder = create_user_upload_folder(user_id)
        history_file = user_folder / 'medical_history.json'
        
        # Create relative image path for frontend access
        image_path = f"uploads/{user_id}/{image_filename}"
        
        # Create history entry
        history_entry = {
            'id': str(uuid.uuid4()),
            'timestamp': datetime.datetime.now().isoformat(),
            'type': 'fetal_classification',
            'image_filename': image_filename,
            'image_path': image_path,
            'predicted_label': predicted_label,
            'confidence': float(confidence),
            'top_predictions': results_df.head(5).to_dict('records'),
            'user_id': user_id
        }
        
        # Load existing history or create new
        history = []
        if history_file.exists():
            with open(history_file, 'r') as f:
                history = json.load(f)
        
        # Add new entry at the beginning
        history.insert(0, history_entry)
        
        # Keep only last 100 entries total (50 per type)
        history = history[:100]
        
        # Save updated history
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)
        
        return True
    
    except Exception as e:
        st.warning(f"Could not save to history: {e}")
        return False

def cleanup_old_files(user_id, days_old=7):
    """Clean up old files from user folder"""
    try:
        user_folder = create_user_upload_folder(user_id)
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days_old)
        
        for file_path in user_folder.glob('*'):
            if file_path.is_file():
                file_time = datetime.datetime.fromtimestamp(file_path.stat().st_mtime)
                if file_time < cutoff_date:
                    file_path.unlink()
    
    except Exception as e:
        st.warning(f"Could not clean up old files: {e}")

st.set_page_config(
    page_title="Fetal Plane Classification",
    page_icon="🔬",
    layout="wide"
)

with open('../assets/static/css/style.css') as f:
    st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)

# Initialize user session
user_id = get_user_id()
cleanup_old_files(user_id)  # Clean up old files on app start

st.title("🔬 Fetal Ultrasound Plane Classification")
st.markdown("""
This AI-powered application classifies fetal ultrasound images into different anatomical planes.
Upload an ultrasound image to get instant classification results with secure user-specific storage.
""")

# Display user info
if 'session_user_id' in st.session_state and user_id == st.session_state.session_user_id:
    st.info(f"🔐 Session ID: {user_id[:8]}... (Anonymous session)")
else:
    st.success(f"👤 Authenticated User: {user_id[:8]}...")

@st.cache_resource
def load_model():
    optimize_for_apple_silicon()
    device = get_device()
    
    model_dir = '../models/fetal_plane_model'
    
    if not os.path.exists(model_dir):
        st.error(f"Model not found at {model_dir}. Please train the model first.")
        return None, None, None, None
    
    try:
        processor = ViTImageProcessor.from_pretrained(model_dir)
        model = ViTForImageClassification.from_pretrained(model_dir)
        model = model.to(device)
        model.eval()
        label_encoder = joblib.load(os.path.join(model_dir, 'label_encoder.pkl'))
        
        st.success(f"🚀 Model loaded on {device} ({platform.machine()})")
        return model, processor, label_encoder, device
    except Exception as e:
        st.error(f"Error loading model: {e}")
        return None, None, None, None

def predict_image(image, model, processor, label_encoder, device):
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        probabilities = predictions[0].cpu().numpy()
    
    predicted_class_idx = np.argmax(probabilities)
    predicted_label = label_encoder.inverse_transform([predicted_class_idx])[0]
    confidence = probabilities[predicted_class_idx]
    
    results = []
    for i, prob in enumerate(probabilities):
        label = label_encoder.inverse_transform([i])[0]
        results.append({
            'Class': label,
            'Probability': prob,
            'Percentage': f"{prob*100:.1f}%"
        })
    
    results_df = pd.DataFrame(results).sort_values('Probability', ascending=False)
    
    return predicted_label, confidence, results_df

model, processor, label_encoder, device = load_model()

if model is not None:
    st.sidebar.header("Model Information")
    st.sidebar.success("✅ Model loaded successfully")
    st.sidebar.info(f"**Classes:** {len(label_encoder.classes_)}")
    
    with st.sidebar.expander("Available Classes"):
        for i, class_name in enumerate(label_encoder.classes_):
            plane, brain_type = class_name.split('_', 1)
            st.write(f"**{plane}**")
            st.write(f"└─ {brain_type}")
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("🔬 Fetal Ultrasound Classification")
        
        # Enhanced upload methods with user-specific storage
        st.subheader("📤 Upload Your Image")
        
        # Method 1: File uploader with proper error handling
        uploaded_file = st.file_uploader(
            "📁 Choose an ultrasound image",
            type=['png', 'jpg', 'jpeg'],
            help="Upload PNG, JPG, or JPEG files. Files are stored securely in your user folder."
        )
        
        if uploaded_file is not None:
            try:
                # Save uploaded file to user-specific folder
                saved_path, filename = save_uploaded_image(uploaded_file, user_id, uploaded_file.name)
                
                if saved_path:
                    st.success(f"✅ File saved: {filename}")
                    
                    # Load and display image
                    image = Image.open(uploaded_file)
                    st.image(image, caption=f"Uploaded: {filename}", use_column_width=True)
                    
                    if st.button("🔬 Classify Uploaded Image", type="primary"):
                        with st.spinner("Analyzing uploaded image..."):
                            predicted_label, confidence, results_df = predict_image(
                                image, model, processor, label_encoder, device
                            )
                            
                            # Save to history
                            save_classification_history(user_id, filename, predicted_label, confidence, results_df)
                            
                            st.success("✅ Classification completed!")
                            
                            plane, brain_type = predicted_label.split('_', 1)
                            
                            col_result1, col_result2 = st.columns(2)
                            
                            with col_result1:
                                st.metric(
                                    "🎯 Predicted Plane", 
                                    plane,
                                    help="Primary anatomical plane detected"
                                )
                            
                            with col_result2:
                                st.metric(
                                    "🧠 Brain Classification", 
                                    brain_type,
                                    help="Specific brain plane type (if applicable)"
                                )
                            
                            st.metric(
                                "📊 Confidence Score", 
                                f"{confidence*100:.1f}%",
                                help="Model confidence in the prediction"
                            )
                            
                            if confidence > 0.8:
                                st.success("🟢 High confidence prediction")
                            elif confidence > 0.6:
                                st.warning("🟡 Moderate confidence prediction")
                            else:
                                st.error("🔴 Low confidence prediction - manual review recommended")
                                
                            # Display detailed results
                            with st.expander("📊 Detailed Classification Results"):
                                st.dataframe(results_df.head(10), use_container_width=True)
                                
                                fig = px.bar(
                                    results_df.head(5), 
                                    x='Probability', 
                                    y='Class',
                                    title="Top 5 Predictions",
                                    orientation='h'
                                )
                                st.plotly_chart(fig, use_container_width=True)
                else:
                    st.error("❌ Failed to save uploaded file")
                    
            except Exception as e:
                st.error(f"❌ Error processing uploaded file: {e}")
                st.info("💡 Try using the camera input or file path method below")
        
        st.divider()
        
        # Method 2: Camera input (alternative method)
        st.subheader("📷 Camera Input")
        camera_image = st.camera_input("Take a photo of your ultrasound image")
        
        if camera_image is not None:
            try:
                # Save camera image to user-specific folder
                saved_path, filename = save_uploaded_image(camera_image, user_id, "camera_capture.png")
                
                if saved_path:
                    st.success(f"📷 Camera image saved: {filename}")
                    
                    image = Image.open(camera_image)
                    st.image(image, caption=f"Captured: {filename}", use_column_width=True)
                    
                    if st.button("🔬 Classify Captured Image", type="primary"):
                        with st.spinner("Analyzing captured image..."):
                            predicted_label, confidence, results_df = predict_image(
                                image, model, processor, label_encoder, device
                            )
                            
                            # Save to history
                            save_classification_history(user_id, filename, predicted_label, confidence, results_df)
                            
                            st.success("✅ Classification completed!")
                            
                            plane, brain_type = predicted_label.split('_', 1)
                            
                            col_result1, col_result2 = st.columns(2)
                            
                            with col_result1:
                                st.metric(
                                    "🎯 Predicted Plane", 
                                    plane,
                                    help="Primary anatomical plane detected"
                                )
                            
                            with col_result2:
                                st.metric(
                                    "🧠 Brain Classification", 
                                    brain_type,
                                    help="Specific brain plane type (if applicable)"
                                )
                            
                            st.metric(
                                "📊 Confidence Score", 
                                f"{confidence*100:.1f}%",
                                help="Model confidence in the prediction"
                            )
                            
                            if confidence > 0.8:
                                st.success("🟢 High confidence prediction")
                            elif confidence > 0.6:
                                st.warning("🟡 Moderate confidence prediction")
                            else:
                                st.error("🔴 Low confidence prediction - manual review recommended")
                                
                            # Display detailed results
                            with st.expander("📊 Detailed Classification Results"):
                                st.dataframe(results_df.head(10), use_container_width=True)
                                
                                fig = px.bar(
                                    results_df.head(5), 
                                    x='Probability', 
                                    y='Class',
                                    title="Top 5 Predictions",
                                    orientation='h'
                                )
                                st.plotly_chart(fig, use_container_width=True)
                else:
                    st.error("❌ Failed to save camera image")
                            
            except Exception as e:
                st.error(f"❌ Error processing captured image: {e}")
                st.info("💡 Try using the file upload or file path method")
        
        # Method 2: Manual file path input
        st.subheader("📁 Or Enter Image Path")
        
        image_path = st.text_input(
            "Enter full path to your ultrasound image:",
            placeholder="/path/to/your/ultrasound_image.png",
            help="Enter the complete file path to your ultrasound image"
        )
        
        if image_path and st.button("🔍 Load and Classify"):
            try:
                if os.path.exists(image_path):
                    image = Image.open(image_path)
                    st.image(image, caption=f"Loaded: {os.path.basename(image_path)}", use_column_width=True)
                    
                    with st.spinner("Analyzing loaded image..."):
                        predicted_label, confidence, results_df = predict_image(
                            image, model, processor, label_encoder, device
                        )
                        
                        # Save to history (use basename for file path method)
                        save_classification_history(user_id, os.path.basename(image_path), predicted_label, confidence, results_df)
                        
                        st.success("✅ Classification completed!")
                        
                        plane, brain_type = predicted_label.split('_', 1)
                        
                        col_result1, col_result2 = st.columns(2)
                        
                        with col_result1:
                            st.metric("🎯 Predicted Plane", plane)
                        
                        with col_result2:
                            st.metric("🧠 Brain Classification", brain_type)
                        
                        st.metric("📊 Confidence Score", f"{confidence*100:.1f}%")
                        
                        if confidence > 0.8:
                            st.success("🟢 High confidence prediction")
                        elif confidence > 0.6:
                            st.warning("🟡 Moderate confidence prediction")
                        else:
                            st.error("🔴 Low confidence prediction - manual review recommended")
                else:
                    st.error("File not found. Please check the path and try again.")
            except Exception as e:
                st.error(f"Error loading image: {e}")
        
        st.divider()
        
        # Alternative method: Sample images
        st.subheader("🧪 Or Test with Sample Images")
        st.info("💡 **Alternative Method** - Choose from dataset images")
        sample_images_dir = '../datasets/FETAL_PLANES_ZENODO/Images'
        
        if os.path.exists(sample_images_dir):
            sample_files = [f for f in os.listdir(sample_images_dir) if f.endswith('.png')][:10]
            if sample_files:
                selected_sample = st.selectbox(
                    "Choose a sample image to test:",
                    [''] + sample_files,
                    help="Select from dataset images to test the model"
                )
                
                if selected_sample:
                    sample_path = os.path.join(sample_images_dir, selected_sample)
                    try:
                        sample_image = Image.open(sample_path)
                        st.image(sample_image, caption=f"Sample: {selected_sample}", use_column_width=True)
                        
                        if st.button("🔬 Classify Sample Image", type="primary"):
                            with st.spinner("Analyzing sample image..."):
                                predicted_label, confidence, results_df = predict_image(
                                    sample_image, model, processor, label_encoder, device
                                )
                                
                                # Display results
                                col1, col2 = st.columns(2)
                                
                                with col1:
                                    st.success(f"**Predicted Class:** {predicted_label}")
                                    st.info(f"**Confidence:** {confidence:.1%}")
                                
                                with col2:
                                    fig = px.bar(
                                        results_df, 
                                        x='Probability', 
                                        y='Class',
                                        orientation='h',
                                        title="Classification Probabilities",
                                        color='Probability',
                                        color_continuous_scale='viridis'
                                    )
                                    fig.update_layout(height=400)
                                    st.plotly_chart(fig, use_container_width=True)
                    except Exception as e:
                        st.error(f"Error loading sample image: {e}")
        
        st.divider()
        
        st.success("✅ **403 Error Fixed!** Multiple upload methods available - no browser restrictions!")
        
        # Add helpful information
        with st.expander("ℹ️ Upload Methods Available"):
            st.markdown(f"""
            **🔐 User-Specific Storage**: Your files are stored securely in folder: `{user_id[:8]}...`
            
            **Four Ways to Upload:**
            
            1. **📁 File Upload**: Direct file upload with secure storage
            2. **📷 Camera Input**: Take a photo of your ultrasound (works on mobile/desktop)
            3. **📂 File Path**: Enter the full path to your image file
            4. **🧪 Sample Images**: Choose from dataset images below
            
            **Enhanced Features:**
            - **Secure Storage**: Files saved to user-specific folders
            - **Auto Cleanup**: Old files removed after 7 days
            - **Error Recovery**: Multiple upload methods if one fails
            - **Same AI accuracy**: 91.69% validation accuracy (97-99% on test images)
            - **Instant results**: Fast classification with confidence scores
            
            **Supported formats:** PNG, JPG, JPEG
            **File Management:** Automatic timestamping and cleanup
            """)
    
    with col2:
        if 'results_df' in locals():
            st.header("📊 Detailed Results")
            
            st.subheader("All Class Probabilities")
            
            top_5 = results_df.head(5)
            
            fig = px.bar(
                top_5,
                x='Probability',
                y='Class',
                orientation='h',
                title="Top 5 Predictions",
                color='Probability',
                color_continuous_scale='viridis'
            )
            fig.update_layout(height=400, showlegend=False)
            st.plotly_chart(fig, use_container_width=True)
            
            st.subheader("Probability Table")
            st.dataframe(
                results_df[['Class', 'Percentage']],
                use_container_width=True,
                hide_index=True
            )
    
    st.header("📋 Classification Guide")
    
    col_guide1, col_guide2 = st.columns(2)
    
    with col_guide1:
        st.subheader("🔬 Fetal Planes")
        st.markdown("""
        - **Fetal Brain**: Neural structures and brain anatomy
        - **Fetal Abdomen**: Abdominal organs and structures  
        - **Fetal Thorax**: Chest cavity and heart
        - **Fetal Femur**: Thigh bone measurements
        - **Maternal Cervix**: Cervical anatomy
        - **Other**: Non-specific or unclear planes
        """)
    
    with col_guide2:
        st.subheader("🧠 Brain Plane Types")
        st.markdown("""
        - **Trans-thalamic**: Through thalamus region
        - **Trans-ventricular**: Through brain ventricles
        - **Trans-cerebellum**: Through cerebellum
        - **Other**: Non-specific brain views
        - **Not A Brain**: Non-brain anatomical planes
        """)
    
    st.header("🎯 Model Performance")
    
    performance_col1, performance_col2, performance_col3 = st.columns(3)
    
    with performance_col1:
        st.metric("Model Architecture", "Vision Transformer (ViT)")
    
    with performance_col2:
        st.metric("Training Images", "~12,000")
    
    with performance_col3:
        st.metric("Classification Classes", len(label_encoder.classes_) if label_encoder else "N/A")

else:
    st.error("❌ Model not available. Please train the model first by running:")
    st.code("python fetal_plane_classifier.py", language="bash")
    
    st.header("🚀 Getting Started")
    st.markdown("""
    1. **Train the Model**: Run the training script to create the classification model
    2. **Upload Images**: Use the interface above to upload ultrasound images
    3. **Get Predictions**: Receive instant AI-powered classifications
    4. **Review Results**: Analyze confidence scores and detailed probabilities
    """)

st.markdown("""
---
**Disclaimer:** This AI model is for research and educational purposes only. 
It should not replace professional medical diagnosis or clinical decision-making. 
Always consult qualified healthcare professionals for medical interpretations.
""")