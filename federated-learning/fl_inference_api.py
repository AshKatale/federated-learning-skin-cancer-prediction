"""
Federated Learning Model Inference API
Flask server for serving predictions from trained FL models
Integrate with Node.js Express backend
"""

from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import os
import sys
from pathlib import Path

# Add federated-learning to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'federated-learning'))

from fl_model_inference import FLModelInference

# Flask app configuration
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize inference model (loads on startup)
inference = None

def init_model():
    """Initialize the FL inference model on app startup"""
    global inference
    try:
        print("[INIT] Loading Federated Learning model...")
        inference = FLModelInference(model_round=None)
        print("[INIT] Model loaded successfully!")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to load model: {e}")
        return False


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'fl-inference-api',
        'model_loaded': inference is not None
    }), 200


@app.route('/api/fl-model-info', methods=['GET'])
def get_model_info():
    """Get information about the loaded FL model"""
    if inference is None:
        return jsonify({
            'success': False,
            'error': 'Model not loaded'
        }), 503
    
    try:
        info = inference.get_model_info()
        return jsonify({
            'success': True,
            'model_info': info
        }), 200
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/fl-predict', methods=['POST'])
def predict():
    """
    Predict skin cancer type using trained FL model
    
    Parameters:
        image: Image file (multipart/form-data)
        model_round: (optional) Specific training round to use
        
    Returns:
        JSON with prediction result
    """
    if inference is None:
        return jsonify({
            'success': False,
            'error': 'Model not initialized'
        }), 503
    
    try:
        # Check if image in request
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image provided'
            }), 400
        
        image_file = request.files['image']
        
        if image_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No image selected'
            }), 400
        
        # Get model round if specified
        model_round = request.form.get('model_round', type=int)
        
        # Save file temporarily
        filename = secure_filename(image_file.filename)
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{filename}')
        image_file.save(temp_path)
        
        try:
            # Make prediction
            result = inference.predict_image(temp_path)
            
            # Return result
            return jsonify({
                'success': True,
                'result': result
            }), 200
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)
    
    except Exception as e:
        print(f"[ERROR] Prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/fl-batch-predict', methods=['POST'])
def batch_predict():
    """
    Predict multiple images at once
    
    Parameters:
        images: Multiple image files (multipart/form-data)
        model_round: (optional) Specific training round to use
        
    Returns:
        JSON with prediction results
    """
    if inference is None:
        return jsonify({
            'success': False,
            'error': 'Model not initialized'
        }), 503
    
    try:
        if 'images' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No images provided'
            }), 400
        
        image_files = request.files.getlist('images')
        
        if len(image_files) == 0:
            return jsonify({
                'success': False,
                'error': 'No images selected'
            }), 400
        
        # Get model round if specified
        model_round = request.form.get('model_round', type=int)
        
        results = []
        
        # Process each image
        for image_file in image_files:
            if image_file.filename == '':
                continue
            
            try:
                # Save temporarily
                filename = secure_filename(image_file.filename)
                temp_path = os.path.join(app.config['UPLOAD_FOLDER'], f'temp_{filename}')
                image_file.save(temp_path)
                
                try:
                    # Predict
                    result = inference.predict_image(temp_path)
                    results.append({
                        'filename': image_file.filename,
                        'success': True,
                        'result': result
                    })
                finally:
                    if os.path.exists(temp_path):
                        os.remove(temp_path)
            except Exception as e:
                results.append({
                    'filename': image_file.filename,
                    'success': False,
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'results': results,
            'summary': {
                'total': len(results),
                'successful': sum(1 for r in results if r['success']),
                'failed': sum(1 for r in results if not r['success'])
            }
        }), 200
    
    except Exception as e:
        print(f"[ERROR] Batch prediction error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    print("="*60)
    print("FEDERATED LEARNING INFERENCE API")
    print("="*60)
    
    # Initialize model
    if not init_model():
        print("[WARNING] Starting without model - will use untrained weights")
    
    # Start Flask server
    port = int(os.getenv('FL_INFERENCE_PORT', 5001))
    print(f"\n[START] Starting server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
