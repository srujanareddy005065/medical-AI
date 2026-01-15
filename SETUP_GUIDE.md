# 🚀 Medical AI Dashboard - Complete Setup Guide for New Systems

## 📋 Quick Start Checklist

- [ ] **System Requirements Met**
- [ ] **Repository Cloned**
- [ ] **Python Environment Setup**
- [ ] **Node.js Environment Setup**
- [ ] **Dependencies Installed**
- [ ] **Clerk Authentication Configured**
- [ ] **AI Models Verified**
- [ ] **All Services Running**
- [ ] **System Tested**

## 🖥️ System Requirements

### Hardware Requirements
| Component | Minimum | Recommended | Optimal |
|-----------|---------|-------------|----------|
| **CPU** | Intel i5 / AMD Ryzen 5 | Apple M1/M2 | Apple M3/M4 |
| **RAM** | 8GB | 16GB | 32GB+ |
| **Storage** | 5GB free space | 10GB free space | 20GB+ free space |
| **GPU** | None | Apple MPS | Apple MPS |
| **Internet** | Required for setup | Required for Clerk auth | Required |

### Software Requirements
| Software | Version | Purpose |
|----------|---------|----------|
| **macOS** | 11.0+ | Operating System (Recommended) |
| **Python** | 3.8+ | Backend & AI Models |
| **Node.js** | 16.0+ | Frontend Development |
| **npm** | 8.0+ | Package Management |
| **Git** | 2.0+ | Version Control |
| **Modern Browser** | Latest | Chrome, Firefox, Safari, Edge |

### Browser Requirements
- **Camera Access**: For ultrasound image capture
- **JavaScript Enabled**: For React application
- **Local Storage**: For session management
- **CORS Support**: For API communication

## 📥 Step 1: Repository Setup

### Clone the Repository
```bash
# Clone the repository
git clone <repository-url>
cd hackathon15092025

# Verify repository structure
ls -la
# Should see: apps/, frontend/, models/, data/, etc.
```

### Verify Repository Contents
```bash
# Check essential directories
ls apps/          # Should contain: pregnancy_risk_app.py, fetal_plane_app.py
ls frontend/      # Should contain: src/, package.json
ls models/        # Should contain: *.pkl files and fetal_plane_model/
ls config/        # Should contain: requirements.txt
```

## 🐍 Step 2: Python Environment Setup

### Create Virtual Environment (Recommended)
```bash
# Create virtual environment
python3 -m venv medical_ai_env

# Activate virtual environment
source medical_ai_env/bin/activate  # macOS/Linux
# medical_ai_env\Scripts\activate    # Windows

# Verify activation (should show virtual env name)
which python
```

### Install Core Dependencies
```bash
# Install basic requirements
pip install --upgrade pip
pip install -r config/requirements.txt

# Verify installation
pip list | grep -E "streamlit|pandas|numpy|scikit-learn"
```

### Install AI/ML Dependencies
```bash
# Install PyTorch (Apple Silicon optimized)
pip install torch torchvision torchaudio

# Install Transformers for Vision Transformer
pip install transformers

# Install additional ML libraries
pip install plotly  # For visualizations
pip install pillow  # For image processing

# Verify PyTorch installation
python -c "import torch; print('PyTorch version:', torch.__version__)"
python -c "import torch; print('MPS available:', torch.backends.mps.is_available())"
```

### Install API Server Dependencies
```bash
# Install Flask for API server
pip install flask flask-cors

# Verify Flask installation
python -c "import flask; print('Flask version:', flask.__version__)"
```

## 📦 Step 3: Node.js Environment Setup

### Install Node.js (if not installed)
```bash
# Check if Node.js is installed
node --version
npm --version

# If not installed, download from: https://nodejs.org/
# Or use Homebrew on macOS:
brew install node
```

### Setup Frontend Dependencies
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Verify installation
ls node_modules/  # Should contain many packages
npm list --depth=0  # Show installed packages

# Return to project root
cd ..
```

### Verify Frontend Setup
```bash
# Check package.json
cat frontend/package.json | grep -A 10 "dependencies"

# Test build (optional)
cd frontend
npm run build
cd ..
```

## 🔐 Step 4: Clerk Authentication Setup

### Create Clerk Account
1. **Visit**: [https://clerk.com](https://clerk.com)
2. **Sign Up**: Create a new account
3. **Create Application**: 
   - Name: "Medical AI Dashboard"
   - Type: "Web Application"
   - Framework: "React"

### Configure Clerk Application
1. **Authentication Methods**:
   - ✅ Email/Password
   - ✅ Google (optional)
   - ✅ GitHub (optional)

2. **Session Settings**:
   - Session timeout: 24 hours (recommended for medical apps)
   - Require re-authentication for sensitive actions

3. **Security Settings**:
   - Enable two-factor authentication
   - Set strong password requirements
   - Configure session security

### Get API Keys
1. **Navigate**: Clerk Dashboard → API Keys
2. **Copy**: Publishable Key (starts with `pk_test_` or `pk_live_`)
3. **Save**: Keep this key secure

### Configure Environment Variables
```bash
# Create environment file
cd frontend
echo "VITE_CLERK_PUBLISHABLE_KEY=your_publishable_key_here" > .env.local

# Verify file creation
cat .env.local

# Return to project root
cd ..
```

### Update Clerk Configuration (if needed)
```bash
# Check main.tsx for Clerk setup
cat frontend/src/main.tsx | grep -A 5 "ClerkProvider"

# The publishable key should be loaded from environment
```

## 🤖 Step 5: AI Models Verification

### Check Model Files
```bash
# Verify pregnancy risk model files
ls -la models/
# Should see:
# - pregnancy_risk_model.pkl
# - label_encoder.pkl
# - feature_columns.pkl

# Verify fetal plane model files
ls -la models/fetal_plane_model/
# Should see:
# - model.safetensors
# - config.json
# - label_encoder.pkl
# - preprocessor_config.json
```

### Test Model Loading
```bash
# Test pregnancy risk model
python -c "
import joblib
model = joblib.load('models/pregnancy_risk_model.pkl')
print('Pregnancy model loaded successfully')
print('Model type:', type(model))
"

# Test fetal plane model
python -c "
from transformers import ViTForImageClassification
import torch
model = ViTForImageClassification.from_pretrained('models/fetal_plane_model')
print('Fetal plane model loaded successfully')
print('Model config:', model.config.num_labels, 'classes')
"
```

### Download Models (if missing)
```bash
# If models are missing, you may need to train them
# For pregnancy risk model:
cd apps
python pregnancy_risk_prediction.py
cd ..

# For fetal plane model (requires dataset):
# This is more complex and requires the full dataset
# Check the original repository or documentation
```

## 🚀 Step 6: System Testing

### Test Individual Components

#### Test API Server
```bash
# Start API server
python api_server.py &
API_PID=$!

# Test API endpoints
curl http://localhost:8503/api/users
# Should return: []

# Stop API server
kill $API_PID
```

#### Test Frontend
```bash
# Start frontend development server
cd frontend
npm run dev &
FRONTEND_PID=$!

# Check if running
curl http://localhost:5173
# Should return HTML content

# Stop frontend
kill $FRONTEND_PID
cd ..
```

#### Test Streamlit Apps
```bash
# Test pregnancy risk app
cd apps
streamlit run pregnancy_risk_app.py --server.port 8501 &
PREG_PID=$!

# Wait for startup
sleep 5

# Check if running
curl http://localhost:8501
# Should return Streamlit HTML

# Stop app
kill $PREG_PID
cd ..
```

### Full System Test
```bash
# Use the run.txt commands or start each service manually
# Terminal 1:
python api_server.py

# Terminal 2:
cd frontend && npm run dev

# Terminal 3:
cd apps && streamlit run pregnancy_risk_app.py --server.port 8501

# Terminal 4:
cd apps && streamlit run fetal_plane_app.py --server.port 8502
```

### Verify All Services
1. **Frontend**: http://localhost:5173 - Should show dashboard
2. **API Server**: http://localhost:8503/api/users - Should return JSON
3. **Pregnancy App**: http://localhost:8501 - Should show Streamlit app
4. **Fetal App**: http://localhost:8502 - Should show Streamlit app

## 🔧 Step 7: Configuration Optimization

### Apple Silicon Optimization
```bash
# Add to your shell profile (.zshrc, .bash_profile)
echo 'export PYTORCH_ENABLE_MPS_FALLBACK=1' >> ~/.zshrc
source ~/.zshrc

# Verify MPS support
python -c "
import torch
print('MPS available:', torch.backends.mps.is_available())
print('MPS built:', torch.backends.mps.is_built())
"
```

### Memory Optimization
```bash
# For large datasets, increase memory limits
export NODE_OPTIONS="--max-old-space-size=4096"

# For Python, you can limit memory usage
export PYTHONHASHSEED=0
```

### Performance Tuning
```bash
# Create performance configuration
cat > performance_config.sh << 'EOF'
#!/bin/bash
# Performance optimization for Medical AI Dashboard

# Python optimizations
export PYTHONHASHSEED=0
export PYTORCH_ENABLE_MPS_FALLBACK=1

# Node.js optimizations
export NODE_OPTIONS="--max-old-space-size=4096"

# Streamlit optimizations
export STREAMLIT_SERVER_MAX_UPLOAD_SIZE=200
export STREAMLIT_SERVER_MAX_MESSAGE_SIZE=200

echo "Performance optimizations applied"
EOF

chmod +x performance_config.sh
```

## 🧪 Step 8: Functional Testing

### Test Authentication
1. **Open**: http://localhost:5173
2. **Sign Up**: Create a test account
3. **Sign In**: Verify login works
4. **Navigation**: Test page navigation
5. **Sign Out**: Verify logout works

### Test Pregnancy Risk Prediction
1. **Navigate**: To Pregnancy Risk page
2. **Enter Data**: Use sample values:
   - Age: 28
   - BMI: 24.5
   - Systolic BP: 120
   - Diastolic BP: 80
   - Blood Sugar: 7.2
   - Body Temp: 98.6
   - Heart Rate: 75
   - All checkboxes: unchecked
3. **Predict**: Click prediction button
4. **Verify**: Should show "Low Risk" result
5. **History**: Check if saved in history

### Test Fetal Plane Classification
1. **Navigate**: To Fetal Planes page
2. **Upload**: Test image (use sample from datasets/)
3. **Classify**: Click classification button
4. **Verify**: Should show anatomical plane result
5. **History**: Check if saved in history

### Test History Management
1. **Navigate**: To History page
2. **Verify**: Previous predictions/classifications shown
3. **Filter**: Test filtering by type
4. **Search**: Test search functionality
5. **Cleanup**: Test cleanup functionality

## 🛠️ Troubleshooting Common Issues

### Issue 1: Python Import Errors
```bash
# Problem: ModuleNotFoundError
# Solution: Verify virtual environment
source medical_ai_env/bin/activate
pip install -r config/requirements.txt

# Check Python path
which python
python -c "import sys; print(sys.path)"
```

### Issue 2: Node.js Build Errors
```bash
# Problem: npm install fails
# Solution: Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue 3: Port Already in Use
```bash
# Problem: Port 5173, 8501, 8502, or 8503 in use
# Solution: Find and kill processes
lsof -i :5173
lsof -i :8501
lsof -i :8502
lsof -i :8503

# Kill specific process
kill -9 <PID>

# Or use different ports
streamlit run pregnancy_risk_app.py --server.port 8504
```

### Issue 4: Clerk Authentication Errors
```bash
# Problem: Clerk not working
# Solution: Check environment variables
cat frontend/.env.local

# Verify key format (should start with pk_test_ or pk_live_)
# Check Clerk dashboard for correct key
```

### Issue 5: Model Loading Errors
```bash
# Problem: Model files not found
# Solution: Verify model files exist
ls -la models/
ls -la models/fetal_plane_model/

# Check file permissions
chmod 644 models/*.pkl
chmod 644 models/fetal_plane_model/*
```

### Issue 6: MPS Not Available
```bash
# Problem: Apple Silicon acceleration not working
# Solution: Update PyTorch
pip install --upgrade torch torchvision torchaudio

# Verify MPS
python -c "import torch; print(torch.backends.mps.is_available())"

# If still false, check macOS version (requires 12.3+)
```

## 📊 Performance Monitoring

### System Resource Monitoring
```bash
# Monitor CPU and memory usage
top -pid $(pgrep -f "streamlit|python|node")

# Monitor disk usage
df -h
du -sh uploads/

# Monitor network connections
netstat -an | grep -E "5173|8501|8502|8503"
```

### Application Monitoring
```bash
# Check application logs
tail -f ~/.streamlit/logs/streamlit.log

# Monitor API server
curl -s http://localhost:8503/api/users | jq .

# Check frontend console (in browser developer tools)
```

## 🔄 Maintenance Tasks

### Regular Cleanup
```bash
# Clean up old user files (run weekly)
find uploads/ -name "*.png" -mtime +7 -delete
find uploads/ -name "*.jpg" -mtime +7 -delete

# Clean up large history files
find uploads/ -name "medical_history.json" -size +1M
```

### Update Dependencies
```bash
# Update Python packages
pip list --outdated
pip install --upgrade package_name

# Update Node.js packages
cd frontend
npm outdated
npm update
cd ..
```

### Backup Important Data
```bash
# Backup models
tar -czf models_backup_$(date +%Y%m%d).tar.gz models/

# Backup user data (if needed)
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

## 🎯 Next Steps

After successful setup:

1. **📚 Read Documentation**: Review `PROJECT_DOCUMENTATION.md`
2. **🧪 Explore Features**: Test all functionality
3. **🔧 Customize**: Modify for your specific needs
4. **📊 Monitor**: Set up monitoring and logging
5. **🚀 Deploy**: Consider production deployment
6. **🔒 Secure**: Implement additional security measures
7. **📈 Scale**: Plan for increased usage

## 📞 Getting Help

If you encounter issues:

1. **Check Logs**: Look at console output and log files
2. **Verify Setup**: Go through this guide step by step
3. **Test Components**: Isolate the problem to specific components
4. **Check Documentation**: Review detailed documentation
5. **Search Issues**: Look for similar problems online
6. **Create Issue**: Report bugs with detailed information

---

## ✅ Setup Completion Checklist

- [ ] **Repository cloned successfully**
- [ ] **Python virtual environment created and activated**
- [ ] **All Python dependencies installed**
- [ ] **Node.js and npm working**
- [ ] **Frontend dependencies installed**
- [ ] **Clerk authentication configured**
- [ ] **Environment variables set**
- [ ] **AI models verified and loading**
- [ ] **All 4 services can start**
- [ ] **Frontend accessible at localhost:5173**
- [ ] **API server responding at localhost:8503**
- [ ] **Streamlit apps working on ports 8501 and 8502**
- [ ] **Authentication working (sign up/in/out)**
- [ ] **Pregnancy risk prediction working**
- [ ] **Fetal plane classification working**
- [ ] **History management working**
- [ ] **File upload and camera capture working**
- [ ] **Performance optimizations applied**
- [ ] **System tested end-to-end**

**🎉 Congratulations! Your Medical AI Dashboard is ready to use!**

---

*Setup Guide Version: 1.0*  
*Last Updated: January 2025*  
*Platform: macOS with Apple Silicon (Optimized)*  
*Estimated Setup Time: 30-60 minutes*