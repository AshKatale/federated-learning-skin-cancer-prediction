"""
Federated Learning Client
Trains model on local data and communicates with server
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import numpy as np
from models.linear_model import FederatedLinearModel
from utils.metrics import Metrics


class FederatedClient:
    """Client for federated learning"""
    
    def __init__(self, client_id, server_url, X_train, y_train, X_test=None, y_test=None):
        """
        Initialize federated client
        Args:
            client_id: Unique client identifier
            server_url: URL of federated server
            X_train: Training features
            y_train: Training labels
            X_test: Test features (optional)
            y_test: Test labels (optional)
        """
        self.client_id = client_id
        self.server_url = server_url.rstrip('/')
        self.X_train = X_train
        self.y_train = y_train
        self.X_test = X_test
        self.y_test = y_test
        
        self.local_model = FederatedLinearModel(input_dim=X_train.shape[1])
        self.training_history = []
        self.test_history = []
    
    def download_model(self):
        """Download global model from server"""
        try:
            response = requests.get(f'{self.server_url}/get_model', timeout=5)
            response.raise_for_status()
            
            data = response.json()
            weights = data['weights']
            self.local_model.set_weights(weights)
            
            print(f"[{self.client_id}] Downloaded model from round {data['round']}")
            return True
        
        except Exception as e:
            print(f"[{self.client_id}] Error downloading model: {e}")
            return False
    
    def train_local(self, epochs=1):
        """
        Train model on local data
        Args:
            epochs: Number of training epochs
        """
        for epoch in range(epochs):
            self.local_model.train(self.X_train, self.y_train)
            
            # Calculate training metrics
            y_pred_train = self.local_model.predict(self.X_train)
            train_mse = Metrics.mean_squared_error(self.y_train, y_pred_train)
            train_mae = Metrics.mean_absolute_error(self.y_train, y_pred_train)
            
            metrics = {
                'epoch': epoch,
                'train_mse': train_mse,
                'train_mae': train_mae
            }
            
            # Calculate test metrics if available
            if self.X_test is not None:
                y_pred_test = self.local_model.predict(self.X_test)
                test_mse = Metrics.mean_squared_error(self.y_test, y_pred_test)
                test_mae = Metrics.mean_absolute_error(self.y_test, y_pred_test)
                metrics['test_mse'] = test_mse
                metrics['test_mae'] = test_mae
                self.test_history.append(metrics)
            
            self.training_history.append(metrics)
        
        print(f"[{self.client_id}] Local training completed - MSE: {train_mse:.4f}")
    
    def upload_model(self):
        """Upload trained model to server"""
        try:
            weights = self.local_model.serialize_weights()
            num_samples = len(self.X_train)
            
            payload = {
                'client_id': self.client_id,
                'weights': weights,
                'num_samples': num_samples
            }
            
            response = requests.post(
                f'{self.server_url}/update_model',
                json=payload,
                timeout=5
            )
            response.raise_for_status()
            
            data = response.json()
            print(f"[{self.client_id}] Model uploaded - {data['message']}")
            return True
        
        except Exception as e:
            print(f"[{self.client_id}] Error uploading model: {e}")
            return False
    
    def federated_round(self, epochs=1):
        """
        Complete one federated learning round:
        1. Download global model
        2. Train locally
        3. Upload updates
        """
        print(f"\n[{self.client_id}] Starting federated round...")
        
        # Download
        if not self.download_model():
            return False
        
        # Train
        self.train_local(epochs=epochs)
        
        # Upload
        if not self.upload_model():
            return False
        
        return True
    
    def evaluate(self):
        """Evaluate model on test data"""
        if self.X_test is None:
            print(f"[{self.client_id}] No test data available")
            return None
        
        y_pred = self.local_model.predict(self.X_test)
        mse = Metrics.mean_squared_error(self.y_test, y_pred)
        mae = Metrics.mean_absolute_error(self.y_test, y_pred)
        rmse = Metrics.root_mean_squared_error(self.y_test, y_pred)
        r2 = Metrics.r_squared(self.y_test, y_pred)
        
        return {
            'mse': mse,
            'mae': mae,
            'rmse': rmse,
            'r2': r2
        }
    
    def get_training_history(self):
        """Get training history"""
        return self.training_history
