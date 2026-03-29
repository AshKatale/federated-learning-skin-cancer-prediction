"""
Client Simulator for Federated Learning
Simulates multiple clients with different data distributions
Used for testing and demonstration without real hospital networks
"""

import numpy as np
import pandas as pd
from pathlib import Path
import os
import logging
import json
from datetime import datetime
import hashlib
import subprocess
import time
import threading
from typing import List, Tuple
import sqlite3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ClientSimulator:
    """Simulates multiple FL clients with heterogeneous data"""
    
    def __init__(
        self,
        num_clients: int = 3,
        data_dir: str = './uploads',
        iid: bool = False,
        alpha: float = 0.1
    ):
        """
        Initialize client simulator
        
        Args:
            num_clients: Number of clients to simulate
            data_dir: Directory containing training data
            iid: If True, distribute data uniformly (IID)
                 If False, use Dirichlet distribution (non-IID)
            alpha: Dirichlet parameter for non-IID distribution (lower = more heterogeneous)
        """
        self.num_clients = num_clients
        self.data_dir = Path(data_dir)
        self.iid = iid
        self.alpha = alpha
        self.client_data = {}
        self.db_path = Path('./client_simulation.db')
        
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for tracking client data and usage"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables if not exist
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS image_metadata (
                    id INTEGER PRIMARY KEY,
                    filename TEXT UNIQUE NOT NULL,
                    hash TEXT UNIQUE,
                    path TEXT,
                    label INTEGER,
                    used_for_training BOOLEAN DEFAULT 0,
                    client_id INTEGER,
                    training_round INTEGER,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS client_data_distribution (
                    client_id INTEGER PRIMARY KEY,
                    num_samples INTEGER,
                    class_distribution TEXT,
                    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS training_rounds (
                    round_id INTEGER PRIMARY KEY,
                    round_number INTEGER,
                    client_id INTEGER,
                    num_samples INTEGER,
                    status TEXT DEFAULT 'pending',
                    metrics TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            conn.close()
            logger.info("Database initialized")
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
    
    def load_data_from_directory(self) -> Tuple[np.ndarray, np.ndarray]:
        """
        Load images from upload directory
        Returns flattened image arrays and labels
        """
        try:
            images = []
            labels = []
            
            if not self.data_dir.exists():
                logger.warning(f"Data directory {self.data_dir} not found")
                return np.array([]), np.array([])
            
            # Scan directory for images
            image_extensions = {'.jpg', '.jpeg', '.png', '.bmp'}
            
            for file_path in self.data_dir.rglob('*'):
                if file_path.suffix.lower() in image_extensions:
                    try:
                        from PIL import Image
                        img = Image.open(file_path).convert('RGB')
                        img_array = np.array(img)
                        images.append(img_array)
                        
                        # Extract label from filename or parent directory
                        label = self._extract_label(file_path)
                        labels.append(label)
                        
                        # Log image hash for deduplication
                        self._log_image_hash(file_path)
                    except Exception as e:
                        logger.warning(f"Could not load image {file_path}: {e}")
            
            if len(images) == 0:
                logger.warning("No images found in data directory")
                return np.array([]), np.array([])
            
            # Stack and normalize images
            X = np.array(images, dtype=np.float32) / 255.0
            y = np.array(labels, dtype=np.int64)
            
            logger.info(f"Loaded {len(X)} images from {self.data_dir}")
            return X, y
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return np.array([]), np.array([])
    
    def _extract_label(self, file_path: Path) -> int:
        """Extract label from file path"""
        label_mapping = {
            'akiec': 0, 'bcc': 1, 'bkl': 2,
            'df': 3, 'mel': 4, 'nv': 5, 'vasc': 6
        }
        
        # Check filename for class name
        for class_name, label in label_mapping.items():
            if class_name.lower() in file_path.name.lower():
                return label
        
        # Default label
        return np.random.randint(0, 7)
    
    def _log_image_hash(self, file_path: Path):
        """Compute and log image hash for deduplication"""
        try:
            with open(file_path, 'rb') as f:
                file_hash = hashlib.md5(f.read()).hexdigest()
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR IGNORE INTO image_metadata 
                (filename, hash, path, used_for_training)
                VALUES (?, ?, ?, 0)
            ''', (file_path.name, file_hash, str(file_path)))
            
            conn.commit()
            conn.close()
        except Exception as e:
            logger.warning(f"Error logging image hash: {e}")
    
    def distribute_data_iid(self, X: np.ndarray, y: np.ndarray):
        """
        Distribute data uniformly to clients (IID)
        Each client gets roughly equal amount of each class
        """
        if len(X) == 0:
            return
        
        num_classes = len(np.unique(y))
        samples_per_client = len(X) // self.num_clients
        
        indices = np.arange(len(X))
        np.random.shuffle(indices)
        
        for client_id in range(self.num_clients):
            start_idx = client_id * samples_per_client
            if client_id == self.num_clients - 1:
                end_idx = len(X)
            else:
                end_idx = (client_id + 1) * samples_per_client
            
            client_indices = indices[start_idx:end_idx]
            self.client_data[client_id] = {
                'X_train': X[client_indices],
                'y_train': y[client_indices],
                'indices': client_indices,
                'num_samples': len(client_indices)
            }
            
            # Log distribution
            unique_classes = np.unique(y[client_indices])
            logger.info(
                f"Client {client_id}: {len(client_indices)} samples, "
                f"classes: {unique_classes}"
            )
    
    def distribute_data_non_iid(self, X: np.ndarray, y: np.ndarray):
        """
        Distribute data non-uniformly using Dirichlet distribution
        Creates heterogeneous client datasets (non-IID)
        
        Using Dirichlet with alpha < 1.0 creates highly non-IID data
        """
        if len(X) == 0:
            return
        
        num_classes = len(np.unique(y))
        
        # Generate class distributions for each client using Dirichlet
        class_distributions = np.random.dirichlet(
            [self.alpha] * num_classes,
            self.num_clients
        )
        
        # Assign samples based on Dirichlet distribution
        for client_id in range(self.num_clients):
            client_indices = []
            distribution = class_distributions[client_id]
            
            for class_id, proportion in enumerate(distribution):
                class_indices = np.where(y == class_id)[0]
                num_samples = int(proportion * len(X) / self.num_clients)
                num_samples = min(num_samples, len(class_indices))
                
                if num_samples > 0:
                    selected = np.random.choice(
                        class_indices,
                        num_samples,
                        replace=False
                    )
                    client_indices.extend(selected)
            
            client_indices = np.array(client_indices)
            self.client_data[client_id] = {
                'X_train': X[client_indices],
                'y_train': y[client_indices],
                'indices': client_indices,
                'num_samples': len(client_indices)
            }
            
            # Log distribution
            unique, counts = np.unique(
                y[client_indices],
                return_counts=True
            )
            class_dist = dict(zip(unique, counts))
            logger.info(
                f"Client {client_id}: {len(client_indices)} samples, "
                f"distribution: {class_dist}"
            )
    
    def distribute_data(self, X: np.ndarray, y: np.ndarray):
        """Distribute data based on IID setting"""
        if self.iid:
            logger.info("Distributing data in IID manner")
            self.distribute_data_iid(X, y)
        else:
            logger.info(
                f"Distributing data with non-IID (Dirichlet alpha={self.alpha})"
            )
            self.distribute_data_non_iid(X, y)
    
    def get_client_data(self, client_id: int) -> Tuple[np.ndarray, np.ndarray]:
        """Get training data for a specific client"""
        if client_id not in self.client_data:
            raise ValueError(f"Client {client_id} not found")
        
        data = self.client_data[client_id]
        return data['X_train'], data['y_train']
    
    def get_all_client_data(self) -> dict:
        """Get data for all clients"""
        return self.client_data
    
    def mark_images_used(self, client_id: int, round_num: int):
        """Mark images as used for training"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            indices = self.client_data[client_id].get('indices', [])
            
            for idx in indices:
                cursor.execute('''
                    UPDATE image_metadata
                    SET used_for_training = 1, client_id = ?, training_round = ?
                    WHERE id = ?
                ''', (client_id, round_num, idx))
            
            conn.commit()
            conn.close()
            logger.info(f"Marked {len(indices)} images as used by client {client_id}")
        except Exception as e:
            logger.error(f"Error marking images used: {e}")
    
    def get_unused_images_count(self) -> int:
        """Get count of unused images for auto-training threshold"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                'SELECT COUNT(*) FROM image_metadata WHERE used_for_training = 0'
            )
            count = cursor.fetchone()[0]
            conn.close()
            return count
        except Exception as e:
            logger.error(f"Error getting unused image count: {e}")
            return 0
    
    def export_client_data(self, output_dir: str = './client_data'):
        """Export client data distributions to files for debugging"""
        Path(output_dir).mkdir(exist_ok=True)
        
        summary = {
            'num_clients': self.num_clients,
            'iid': self.iid,
            'alpha': self.alpha,
            'timestamp': datetime.now().isoformat(),
            'clients': {}
        }
        
        for client_id, data in self.client_data.items():
            unique, counts = np.unique(
                data['y_train'],
                return_counts=True
            )
            summary['clients'][str(client_id)] = {
                'num_samples': int(data['num_samples']),
                'class_distribution': dict(zip(
                    [int(c) for c in unique],
                    [int(cnt) for cnt in counts]
                ))
            }
        
        with open(Path(output_dir) / 'distribution.json', 'w') as f:
            json.dump(summary, f, indent=2)
        
        logger.info(f"Exported distribution to {output_dir}/distribution.json")


# Example usage
if __name__ == "__main__":
    simulator = ClientSimulator(
        num_clients=3,
        data_dir='./uploads',
        iid=False,
        alpha=0.1
    )
    
    # Create dummy data for testing
    X = np.random.randn(300, 224, 224, 3).astype(np.float32)
    y = np.random.randint(0, 7, 300)
    
    simulator.distribute_data(X, y)
    simulator.export_client_data()
    
    # Get client data
    for client_id in range(3):
        X_client, y_client = simulator.get_client_data(client_id)
        print(f"Client {client_id}: {len(X_client)} samples")
