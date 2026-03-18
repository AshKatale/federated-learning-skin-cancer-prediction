"""
Custom Model Example - How to add a new ML model
"""
import numpy as np
from sklearn.neural_network import MLPRegressor
from models.linear_model import FederatedLinearModel


class NeuralNetworkModel(FederatedLinearModel):
    """
    Example: Extend to Neural Network
    Inherits from FederatedLinearModel interface
    """
    
    def __init__(self, input_dim=10, hidden_dim=5):
        """
        Neural network regressor
        Args:
            input_dim: Input features
            hidden_dim: Hidden layer size
        """
        super().__init__(input_dim)
        self.hidden_dim = hidden_dim
        
        # Use MLPRegressor from scikit-learn
        self.model = MLPRegressor(
            hidden_layer_sizes=(hidden_dim,),
            max_iter=1000,
            random_state=42
        )
        self.coef_ = None
        self.intercept_ = None
    
    def train(self, X, y):
        """Train the neural network"""
        self.model.fit(X, y)
        
        # Extract weights (simplified - real MLP has multiple layers)
        self.weights = self.model.coefs_[-1].flatten()
        self.bias = self.model.intercepts_[-1]
        self.is_trained = True
    
    # Inherits other methods from FederatedLinearModel
    def predict(self, X):
        """Predict with neural network"""
        if not self.is_trained:
            self.initialize_random()
        return self.model.predict(X)


# USAGE EXAMPLE:
if __name__ == '__main__':
    # Generate data
    from data.data_generator import DataGenerator
    X_train, y_train = DataGenerator.generate_linear_data(
        n_samples=100, n_features=10, noise=10.0
    )
    
    # Create model
    model = NeuralNetworkModel(input_dim=10, hidden_dim=5)
    
    # Train
    model.train(X_train, y_train)
    
    # Predict
    y_pred = model.predict(X_train[:5])
    print(f"Predictions: {y_pred}")
    
    # Serialize (works with federated server)
    weights = model.serialize_weights()
    print(f"Weights shape: {len(weights['weights'])}")
