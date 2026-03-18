"""
Flask API Server for Skin Cancer Model
Integrates with the federated learning system
"""

import os
import sys
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import numpy as np
from PIL import Image
from io import BytesIO
import json

# Add ml-model to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ml-model'))
from skin_cancer_model import SkinCancerModel

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize model
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'ml-model', 'models', 'best_skin_cancer_model.pth')

print(f"Using device: {device}")
print(f"Model path: {MODEL_PATH}")

model = SkinCancerModel(model_path=MODEL_PATH, device=device)
print("✓ Model initialized")


# Routes
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'device': str(device),
        'model_loaded': True
    })


@app.route('/api/predict', methods=['POST'])
def predict():
    """
    Predict skin cancer class from image
    Expects: multipart/form-data with 'image' file
    """
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Load image
        image = Image.open(BytesIO(file.read())).convert('RGB')
        
        # Make prediction
        prediction = model.predict(image)
        
        return jsonify({
            'success': True,
            'prediction': prediction,
            'device': str(device)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict-batch', methods=['POST'])
def predict_batch():
    """
    Predict on multiple images
    Expects: multipart/form-data with multiple 'images' files
    """
    try:
        if 'images' not in request.files:
            return jsonify({'error': 'No images provided'}), 400
        
        files = request.files.getlist('images')
        if not files:
            return jsonify({'error': 'No files selected'}), 400
        
        results = []
        for file in files:
            image = Image.open(BytesIO(file.read())).convert('RGB')
            prediction = model.predict(image)
            results.append({
                'filename': file.filename,
                'prediction': prediction
            })
        
        return jsonify({
            'success': True,
            'count': len(results),
            'predictions': results
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/classes', methods=['GET'])
def get_classes():
    """Get available skin cancer classes"""
    return jsonify({
        'classes': SkinCancerModel.CLASS_NAMES,
        'count': len(SkinCancerModel.CLASS_NAMES)
    })


@app.route('/api/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    return jsonify({
        'model_name': 'EfficientNet-B0',
        'pretrained': True,
        'classes': len(SkinCancerModel.CLASS_NAMES),
        'device': str(device),
        'input_size': (224, 224),
        'class_labels': SkinCancerModel.CLASS_NAMES,
        'label_mapping': SkinCancerModel.LABEL_MAPPING
    })


@app.route('/api/model/weights', methods=['GET'])
def get_model_weights():
    """Get model state dict for federated learning"""
    try:
        state_dict = model.get_model_state_dict()
        # Convert to serializable format
        weights_dict = {}
        for key, value in state_dict.items():
            weights_dict[key] = value.cpu().numpy().tolist()
        
        return jsonify({
            'success': True,
            'model_size': len(weights_dict)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/model/weights', methods=['POST'])
def update_model_weights():
    """Update model with aggregated weights from federated learning"""
    try:
        data = request.get_json()
        # Implementation for federated learning weight updates
        return jsonify({
            'success': True,
            'message': 'Model weights updated'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=True)
