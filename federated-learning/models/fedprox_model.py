"""
FedProx Model - Linear Regression with Proximal Term
Implements Federated Learning with Proximal Term (FedProx)
"""
import numpy as np
from sklearn.linear_model import LinearRegression
import pickle


class FedProxModel:
    """Linear regression model with FedProx proximal term"""
    
    def __init__(self, input_dim=10, mu=0.01):
        """
        Initialize the FedProx model
        Args:
            input_dim: Number of input features
            mu: Proximal coefficient (controls strength of proximal term)
                Higher mu keeps local model closer to global model
        """
        self.input_dim = input_dim
        self.mu = mu
        self.model = LinearRegression()
        self.is_trained = False
        self.weights = None
        self.bias = None
        self.global_weights = None
        self.global_bias = None
    
    def initialize_random(self):
        """Initialize with random weights"""
        self.weights = np.random.randn(self.input_dim) * 0.01
        self.bias = 0.0
    
    def set_global_weights(self, global_weights_dict):
        """
        Set the global model weights for proximal term
        Args:
            global_weights_dict: Dictionary with 'weights' and 'bias' keys
        """
        self.global_weights = np.array(global_weights_dict['weights'])
        self.global_bias = float(global_weights_dict['bias'])
    
    def _compute_proximal_loss(self, X, y, w, b):
        """
        Compute loss with proximal term
        Args:
            X: Training features
            y: Training labels
            w: Current weights
            b: Current bias
        Returns:
            Loss value with proximal term
        """
        # Original MSE loss
        predictions = np.dot(X, w) + b
        mse_loss = np.mean((y - predictions) ** 2)
        
        # Proximal term: (mu/2) * ||w - w_global||^2
        if self.global_weights is not None and self.global_bias is not None:
            weight_diff = w - self.global_weights
            bias_diff = b - self.global_bias
            proximal_term = (self.mu / 2) * (
                np.sum(weight_diff ** 2) + bias_diff ** 2
            )
            loss = mse_loss + proximal_term
        else:
            loss = mse_loss
        
        return loss
    
    def train(self, X, y, learning_rate=0.01, epochs=1):
        """
        Train the model on local data using gradient descent with proximal term
        Args:
            X: Training features (n_samples, input_dim)
            y: Training labels (n_samples,)
            learning_rate: Learning rate for gradient descent
            epochs: Number of training epochs
        """
        if self.weights is None:
            self.initialize_random()
        
        n_samples = X.shape[0]
        
        for epoch in range(epochs):
            # Compute predictions
            predictions = np.dot(X, self.weights) + self.bias
            
            # Compute error
            error = predictions - y
            
            # Compute gradients for MSE loss
            dw = (2.0 / n_samples) * np.dot(X.T, error)
            db = (2.0 / n_samples) * np.sum(error)
            
            # Add proximal term gradients if global weights are available
            if self.global_weights is not None and self.global_bias is not None:
                # Proximal gradient: mu * (w - w_global)
                dw += self.mu * (self.weights - self.global_weights)
                db += self.mu * (self.bias - self.global_bias)
            
            # Update weights and bias
            self.weights -= learning_rate * dw
            self.bias -= learning_rate * db
        
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
    
    def get_proximal_info(self):
        """Get information about proximal term"""
        if self.global_weights is not None:
            proximal_distance = np.linalg.norm(
                self.weights - self.global_weights
            )
            return {
                'mu': self.mu,
                'distance_to_global': float(proximal_distance),
                'proximal_term': float((self.mu / 2) * (proximal_distance ** 2))
            }
        return {'mu': self.mu, 'distance_to_global': None, 'proximal_term': None}
    
    def save_model(self, filepath):
        """Save model to file"""
        data = {
            'weights': self.weights,
            'bias': self.bias,
            'input_dim': self.input_dim,
            'mu': self.mu,
            'global_weights': self.global_weights,
            'global_bias': self.global_bias
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
        self.mu = data.get('mu', 0.01)
        self.global_weights = data.get('global_weights')
        self.global_bias = data.get('global_bias')
        self.is_trained = True
