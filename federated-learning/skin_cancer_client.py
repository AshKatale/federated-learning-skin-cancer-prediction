"""
Federated Learning Client for Skin Cancer Model
Trains locally on client data and sends updates to server
"""

import requests
import json
import numpy as np
import torch
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ml-model'))
from skin_cancer_model import SkinCancerModel


class SkinCancerFLClient:
    """Federated Learning Client for Skin Cancer Model"""
    
    def __init__(self, client_id, server_url='http://localhost:5000'):
        self.client_id = client_id
        self.server_url = server_url
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = None
        self.current_round = 0
        
        print(f"Client {client_id} initialized (Device: {self.device})")
    
    def initialize_model(self, model_path=None):
        """Initialize local model"""
        self.model = SkinCancerModel(model_path=model_path, device=self.device)
        print(f"✓ Model initialized for client {self.client_id}")
    
    def register_with_server(self):
        """Register client with federated learning server"""
        try:
            response = requests.post(
                f'{self.server_url}/register',
                json={'client_id': self.client_id}
            )
            if response.status_code == 200:
                print(f"✓ Client {self.client_id} registered with server")
                return True
            else:
                print(f"✗ Failed to register: {response.text}")
                return False
        except Exception as e:
            print(f"✗ Registration error: {e}")
            return False
    
    def download_global_model(self):
        """Download global model from server"""
        try:
            # In actual federated learning, this would download aggregated weights
            print(f"Downloading global model for client {self.client_id}...")
            # Implementation would fetch weights from server
            return True
        except Exception as e:
            print(f"✗ Download error: {e}")
            return False
    
    def train_local(self, train_loader, epochs=5, learning_rate=3e-4):
        """
        Train model locally on client data
        
        Args:
            train_loader: DataLoader with local training data
            epochs: Number of local training epochs
            learning_rate: Learning rate for optimizer
        """
        if self.model is None:
            print("✗ Model not initialized")
            return None
        
        self.model.model.train()
        
        criterion = torch.nn.CrossEntropyLoss()
        optimizer = torch.optim.AdamW(
            self.model.model.parameters(),
            lr=learning_rate,
            weight_decay=1e-4
        )
        
        losses = []
        
        for epoch in range(epochs):
            epoch_loss = 0
            
            for images, labels in train_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                optimizer.zero_grad()
                outputs = self.model.model(images)
                loss = criterion(outputs, labels)
                
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item()
            
            avg_loss = epoch_loss / len(train_loader)
            losses.append(avg_loss)
            print(f"Client {self.client_id} - Epoch {epoch+1}/{epochs}, Loss: {avg_loss:.4f}")
        
        return losses
    
    def get_model_update(self):
        """Get model parameters for sending to server"""
        if self.model is None:
            return None
        
        return self.model.get_model_state_dict()
    
    def apply_global_model(self, global_weights):
        """Apply aggregated global model weights"""
        if self.model is None:
            print("✗ Model not initialized")
            return False
        
        try:
            self.model.set_model_state_dict(global_weights)
            print(f"✓ Global model applied to client {self.client_id}")
            return True
        except Exception as e:
            print(f"✗ Error applying global model: {e}")
            return False
    
    def evaluate_local(self, val_loader):
        """Evaluate model on local validation data"""
        if self.model is None:
            return None
        
        self.model.model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                outputs = self.model.model(images)
                _, predicted = torch.max(outputs, 1)
                
                correct += (predicted == labels).sum().item()
                total += labels.size(0)
        
        accuracy = correct / total
        print(f"Client {self.client_id} Validation Accuracy: {accuracy:.4f}")
        return accuracy
    
    def predict(self, image_path):
        """Make prediction on image"""
        if self.model is None:
            print("✗ Model not initialized")
            return None
        
        return self.model.predict(image_path)
    
    def send_update_to_server(self, round_num):
        """Send local update to federated learning server"""
        try:
            model_update = self.get_model_update()
            
            response = requests.post(
                f'{self.server_url}/client-update',
                json={
                    'client_id': self.client_id,
                    'round': round_num,
                    'num_samples': 100,  # Should be actual local dataset size
                    'model_update': 'serialized_weights'  # In practice, serialize weights
                }
            )
            
            if response.status_code == 200:
                print(f"✓ Client {self.client_id} update sent for round {round_num}")
                return True
            else:
                print(f"✗ Failed to send update: {response.text}")
                return False
        
        except Exception as e:
            print(f"✗ Error sending update: {e}")
            return False
    
    def participate_in_round(self, round_num, train_loader, val_loader=None):
        """Participate in a federated learning round"""
        print(f"\n{'='*60}")
        print(f"Client {self.client_id} - Round {round_num}")
        print(f"{'='*60}")
        
        # Download global model
        self.download_global_model()
        
        # Local training
        self.train_local(train_loader, epochs=5)
        
        # Local evaluation
        if val_loader:
            self.evaluate_local(val_loader)
        
        # Send update to server
        self.send_update_to_server(round_num)
        
        print(f"✓ Round {round_num} complete for client {self.client_id}")
