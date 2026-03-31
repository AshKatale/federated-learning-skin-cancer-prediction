"""
Federated Learning Model Inference
Load trained global model and make predictions on new data
"""

import torch
import numpy as np
from pathlib import Path
import logging
from PIL import Image

from skin_cancer_model import SkinCancerModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FLModelInference:
    """
    Load and use trained federated learning models for inference
    """
    
    def __init__(self, model_round=None, models_dir='./models/global'):
        """
        Initialize inference with trained model
        
        Args:
            model_round: Specific round number to load (e.g., 5 for round 5)
                        If None, loads the latest round
            models_dir: Directory containing trained models
        """
        self.models_dir = Path(models_dir)
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Initialize model architecture
        self.model_wrapper = SkinCancerModel(device=self.device)
        self.model = self.model_wrapper.model
        self.transform = self.model_wrapper.get_transforms(mode='val')
        
        # Load trained weights
        self.model_round = self._load_trained_weights(model_round)
        logger.info(f"[INFERENCE] Model loaded from round {self.model_round}")
        logger.info(f"[INFERENCE] Using device: {self.device}")
    
    def _load_trained_weights(self, model_round):
        """
        Load trained model weights from saved checkpoint
        
        Args:
            model_round: Specific round or None for latest
            
        Returns:
            Round number that was loaded
        """
        if not self.models_dir.exists():
            logger.warning(f"[INFERENCE] Model directory not found: {self.models_dir}")
            logger.info("[INFERENCE] Using untrained EfficientNet weights")
            return 0
        
        # Find model files
        model_files = sorted(self.models_dir.glob('global_model_round_*.pt'))
        
        if not model_files:
            logger.warning("[INFERENCE] No trained models found in directory")
            logger.info("[INFERENCE] Using untrained EfficientNet weights")
            return 0
        
        # Select which model to load
        if model_round is not None:
            model_path = self.models_dir / f"global_model_round_{model_round}.pt"
            if not model_path.exists():
                logger.warning(f"[INFERENCE] Model round {model_round} not found, using latest")
                model_path = model_files[-1]
                model_round = int(model_path.stem.split('_')[-1])
        else:
            # Load latest round
            model_path = model_files[-1]
            model_round = int(model_path.stem.split('_')[-1])
        
        logger.info(f"[INFERENCE] Loading model from {model_path}")
        
        # Load weights
        try:
            state_dict = torch.load(model_path, map_location=self.device)
            
            # Convert from flat dictionary to model state_dict
            # The saved format is {'layer_0': array, 'layer_1': array, ...}
            # We need to map it back to the actual model parameters
            params = list(self.model.parameters())
            for i, (name, param) in enumerate(state_dict.items()):
                if i < len(params):
                    params[i].data = torch.tensor(param, dtype=torch.float32).to(self.device)
            
            self.model.eval()
            logger.info(f"[INFERENCE] Successfully loaded trained weights")
            return model_round
        except Exception as e:
            logger.error(f"[INFERENCE] Error loading model: {e}")
            logger.info("[INFERENCE] Using untrained EfficientNet weights")
            return 0
    
    def predict_image(self, image_input):
        """
        Make prediction on a single image
        
        Args:
            image_input: PIL Image, image path (str), or numpy array
            
        Returns:
            dict with prediction, confidence, and all class probabilities
        """
        # Convert input to PIL Image
        if isinstance(image_input, str):
            image = Image.open(image_input).convert('RGB')
        elif isinstance(image_input, np.ndarray):
            image = Image.fromarray((image_input * 255).astype(np.uint8)).convert('RGB')
        else:
            image = image_input
        
        # Preprocess
        image_tensor = self.transform(image).unsqueeze(0).to(self.device)
        
        # Predict
        self.model.eval()
        with torch.no_grad():
            outputs = self.model(image_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            predicted_class = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0, predicted_class].item()
        
        # Format result
        class_names = SkinCancerModel.CLASS_NAMES
        result = {
            'predicted_class': predicted_class,
            'predicted_class_name': class_names[predicted_class],
            'confidence': float(confidence),
            'model_round': self.model_round,
            'device': str(self.device),
            'all_probabilities': {
                class_names[i]: float(probabilities[0, i].item())
                for i in range(len(class_names))
            }
        }
        
        return result
    
    def predict_batch(self, image_inputs):
        """
        Make predictions on multiple images
        
        Args:
            image_inputs: List of images (paths, PIL Images, or arrays)
            
        Returns:
            List of prediction results
        """
        results = []
        for image_input in image_inputs:
            try:
                result = self.predict_image(image_input)
                results.append(result)
            except Exception as e:
                logger.error(f"[INFERENCE] Error predicting image: {e}")
                results.append({'error': str(e)})
        
        return results
    
    def get_model_info(self):
        """Get information about the loaded model"""
        return {
            'model_type': 'EfficientNet-B0',
            'num_classes': 7,
            'class_names': SkinCancerModel.CLASS_NAMES,
            'trained_round': self.model_round,
            'device': str(self.device),
            'model_path': str(self.models_dir)
        }


def load_and_predict(image_path, model_round=None):
    """
    Convenience function: Load model and predict on single image
    
    Args:
        image_path: Path to image
        model_round: Which trained round to use (optional)
        
    Returns:
        Prediction result
    """
    inference = FLModelInference(model_round=model_round)
    return inference.predict_image(image_path)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python fl_model_inference.py <image_path> [model_round]")
        print("Example: python fl_model_inference.py test.jpg 5")
        sys.exit(1)
    
    image_path = sys.argv[1]
    model_round = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    # Load model and predict
    inference = FLModelInference(model_round=model_round)
    
    print("\n" + "="*60)
    print("FEDERATED LEARNING MODEL INFERENCE")
    print("="*60)
    print(f"\nModel Info:")
    for key, value in inference.get_model_info().items():
        print(f"  {key}: {value}")
    
    print(f"\nPredicting on: {image_path}")
    result = inference.predict_image(image_path)
    
    print(f"\nPrediction Result:")
    print(f"  Class: {result['predicted_class_name']}")
    print(f"  Confidence: {result['confidence']:.4f}")
    print(f"\nAll Class Probabilities:")
    for class_name, prob in result['all_probabilities'].items():
        print(f"  {class_name}: {prob:.4f}")
