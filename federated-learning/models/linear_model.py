"""
Simple Linear Regression Model
"""
import numpy as np
from sklearn.linear_model import LinearRegression
import pickle
import json


class FederatedLinearModel:
    """Linear regression model for federated learning"""
    
    def __init__(self, input_dim=10):
        """
        Initialize the model
        Args:
            input_dim: Number of input features
        """
        self.input_dim = input_dim
        self.model = LinearRegression()
        self.is_trained = False
        self.weights = None
        self.bias = None
    
    def initialize_random(self):
        """Initialize with random weights"""
        self.weights = np.random.randn(self.input_dim) * 0.01
        self.bias = 0.0
    
    def train(self, X, y):
        """
        Train the model on local data
        Args:
            X: Training features (n_samples, input_dim)
            y: Training labels (n_samples,)
        """
        self.model.fit(X, y)
        self.weights = self.model.coef_.copy()
        self.bias = self.model.intercept_
        self.is_trained = True
    
    def predict(self, X):
        """
        Make predictions
        Args:
            X: Features (n_samples, input_dim)
        Returns:
            Predictions (n_samples,)
        """
        if not self.is_trained and self.weights is None:
            self.initialize_random()
        
        return np.dot(X, self.weights) + self.bias
    
    def get_weights(self):
        """Get model weights as numpy arrays"""
        if self.weights is None:
            self.initialize_random()
        return {
            'weights': self.weights.copy(),
            'bias': float(self.bias)
        }
    
    def set_weights(self, weights_dict):
        """
        Set model weights
        Args:
            weights_dict: Dictionary with 'weights' and 'bias' keys
        """
        self.weights = np.array(weights_dict['weights'])
        self.bias = float(weights_dict['bias'])
        self.is_trained = True
    
    def serialize_weights(self):
        """Serialize weights to JSON-compatible format"""
        if self.weights is None:
            self.initialize_random()
        
        return {
            'weights': self.weights.tolist(),
            'bias': float(self.bias)
        }
    
    @staticmethod
    def deserialize_weights(weights_dict):
        """Deserialize weights from JSON format"""
        return {
            'weights': np.array(weights_dict['weights']),
            'bias': float(weights_dict['bias'])
        }
    
    def save_model(self, filepath):
        """Save model to file"""
        data = {
            'weights': self.weights,
            'bias': self.bias,
            'input_dim': self.input_dim
        }
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
    
    def load_model(self, filepath):
        """Load model from file"""
        with open(filepath, 'rb') as f:
            data = pickle.load(f)
        self.weights = data['weights']
        self.bias = data['bias']
        self.input_dim = data['input_dim']
        self.is_trained = True
