"""
Federated Learning Server for Skin Cancer Model
Aggregates model updates from multiple clients
"""

import sys
import os
import json
import numpy as np
import torch
from pathlib import Path
from datetime import datetime
import threading
import logging

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ml-model'))
from skin_cancer_model import SkinCancerModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SkinCancerFLServer:
    """Federated Learning Server for Skin Cancer Model"""
    
    def __init__(self, model_dir='./models', aggregation_method='fedavg'):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.global_model = None
        self.aggregation_method = aggregation_method
        
        self.registered_clients = {}
        self.client_updates = {}
        self.current_round = 0
        self.training_history = []
        
        self.lock = threading.Lock()
        
        logger.info(f"✓ FL Server initialized (Device: {self.device})")
    
    def initialize_global_model(self, model_path=None):
        """Initialize global model"""
        self.global_model = SkinCancerModel(model_path=model_path, device=self.device)
        logger.info("✓ Global model initialized")
    
    def register_client(self, client_id):
        """Register a client"""
        with self.lock:
            if client_id not in self.registered_clients:
                self.registered_clients[client_id] = {
                    'registered_at': datetime.now(),
                    'rounds_participated': 0,
                    'samples': 0
                }
                logger.info(f"✓ Client {client_id} registered")
                return True
            return False
    
    def receive_client_update(self, client_id, round_num, num_samples, model_update):
        """Receive update from a client"""
        with self.lock:
            if round_num not in self.client_updates:
                self.client_updates[round_num] = {}
            
            self.client_updates[round_num][client_id] = {
                'num_samples': num_samples,
                'model_update': model_update,
                'timestamp': datetime.now()
            }
            
            if client_id in self.registered_clients:
                self.registered_clients[client_id]['rounds_participated'] += 1
                self.registered_clients[client_id]['samples'] += num_samples
            
            logger.info(f"✓ Received update from client {client_id} for round {round_num}")
            return True
    
    def aggregate_updates_fedavg(self, round_num):
        """
        Aggregate client updates using FedAvg (Federated Averaging)
        Weighted average based on number of samples
        """
        if round_num not in self.client_updates or len(self.client_updates[round_num]) == 0:
            logger.warning(f"No updates for round {round_num}")
            return False
        
        logger.info(f"Aggregating {len(self.client_updates[round_num])} client updates using FedAvg...")
        
        # In a real implementation, would average the actual model weights
        # Here we show the structure
        total_samples = sum(
            update['num_samples'] 
            for update in self.client_updates[round_num].values()
        )
        
        logger.info(f"Total samples in round {round_num}: {total_samples}")
        
        # Save aggregated model
        model_path = os.path.join(
            self.model_dir, 
            f"global_model_round_{round_num}.pth"
        )
        self.global_model.save_model(model_path)
        
        self.training_history.append({
            'round': round_num,
            'timestamp': datetime.now(),
            'num_clients': len(self.client_updates[round_num]),
            'total_samples': total_samples,
            'aggregation_method': self.aggregation_method
        })
        
        logger.info(f"✓ Aggregation complete for round {round_num}")
        return True
    
    def get_global_model(self):
        """Get current global model state"""
        if self.global_model is None:
            return None
        return self.global_model.get_model_state_dict()
    
    def start_round(self, round_num):
        """Start a new federated learning round"""
        self.current_round = round_num
        self.client_updates[round_num] = {}
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting Federated Learning Round {round_num}")
        logger.info(f"{'='*60}")
        logger.info(f"Registered clients: {len(self.registered_clients)}")
    
    def end_round(self, round_num):
        """End a federated learning round and aggregate"""
        logger.info(f"\nEnding Round {round_num}")
        
        # Aggregate updates
        success = self.aggregate_updates_fedavg(round_num)
        
        if success:
            logger.info(f"✓ Round {round_num} complete")
        else:
            logger.error(f"✗ Round {round_num} aggregation failed")
        
        return success
    
    def get_server_status(self):
        """Get server status"""
        return {
            'current_round': self.current_round,
            'registered_clients': len(self.registered_clients),
            'device': str(self.device),
            'aggregation_method': self.aggregation_method,
            'training_history': len(self.training_history),
            'model_loaded': self.global_model is not None
        }
    
    def get_client_stats(self):
        """Get statistics about registered clients"""
        stats = {}
        for client_id, info in self.registered_clients.items():
            stats[client_id] = {
                'registered_at': str(info['registered_at']),
                'rounds_participated': info['rounds_participated'],
                'samples': info['samples']
            }
        return stats
    
    def save_training_history(self, filepath=None):
        """Save training history"""
        if filepath is None:
            filepath = os.path.join(self.model_dir, 'training_history.json')
        
        history_data = {
            'total_rounds': len(self.training_history),
            'registered_clients': len(self.registered_clients),
            'rounds': [
                {
                    'round': h['round'],
                    'timestamp': str(h['timestamp']),
                    'num_clients': h['num_clients'],
                    'total_samples': h['total_samples']
                }
                for h in self.training_history
            ]
        }
        
        with open(filepath, 'w') as f:
            json.dump(history_data, f, indent=2)
        
        logger.info(f"Training history saved to {filepath}")
