"""
Flower Federated Learning NumPy Client
DT wrapper between Flower framework and isolated training logic
"""

import flwr as fl
from flwr.client import NumPyClient
import logging
import sys

from fl_trainer import FLTrainer

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(message)s'
)
logger = logging.getLogger(__name__)


class SkinCancerNNClient(NumPyClient):
    """
    Flower NumPy Client for Federated Learning
    Wraps FLTrainer for local training
    Handles communication with Flower server
    """
    
    def __init__(
        self,
        client_id,
        model,
        X_train,
        y_train,
        X_val=None,
        y_val=None,
        learning_rate=0.001,
        batch_size=32,
        device='cpu'
    ):
        """
        Initialize FL NumPy Client
        
        Args:
            client_id: Unique client identifier
            model: PyTorch model
            X_train: Training data
            y_train: Training labels
            X_val: Validation data
            y_val: Validation labels
            learning_rate: Learning rate
            batch_size: Batch size
            device: 'cpu' or 'cuda'
        """
        self.client_id = client_id
        self.X_train = X_train
        self.y_train = y_train
        self.X_val = X_val
        self.y_val = y_val
        self.device = device
        
        # Initialize trainer with model
        self.trainer = FLTrainer(
            model=model,
            learning_rate=learning_rate,
            batch_size=batch_size,
            device=device
        )
        
        logger.info(f"[CLIENT {client_id}] Initialized with {len(X_train)} training samples")
        if X_val is not None:
            logger.info(f"[CLIENT {client_id}] Validation set: {len(X_val)} samples")
    
    def get_parameters(self, config):
        """
        Get current model parameters
        Called by Flower server
        """
        return self.trainer.get_parameters()
    
    def set_parameters(self, parameters):
        """
        Set model parameters from global model
        Called by Flower server with aggregated weights
        """
        self.trainer.set_parameters(parameters)
    
    def fit(self, parameters, config):
        """
        Train model locally
        Called by Flower server at each round
        
        Returns:
            Updated parameters, number of samples, metrics
        """
        # Set global parameters
        self.set_parameters(parameters)
        
        # Get training config
        epochs = config.get('local_epochs', 1)
        
        logger.info(f"\n[CLIENT {self.client_id}] Starting training for {epochs} epoch(s)")
        
        # Train locally using FLTrainer
        self.trainer.train(self.X_train, self.y_train, epochs=epochs)
        
        # Return updated parameters and sample count
        num_samples = len(self.X_train)
        logger.info(f"[CLIENT {self.client_id}] [DONE] Completed training round, returning {num_samples} samples")
        
        return self.trainer.get_parameters(), num_samples, {}
    
    def evaluate(self, parameters, config):
        """
        Evaluate model on validation data
        Called by Flower server
        
        Returns:
            Loss, number of samples, metrics
        """
        if self.X_val is None or len(self.X_val) == 0:
            # No validation set
            return 0.0, len(self.X_train), {}
        
        self.set_parameters(parameters)
        
        loss, accuracy = self.trainer.evaluate(self.X_val, self.y_val)
        
        return loss, len(self.X_val), {"accuracy": accuracy}
