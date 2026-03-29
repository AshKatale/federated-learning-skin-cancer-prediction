"""
Federated Learning Server using Flower Framework
Implements FedAvg aggregation strategy for distributed training
"""

import flwr as fl
from flwr.server import ServerConfig
from flwr.server.strategy import FedAvg
import numpy as np
import torch
import os
from pathlib import Path
import json
from datetime import datetime

# Configuration
FL_PORT = int(os.getenv('FL_PORT', 8080))
FL_SERVER_ADDRESS = os.getenv('FL_SERVER_ADDRESS', '127.0.0.1:8080')  # Use localhost for Windows compatibility
GLOBAL_MODEL_DIR = Path('./models/global')
TRAINING_LOG_DIR = Path('./training_logs')

# Ensure directories exist
GLOBAL_MODEL_DIR.mkdir(parents=True, exist_ok=True)
TRAINING_LOG_DIR.mkdir(parents=True, exist_ok=True)


class FedAvgStrategy(FedAvg):
    """Custom FedAvg strategy with enhanced metrics and logging"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.round_metrics = []
        self.training_history = {
            'rounds': [],
            'global_loss': [],
            'global_accuracy': [],
            'client_count': [],
            'timestamp': []
        }
    
    def aggregate_fit(self, server_round, results, failures):
        """
        Aggregate trained model updates from clients
        Uses weighted averaging based on number of training samples
        """
        # Call parent aggregation
        weights_aggregated, metrics_aggregated = super().aggregate_fit(
            server_round, results, failures
        )
        
        if weights_aggregated is not None:
            # Log aggregation metrics
            participating_clients = len(results)
            # Results format: [(client, FitRes), (client, FitRes), ...]
            # Extract num_examples from FitRes objects
            total_samples = sum([fit_res.num_examples for _, fit_res in results])
            
            log_entry = {
                'round': server_round,
                'timestamp': datetime.now().isoformat(),
                'participating_clients': participating_clients,
                'failed_clients': len(failures),
                'total_samples': total_samples,
                'metrics': metrics_aggregated
            }
            self.round_metrics.append(log_entry)
            
            # Store aggregated weights
            self.save_global_model(weights_aggregated, server_round)
            
            print(f"\n[Round {server_round}] Aggregation Complete")
            print(f"  Participating Clients: {participating_clients}")
            print(f"  Total Samples: {total_samples}")
            if metrics_aggregated:
                print(f"  Metrics: {metrics_aggregated}")
        
        return weights_aggregated, metrics_aggregated
    
    def save_global_model(self, weights, round_num):
        """Save aggregated global model weights"""
        try:
            model_path = GLOBAL_MODEL_DIR / f"global_model_round_{round_num}.pt"
            
            # Convert weights to numpy arrays for serialization
            state_dict = {}
            for i, weight in enumerate(weights):
                state_dict[f'layer_{i}'] = weight
            
            torch.save(state_dict, model_path)
            print(f"  Saved global model to {model_path}")
        except Exception as e:
            print(f"  ERROR saving global model: {e}")


def get_initial_parameters():
    """Get initial parameters from pretrained model or random initialization"""
    try:
        # Try to load most recent global model
        model_files = sorted(GLOBAL_MODEL_DIR.glob('global_model_round_*.pt'))
        if model_files:
            latest_model = model_files[-1]
            state_dict = torch.load(latest_model)
            print(f"Loaded initial parameters from {latest_model}")
            return [np.array(v, dtype=np.float32) for v in state_dict.values()]
    except Exception as e:
        print(f"Could not load initial model: {e}")
    
    # Return random initialization (will be replaced by client models)
    print("Initializing with random parameters")
    return None


def create_server_config():
    """Configure Flower server parameters"""
    return ServerConfig(
        num_rounds=int(os.getenv('FL_ROUNDS', 5)),
    )


def start_server():
    """Start Flower federated learning server"""
    
    print("=" * 60)
    print("FLOWER FEDERATED LEARNING SERVER")
    print("=" * 60)
    
    # Create strategy
    strategy = FedAvgStrategy(
        fraction_fit=float(os.getenv('FL_FRACTION_FIT', 1.0)),  # All available clients
        fraction_evaluate=float(os.getenv('FL_FRACTION_EVAL', 1.0)),
        min_fit_clients=int(os.getenv('FL_MIN_FIT_CLIENTS', 1)),
        min_available_clients=int(os.getenv('FL_MIN_AVAILABLE_CLIENTS', 1)),
        initial_parameters=get_initial_parameters(),
    )
    
    config = create_server_config()
    
    print(f"\nServer Configuration:")
    print(f"  Address: {FL_SERVER_ADDRESS}")
    print(f"  Rounds: {config.num_rounds}")
    print(f"  Min Fit Clients: {strategy.min_fit_clients}")
    
    # Start server
    try:
        fl.server.start_server(
            server_address=FL_SERVER_ADDRESS,
            config=config,
            strategy=strategy,
        )
    except KeyboardInterrupt:
        print("\nServer shutdown initiated")
    except Exception as e:
        print(f"Server error: {e}")
        raise


if __name__ == "__main__":
    start_server()
