#!/usr/bin/env python3
"""
Simple API server to serve medical history data and images
Provides endpoints for the frontend to access real history data
"""

import json
import os
from pathlib import Path
from flask import Flask, jsonify, send_file, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Base paths
UPLOADS_DIR = Path("uploads")
FRONTEND_DIR = Path("frontend")

@app.route('/api/history/<user_id>')
def get_user_history(user_id):
    """Get medical history for a specific user"""
    try:
        user_folder = UPLOADS_DIR / user_id
        history_file = user_folder / 'medical_history.json'
        
        if not history_file.exists():
            return jsonify({
                "pregnancyRisk": [],
                "fetalClassification": [],
                "total": 0
            })
        
        with open(history_file, 'r') as f:
            history = json.load(f)
        
        # Filter by type
        pregnancy_risk = [entry for entry in history if entry.get('type') == 'pregnancy_risk']
        fetal_classification = [entry for entry in history if entry.get('type') == 'fetal_classification']
        
        return jsonify({
            "pregnancyRisk": pregnancy_risk,
            "fetalClassification": fetal_classification,
            "total": len(history)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/uploads/<user_id>/<filename>')
def serve_user_image(user_id, filename):
    """Serve images from user-specific folders"""
    try:
        file_path = UPLOADS_DIR / user_id / filename
        if file_path.exists():
            return send_file(file_path)
        else:
            return "File not found", 404
    except Exception as e:
        return str(e), 500

@app.route('/api/users')
def list_users():
    """List all users who have history data"""
    try:
        users = []
        for user_folder in UPLOADS_DIR.glob("user_*"):
            if user_folder.is_dir():
                history_file = user_folder / 'medical_history.json'
                if history_file.exists():
                    users.append(user_folder.name)
        return jsonify(users)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/cleanup/<user_id>')
def cleanup_user_data(user_id):
    """Clean up old files and remove duplicates for a user"""
    try:
        user_folder = UPLOADS_DIR / user_id
        if not user_folder.exists():
            return jsonify({"message": "User folder not found"})
        
        # Remove duplicate images (same size and name pattern)
        image_files = list(user_folder.glob("*.png")) + list(user_folder.glob("*.jpg")) + list(user_folder.glob("*.jpeg"))
        
        duplicates_removed = 0
        file_groups = {}
        
        # Group files by their base name (without timestamp)
        for file_path in image_files:
            # Extract base name after timestamp
            name_parts = file_path.name.split('_', 2)
            if len(name_parts) >= 3:
                base_name = name_parts[2]  # Everything after timestamp
            else:
                base_name = file_path.name
            
            if base_name not in file_groups:
                file_groups[base_name] = []
            file_groups[base_name].append(file_path)
        
        # Keep only the newest file for each group
        for base_name, files in file_groups.items():
            if len(files) > 1:
                # Sort by modification time, keep newest
                files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
                for old_file in files[1:]:
                    old_file.unlink()
                    duplicates_removed += 1
        
        return jsonify({
            "message": f"Cleanup completed. Removed {duplicates_removed} duplicate files.",
            "duplicates_removed": duplicates_removed
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Ensure uploads directory exists
    UPLOADS_DIR.mkdir(exist_ok=True)
    
    print("Starting Medical History API Server...")
    print("Endpoints:")
    print("  GET /api/history/<user_id> - Get user's medical history")
    print("  GET /uploads/<user_id>/<filename> - Serve user images")
    print("  GET /api/users - List users with history data")
    print("  GET /api/cleanup/<user_id> - Clean up duplicate files")
    
    app.run(host='0.0.0.0', port=8503, debug=True)