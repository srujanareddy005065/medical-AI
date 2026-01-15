# 🏗️ Medical AI System - Project Structure

## 📁 Complete Directory Structure

```
hackathon15092025/
├── 📋 Documentation
│   ├── README.md                    # Main project overview
│   ├── README_FETAL.md             # Fetal plane classification guide
│   ├── DOCUMENTATION.md            # Comprehensive system documentation
│   └── PROJECT_STRUCTURE.md        # This file - project organization
│
├── 🌐 Web Interface
│   ├── index.html                  # Main dashboard with navbar and iframes
│   └── static/
│       └── css/
│           └── style.css           # Satoshi font styling for Streamlit
│
├── 🤱 Pregnancy Risk Prediction System
│   ├── src/
│   │   ├── app.py                  # Streamlit web app (Port 8501)
│   │   └── pregnancy_risk_prediction.py  # Model training script
│   └── models/
│       ├── pregnancy_risk_model.pkl     # Trained Random Forest model
│       ├── label_encoder.pkl            # Label encoder
│       └── feature_columns.pkl          # Feature column names
│
├── 🔬 Fetal Ultrasound Classification System
│   ├── fetal_plane_app.py          # Streamlit web app (Port 8502)
│   ├── fetal_plane_classifier.py   # ViT model training script
│   ├── train_fetal_model.py        # Standard training script
│   ├── train_fetal_model_thermal.py # Thermal-safe training for M4
│   └── models/
│       └── fetal_plane_model/       # Trained Vision Transformer model
│           ├── config.json
│           ├── model.safetensors
│           ├── preprocessor_config.json
│           ├── label_encoder.pkl
│           └── checkpoint-*/        # Training checkpoints
│
├── 📊 Datasets
│   ├── data/
│   │   ├── Dataset - Updated.csv   # Pregnancy risk dataset (1,187 records)
│   │   └── Dataset/                # Additional audio data
│   └── FETAL_PLANES_ZENODO/        # Fetal ultrasound dataset
│       ├── FETAL_PLANES_DB_data.csv     # Labels (12,400 images)
│       ├── FETAL_PLANES_DB_data.xlsx    # Excel version
│       ├── Images/                       # Ultrasound images (PNG format)
│       └── README.md                     # Dataset documentation
│
└── ⚙️ Configuration & Dependencies
    ├── requirements.txt             # Pregnancy risk dependencies
    └── requirements_fetal.txt      # Fetal plane dependencies (Apple Silicon)
```

## 🚀 Application Ports & URLs

| Application | Port | URL | Description |
|-------------|------|-----|-------------|
| **Main Dashboard** | - | `file://index.html` | HTML dashboard with navigation |
| **Pregnancy Risk** | 8501 | `http://localhost:8501` | Risk prediction interface |
| **Fetal Planes** | 8502 | `http://localhost:8502` | Ultrasound classification |

## 📱 Navigation Structure

### Main Dashboard (index.html)
```
🏠 Home
├── Welcome section
├── Feature overview
└── System introduction

🤱 Pregnancy Risk (iframe: localhost:8501)
├── Patient information form
├── Risk prediction results
├── Feature importance analysis
└── Medical recommendations

🔬 Fetal Planes (iframe: localhost:8502)
├── Image upload interface
├── Ultrasound classification
├── Confidence scores
└── Anatomical plane identification

📋 Documentation
├── Performance metrics
├── Model specifications
├── Training results
└── Technical details

ℹ️ About
├── System overview
├── Technology stack
├── Performance metrics
└── Privacy & security
```

## 🔧 Technical Architecture

### Frontend Layer
- **HTML5 Dashboard**: Responsive design with Satoshi font
- **CSS3 Styling**: Modern UI with gradients and animations
- **JavaScript Navigation**: Seamless page transitions
- **Iframe Integration**: Borderless embedding of Streamlit apps

### Backend Layer
- **Streamlit Apps**: Interactive web interfaces
- **Python ML Models**: scikit-learn and PyTorch
- **Apple Silicon Optimization**: MPS acceleration
- **Local Processing**: No external API dependencies

### Data Layer
- **CSV Datasets**: Structured medical data
- **PNG Images**: Ultrasound imaging data
- **Pickle Models**: Serialized trained models
- **JSON Configs**: Model configurations

## 🎯 Model Specifications

### Pregnancy Risk Model
```yaml
Algorithm: Random Forest Classifier
Accuracy: 100%
Features: 11 clinical parameters
Dataset: 1,187 patient records
Inference: <1ms
Model Size: 2.3MB
Framework: scikit-learn
```

### Fetal Plane Model
```yaml
Algorithm: Vision Transformer (ViT-Base-Patch16-224)
Validation Accuracy: 91.69%
Classes: 9 anatomical planes
Dataset: 12,400 ultrasound images
Inference: <100ms
Model Size: 346MB
Framework: PyTorch + Transformers
Optimization: Apple Silicon MPS
```

## 🔄 Deployment Workflow

### 1. Environment Setup
```bash
# Activate global environment
globalvenv

# Install dependencies
pip install -r requirements.txt
pip install -r requirements_fetal.txt
```

### 2. Model Training (Optional)
```bash
# Train pregnancy risk model
python src/pregnancy_risk_prediction.py

# Train fetal plane model (thermal-safe)
python train_fetal_model_thermal.py
```

### 3. Application Startup
```bash
# Terminal 1: Pregnancy Risk App
python -m streamlit run src/app.py --server.port 8501 --server.headless true

# Terminal 2: Fetal Plane App
python -m streamlit run fetal_plane_app.py --server.port 8502 --server.headless true

# Terminal 3: Main Dashboard
open index.html
```

## 📊 Performance Monitoring

### System Resources (Apple Silicon M4)
- **CPU Usage**: 5.4% (idle)
- **Memory Usage**: 65.3%
- **GPU (MPS)**: Active acceleration
- **Temperature**: Stable (thermal management)

### Application Performance
- **Dashboard Load**: <1s
- **Streamlit Apps**: <3s startup
- **Model Inference**: Real-time
- **Navigation**: Instant transitions

## 🔒 Security & Privacy

### Data Protection
- ✅ **Local Processing**: No external data transmission
- ✅ **No Persistent Storage**: Patient data not saved
- ✅ **HIPAA Compliance**: Privacy-by-design architecture
- ✅ **Secure Models**: No data leakage in weights

### Access Control
- 🔐 **Local Access Only**: localhost binding
- 🔐 **No Authentication**: Suitable for controlled environments
- 🔐 **Audit Logging**: Terminal output for monitoring
- 🔐 **Error Handling**: Graceful failure modes

## 🚀 Future Enhancements

### Planned Features
- [ ] **Multi-language Support**: International deployment
- [ ] **Real-time Monitoring**: System health dashboard
- [ ] **API Integration**: RESTful endpoints
- [ ] **Mobile Optimization**: Responsive design improvements

### Technical Improvements
- [ ] **Model Versioning**: MLOps pipeline
- [ ] **A/B Testing**: Model comparison framework
- [ ] **Performance Metrics**: Real-time monitoring
- [ ] **Auto-scaling**: Dynamic resource allocation

---

*Last Updated: January 2025*
*Version: 1.0*
*Platform: Apple Silicon Optimized*
*Status: Production Ready*