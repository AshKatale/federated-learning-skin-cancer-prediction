"""
Federated Learning Trainer
Handles local model training for FL clients
Isolated from FL communication logic
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from datetime import datetime
import logging
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(message)s'
)
logger = logging.getLogger(__name__)


class FLTrainer:
    """
    Trainer for local federated learning
    Handles training loops, optimization, and evaluation
    Decoupled from Flower framework
    """
    
    def __init__(
        self,
        model,
        learning_rate=0.001,
        batch_size=32,
        device='cpu'
    ):
        """
        Initialize FL Trainer
        
        Args:
            model: PyTorch model
            learning_rate: Learning rate for optimization
            batch_size: Batch size for training
            device: 'cpu' or 'cuda'
        """
        self.model = model
        self.device = torch.device(device)
        self.learning_rate = learning_rate
        self.batch_size = batch_size
        self.training_history = []
        
        # Optimization components
        self.optimizer = optim.Adam(self.model.parameters(), lr=learning_rate)
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer, mode='min', factor=0.5, patience=3
        )
        self.criterion = nn.CrossEntropyLoss()
        
        self.model.to(self.device)
    
    def train_epoch(self, X_train, y_train, epoch, total_epochs):
        """
        Train for one epoch
        
        Args:
            X_train: Training data tensors
            y_train: Training labels
            epoch: Current epoch number
            total_epochs: Total epochs to train
            
        Returns:
            Epoch loss and accuracy
        """
        self.model.train()
        
        # Create data loader
        dataset = list(zip(X_train, y_train))
        batch_size = min(self.batch_size, len(dataset))
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        epoch_loss = 0.0
        correct = 0
        total = 0
        
        for batch_idx, (batch_X, batch_y) in enumerate(dataloader):
            # Handle list to tensor conversion
            if isinstance(batch_X, list):
                batch_X = torch.stack(batch_X)
            if isinstance(batch_y, list):
                batch_y = torch.tensor(batch_y)
            
            batch_X = batch_X.to(self.device)
            batch_y = batch_y.to(self.device)
            
            # Forward pass
            outputs = self.model(batch_X)
            loss = self.criterion(outputs, batch_y)
            
            # Backward pass
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
            
            # Metrics
            epoch_loss += loss.item()
            _, predicted = outputs.max(1)
            correct += predicted.eq(batch_y).sum().item()
            total += batch_y.size(0)
        
        epoch_loss /= len(dataloader)
        accuracy = 100.0 * correct / total if total > 0 else 0.0
        
        return epoch_loss, accuracy
    
    def train(self, X_train, y_train, epochs=1):
        """
        Train model for multiple epochs
        
        Args:
            X_train: Training data
            y_train: Training labels
            epochs: Number of epochs to train
            
        Returns:
            Training history
        """
        history = []
        
        for epoch in range(epochs):
            loss, accuracy = self.train_epoch(X_train, y_train, epoch + 1, epochs)
            
            entry = {
                'epoch': epoch + 1,
                'loss': loss,
                'accuracy': accuracy,
                'timestamp': datetime.now().isoformat()
            }
            history.append(entry)
            self.training_history.append(entry)
            
            msg = f"[EPOCH {epoch+1}/{epochs}] Loss: {loss:.4f} | Accuracy: {accuracy:.2f}%"
            logger.info(msg)
            print(msg)
            sys.stdout.flush()
        
        return history
    
    def evaluate(self, X_val, y_val):
        """
        Evaluate model on validation data
        
        Args:
            X_val: Validation data
            y_val: Validation labels
            
        Returns:
            Loss and accuracy
        """
        if X_val is None or len(X_val) == 0:
            return 0.0, 0.0
        
        self.model.eval()
        correct = 0
        total = 0
        total_loss = 0.0
        
        with torch.no_grad():
            dataset = list(zip(X_val, y_val))
            dataloader = DataLoader(dataset, batch_size=self.batch_size)
            
            for batch_X, batch_y in dataloader:
                if isinstance(batch_X, list):
                    batch_X = torch.stack(batch_X)
                if isinstance(batch_y, list):
                    batch_y = torch.tensor(batch_y)
                
                batch_X = batch_X.to(self.device)
                batch_y = batch_y.to(self.device)
                
                outputs = self.model(batch_X)
                loss = self.criterion(outputs, batch_y)
                
                total_loss += loss.item()
                _, predicted = outputs.max(1)
                correct += predicted.eq(batch_y).sum().item()
                total += batch_y.size(0)
        
        accuracy = correct / total if total > 0 else 0.0
        avg_loss = total_loss / len(dataloader) if len(dataloader) > 0 else 0.0
        
        logger.info(f"[EVAL] Loss: {avg_loss:.4f} | Accuracy: {accuracy:.4f}")
        
        return avg_loss, accuracy
    
    def get_parameters(self):
        """Get model parameters as numpy arrays"""
        import numpy as np
        return [np.array(p.data.cpu().numpy(), dtype=np.float32) 
                for p in self.model.parameters()]
    
    def set_parameters(self, parameters):
        """Set model parameters from numpy arrays"""
        params_dict = zip(self.model.parameters(), parameters)
        for param, np_param in params_dict:
            param.data.copy_(torch.FloatTensor(np_param).to(self.device))
