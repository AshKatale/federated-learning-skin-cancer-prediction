"""
Skin Cancer Classification Model using EfficientNet
Integrates with Federated Learning System
"""

import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
import timm
from PIL import Image
import json
from pathlib import Path


class SkinCancerDataset(Dataset):
    """Dataset loader for skin cancer images"""
    
    def __init__(self, dataframe, transform=None):
        self.df = dataframe
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        img_path = self.df.iloc[idx]["path"]
        label = self.df.iloc[idx]["label"]
        
        image = Image.open(img_path).convert("RGB")
        
        if self.transform:
            image = self.transform(image)
        
        return image, label


class SkinCancerModel:
    """Wrapper for skin cancer classification model"""
    
    # Class mapping
    LABEL_MAPPING = {
        'akiec': 0,
        'bcc': 1,
        'bkl': 2,
        'df': 3,
        'mel': 4,
        'nv': 5,
        'vasc': 6
    }
    
    REVERSE_MAPPING = {v: k for k, v in LABEL_MAPPING.items()}
    
    CLASS_NAMES = [
        'Actinic Keratosis',
        'Basal Cell Carcinoma',
        'Benign Keratosis',
        'Dermatofibroma',
        'Melanoma',
        'Nevus',
        'Vascular'
    ]
    
    def __init__(self, model_path=None, device=None):
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = self._build_model()
        self.model_path = model_path
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            print(f"No existing model found at {model_path}. Using untrained model.")
        
        self.model.to(self.device)
    
    def _build_model(self):
        """Build EfficientNet model"""
        model = timm.create_model(
            "efficientnet_b0",
            pretrained=True,
            num_classes=7
        )
        return model
    
    def load_model(self, model_path):
        """Load pre-trained model weights"""
        if os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path, map_location=self.device))
            print(f"Model loaded from {model_path}")
        else:
            print(f"Model file not found: {model_path}")
    
    def save_model(self, model_path):
        """Save model weights"""
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        torch.save(self.model.state_dict(), model_path)
        print(f"Model saved to {model_path}")
    
    def get_transforms(self, mode='val'):
        """Get data transforms"""
        if mode == 'train':
            return transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.RandomHorizontalFlip(),
                transforms.RandomVerticalFlip(),
                transforms.RandomRotation(20),
                transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
        else:
            return transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
    
    def predict(self, image_input):
        """
        Make prediction on a single image
        
        Args:
            image_input: PIL Image or path to image
            
        Returns:
            dict with prediction, confidence, and class name
        """
        self.model.eval()
        
        if isinstance(image_input, str):
            image = Image.open(image_input).convert("RGB")
        else:
            image = image_input
        
        transform = self.get_transforms(mode='val')
        image_tensor = transform(image).unsqueeze(0).to(self.device)
        
        with torch.no_grad():
            outputs = self.model(image_tensor)
            probabilities = torch.softmax(outputs, dim=1)
            predicted_class = torch.argmax(probabilities, dim=1).item()
            confidence = probabilities[0, predicted_class].item()
        
        return {
            'class_id': predicted_class,
            'class_name': self.CLASS_NAMES[predicted_class],
            'confidence': float(confidence),
            'all_probabilities': {
                self.CLASS_NAMES[i]: float(probabilities[0, i].item())
                for i in range(len(self.CLASS_NAMES))
            }
        }
    
    def predict_batch(self, image_paths):
        """Make predictions on multiple images"""
        results = []
        for img_path in image_paths:
            results.append(self.predict(img_path))
        return results
    
    def get_model_state_dict(self):
        """Get model weights for federated learning"""
        return self.model.state_dict()
    
    def set_model_state_dict(self, state_dict):
        """Set model weights from federated learning"""
        self.model.load_state_dict(state_dict)
        self.model.to(self.device)
    
    @staticmethod
    def get_class_names():
        """Get list of class names"""
        return SkinCancerModel.CLASS_NAMES
    
    @staticmethod
    def get_label_mapping():
        """Get label to class mapping"""
        return SkinCancerModel.LABEL_MAPPING
