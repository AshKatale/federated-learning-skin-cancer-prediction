"""
Federated Learning Client using Flower
Handles local training, weight updates, and communication with FL server
"""

import flwr as fl
from flwr.client import NumPyClient
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import pandas as pd
from pathlib import Path
import json
import os
import logging
from datetime import datetime


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SkinCancerNNClient(NumPyClient):
    """
    Federated Learning Client for skin cancer detection
    Trains locally and sends updates to FL server
    """
    
    def __init__(
        self,
        client_id,
        X_train,
        y_train,
        X_val=None,
        y_val=None,
        model=None,
        learning_rate=0.001,
        batch_size=32,
        device='cpu'
    ):
        """
        Initialize FL Client
        
        Args:
            client_id: Unique identifier for this client
            X_train: Training data (numpy array or tensor)
            y_train: Training labels
            X_val: Validation data
            y_val: Validation labels
            model: PyTorch model (if None, creates simple CNN)
            learning_rate: Learning rate for optimization
            batch_size: Batch size for local training
            device: 'cpu' or 'cuda'
        """
        self.client_id = client_id
        self.device = torch.device(device)
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.training_history = []
        
        # Prepare data
        self.X_train = torch.FloatTensor(X_train).to(self.device)
        self.y_train = torch.LongTensor(y_train).to(self.device)
        
        if X_val is not None:
            self.X_val = torch.FloatTensor(X_val).to(self.device)
            self.y_val = torch.LongTensor(y_val).to(self.device)
        else:
            self.X_val = None
            self.y_val = None
        
        # Model setup
        self.model = model or self._create_default_model()
        self.model.to(self.device)
        
        # Optimizer and loss
        self.optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        self.criterion = nn.CrossEntropyLoss()
        
        logger.info(f"Client {client_id} initialized with {len(X_train)} samples")
    
    def _create_default_model(self):
        """Create a simple CNN if no model provided"""
        class SimpleCNN(nn.Module):
            def __init__(self, num_classes=7):
                super(SimpleCNN, self).__init__()
                self.conv1 = nn.Conv2d(3, 32, kernel_size=3, padding=1)
                self.conv2 = nn.Conv2d(32, 64, kernel_size=3, padding=1)
                self.pool = nn.MaxPool2d(2, 2)
                self.fc1 = nn.Linear(64 * 56 * 56, 128)
                self.fc2 = nn.Linear(128, num_classes)
                self.relu = nn.ReLU()
                self.dropout = nn.Dropout(0.5)
            
            def forward(self, x):
                x = self.pool(self.relu(self.conv1(x)))
                x = self.pool(self.relu(self.conv2(x)))
                x = x.view(x.size(0), -1)
                x = self.relu(self.fc1(x))
                x = self.dropout(x)
                x = self.fc2(x)
                return x
        
        return SimpleCNN()
    
    def get_parameters(self, config):
        """
        Get model parameters for server
        Called by Flower to retrieve current weights
        """
        return [np.array(p.data.cpu().numpy(), dtype=np.float32) 
                for p in self.model.parameters()]
    
    def set_parameters(self, parameters):
        """
        Set model parameters from global model
        Called by Flower with aggregated weights
        """
        params_dict = zip(self.model.parameters(), parameters)
        for param, np_param in params_dict:
            param.data.copy_(torch.FloatTensor(np_param).to(self.device))
    
    def fit(self, parameters, config):
        """
        Train model locally with new global parameters
        Called by Flower server at each round
        
        Returns:
            Updated parameters and number of training samples
        """
        # Set global parameters
        self.set_parameters(parameters)
        
        # Training configuration
        epochs = config.get('local_epochs', 1)
        
        logger.info(f"Client {self.client_id}: Starting training for {epochs} epochs")
        
        # Create data loader
        dataset = TensorDataset(self.X_train, self.y_train)
        dataloader = DataLoader(
            dataset,
            batch_size=self.batch_size,
            shuffle=True
        )
        
        # Training loop
        self.model.train()
        for epoch in range(epochs):
            epoch_loss = 0.0
            correct = 0
            total = 0
            
            for X_batch, y_batch in dataloader:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)
                
                # Forward pass
                outputs = self.model(X_batch)
                loss = self.criterion(outputs, y_batch)
                
                # Backward pass
                self.optimizer.zero_grad()
                loss.backward()
                self.optimizer.step()
                
                # Metrics
                epoch_loss += loss.item()
                _, predicted = outputs.max(1)
                correct += predicted.eq(y_batch).sum().item()
                total += y_batch.size(0)
            
            epoch_loss /= len(dataloader)
            accuracy = 100. * correct / total
            
            logger.info(
                f"Client {self.client_id} | Epoch {epoch+1}/{epochs} | "
                f"Loss: {epoch_loss:.4f} | Accuracy: {accuracy:.2f}%"
            )
            
            self.training_history.append({
                'epoch': epoch + 1,
                'loss': epoch_loss,
                'accuracy': accuracy
            })
        
        # Return updated parameters and sample count
        return self.get_parameters({}), len(self.X_train), {}
    
    def evaluate(self, parameters, config):
        """
        Evaluate model on validation data
        Optional but recommended for monitoring
        """
        if self.X_val is None:
            return 0.0, len(self.X_train), {}
        
        self.set_parameters(parameters)
        
        self.model.eval()
        correct = 0
        total = 0
        total_loss = 0.0
        
        with torch.no_grad():
            dataset = TensorDataset(self.X_val, self.y_val)
            dataloader = DataLoader(dataset, batch_size=self.batch_size)
            
            for X_batch, y_batch in dataloader:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)
                
                outputs = self.model(X_batch)
                loss = self.criterion(outputs, y_batch)
                
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                correct += predicted.eq(y_batch).sum().item()
                total += y_batch.size(0)
        
        accuracy = correct / total if total > 0 else 0.0
        avg_loss = total_loss / len(dataloader)
        
        logger.info(
            f"Client {self.client_id} Evaluation | "
            f"Loss: {avg_loss:.4f} | Accuracy: {accuracy:.4f}"
        )
        
        return avg_loss, len(self.X_val), {"accuracy": accuracy}


def start_client(
    client_id,
    server_address,
    X_train,
    y_train,
    X_val=None,
    y_val=None,
    learning_rate=0.001
):
    """
    Start a Flower client and connect to server
    
    Args:
        client_id: Client identifier
        server_address: FL server address (e.g., 'localhost:8080')
        X_train: Training data
        y_train: Training labels
        X_val: Validation data (optional)
        y_val: Validation labels (optional)
        learning_rate: Learning rate for local training
    """
    
    logger.info(f"Starting client {client_id}")
    logger.info(f"Connecting to server at {server_address}")
    
    # Create client
    client = SkinCancerNNClient(
        client_id=client_id,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        learning_rate=learning_rate,
        device='cuda' if torch.cuda.is_available() else 'cpu'
    )
    
    # Start Flower client
    try:
        fl.client.start_numpy_client(
            server_address=server_address,
            client=client
        )
    except Exception as e:
        logger.error(f"Client error: {e}")
        raise


if __name__ == "__main__":
    # Example usage
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python fl_client.py <client_id> [server_address]")
        sys.exit(1)
    
    client_id = sys.argv[1]
    server_address = sys.argv[2] if len(sys.argv) > 2 else "localhost:8080"
    
    # Create dummy data for testing
    X_train = np.random.randn(100, 3, 224, 224).astype(np.float32)
    y_train = np.random.randint(0, 7, 100)
    
    start_client(client_id, server_address, X_train, y_train)
