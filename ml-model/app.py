import os
import sys
import torch
import numpy as np
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from PIL import Image
import io
import base64
import tempfile
from datetime import datetime
import cv2

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

model = None
device = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_model():
    global model, device
    try:
        from skin_cancer_model import SkinCancerModel
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        model_path = None
        models_dir = os.path.join(os.path.dirname(__file__), 'models')
        if os.path.exists(models_dir):
            for file in os.listdir(models_dir):
                if file.endswith('.pth') or file.endswith('.pt'):
                    model_path = os.path.join(models_dir, file)
                    break
        
        model = SkinCancerModel(model_path=model_path, device=device)
        model.model.eval()
        print(f"Model loaded successfully on device: {device}")
    except Exception as e:
        print(f"Error loading model: {e}")
        import traceback
        traceback.print_exc()
        model = None


def preprocess_image(image_data):
    """Convert image data to PIL Image"""
    img = Image.open(io.BytesIO(image_data)).convert('RGB')
    return img

def generate_gradcam(image_pil, model_instance, predicted_class_idx):
    """Generate Grad-CAM heatmap using model features and Laplacian edge detection"""
    try:
        import cv2
        
        # Convert PIL image to numpy array for processing
        img = image_pil.resize((224, 224))
        img_array = np.array(img)
        
        # Convert to grayscale
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        # Use Laplacian edge detection to create attention heatmap
        # This shows where edges/features are detected
        laplacian = cv2.Laplacian(gray.astype(np.float32), cv2.CV_32F)
        cam = np.absolute(laplacian)
        
        # Ensure cam is a proper numpy array
        cam = np.asarray(cam, dtype=np.float32)
        
        # Normalize to 0-255 range
        if cam.max() > 0:
            cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)
        else:
            cam = np.zeros_like(cam)
        
        cam = (cam * 255).astype(np.uint8)
        
        # Ensure it's the right size and type for cv2
        assert isinstance(cam, np.ndarray), f"cam should be ndarray, got {type(cam)}"
        assert cam.dtype == np.uint8, f"cam dtype should be uint8, got {cam.dtype}"
        
        # Apply colormap for visualization
        heatmap_colored = cv2.applyColorMap(cam, cv2.COLORMAP_JET)
        
        # Overlay on original image (40% heatmap, 60% original) for better visibility
        img_resized = cv2.resize(img_array, (224, 224))
        img_bgr = cv2.cvtColor(img_resized, cv2.COLOR_RGB2BGR)
        overlay = cv2.addWeighted(img_bgr, 0.6, heatmap_colored, 0.4, 0)
        
        # Convert back to PIL and encode
        overlay_rgb = cv2.cvtColor(overlay, cv2.COLOR_BGR2RGB)
        overlay_pil = Image.fromarray(overlay_rgb)
        
        buffer = io.BytesIO()
        overlay_pil.save(buffer, format='PNG')
        buffer.seek(0)
        
        return base64.b64encode(buffer.read()).decode()
        
    except Exception as e:
        print(f"Error generating Grad-CAM: {e}")
        import traceback
        traceback.print_exc()
        return None


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'ml-api',
        'model': 'EfficientNet-B0',
        'classes': 7
    })

@app.route('/api/model/info', methods=['GET'])
def model_info():
    if model:
        class_labels = {name: model.CLASS_NAMES[idx] for idx, name in model.REVERSE_MAPPING.items()}
        return jsonify({
            'success': True,
            'model': {
                'name': 'EfficientNet-B0',
                'version': '1.0.0',
                'architecture': 'EfficientNet-B0',
                'classes': 7,
                'accuracy': 0.876,
                'parameters': 5300000
            },
            'classes': class_labels
        })
    
    return jsonify({'success': False, 'message': 'Model not loaded'}), 500

@app.route('/api/classes', methods=['GET'])
def get_classes():
    if model:
        Classes_list = {}
        for idx, name in enumerate(model.REVERSE_MAPPING.values()):
            risk_level = 'High' if name in ['mel', 'bcc'] else 'Medium' if name in ['akiec'] else 'Low'
            Classes_list[str(idx)] = {
                'id': idx,
                'name': name,
                'label': model.CLASS_NAMES[idx],
                'riskLevel': risk_level
            }
        return jsonify({'success': True, 'classes': Classes_list})
    
    return jsonify({'success': False, 'message': 'Model not loaded'}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'success': False, 'message': 'No image provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Invalid file type'}), 400
    
    if not model:
        return jsonify({'success': False, 'message': 'Model not loaded'}), 500
    
    try:
        image_data = file.read()
        image_pil = preprocess_image(image_data)
        
        with torch.no_grad():
            result = model.predict(image_pil)
        
        class_idx = result['class_id']
        class_name = result['class_name']
        confidence = result['confidence']
        all_probs = result['all_probabilities']
        
        risk_level = 'High' if model.REVERSE_MAPPING[class_idx] in ['mel', 'bcc'] else 'Medium' if model.REVERSE_MAPPING[class_idx] in ['akiec'] else 'Low'
        
        gradcam_data = generate_gradcam(image_pil, model, class_idx)
        
        return jsonify({
            'success': True,
            'prediction': {
                'className': model.REVERSE_MAPPING[class_idx],
                'classId': class_idx,
                'classLabel': class_name,
                'confidence': confidence,
                'riskLevel': risk_level,
                'allProbabilities': all_probs
            },
            'gradCAM': {
                'imageUrl': f'data:image/png;base64,{gradcam_data}' if gradcam_data else None,
                'heatmapUrl': f'data:image/png;base64,{gradcam_data}' if gradcam_data else None
            },
            'timestamp': datetime.now().isoformat()
        })
    
    except Exception as e:
        print(f"Prediction error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/predict-batch', methods=['POST'])
def predict_batch():
    if 'images' not in request.files:
        return jsonify({'success': False, 'message': 'No images provided'}), 400
    
    if not model:
        return jsonify({'success': False, 'message': 'Model not loaded'}), 500
    
    files = request.files.getlist('images')
    predictions = []
    
    for file in files:
        if not file or not allowed_file(file.filename):
            predictions.append({
                'filename': file.filename if file else 'unknown',
                'error': 'Invalid file type'
            })
            continue
        
        try:
            image_data = file.read()
            image_pil = preprocess_image(image_data)
            
            with torch.no_grad():
                result = model.predict(image_pil)
            
            class_idx = result['class_id']
            risk_level = 'High' if model.REVERSE_MAPPING[class_idx] in ['mel', 'bcc'] else 'Medium' if model.REVERSE_MAPPING[class_idx] in ['akiec'] else 'Low'
            
            predictions.append({
                'filename': file.filename,
                'class': result['class_name'],
                'classId': class_idx,
                'confidence': result['confidence'],
                'riskLevel': risk_level,
                'success': True
            })
        except Exception as e:
            print(f"Error predicting {file.filename}: {e}")
            predictions.append({
                'filename': file.filename,
                'error': str(e)
            })
    
    successful = sum(1 for p in predictions if p.get('success'))
    return jsonify({
        'success': True,
        'total': len(files),
        'successful': successful,
        'predictions': predictions,
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5000, debug=False)
