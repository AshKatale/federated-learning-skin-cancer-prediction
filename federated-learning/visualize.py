"""
Visualization Script - Plot federated learning progress
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import matplotlib.pyplot as plt
import numpy as np
from data.data_generator import DataGenerator
from client.client import FederatedClient
from utils.metrics import Metrics
import requests
import time


def plot_training_progress(clients, num_rounds=5):
    """Plot training progress across rounds"""
    
    SERVER_URL = "http://localhost:5000"
    metrics_history = {f"client_{i+1}": [] for i in range(len(clients))}
    
    # Run training rounds
    for round_num in range(num_rounds):
        print(f"Round {round_num + 1}/{num_rounds}")
        
        # Train clients in parallel
        for client in clients:
            client.federated_round(epochs=1)
            time.sleep(0.2)
        
        # Aggregate
        try:
            client_ids = [c.client_id for c in clients]
            response = requests.post(
                f"{SERVER_URL}/aggregate",
                json={'client_ids': client_ids, 'method': 'average'},
                timeout=5
            )
        except:
            pass
        
        # Collect metrics
        for client in clients:
            metrics = client.evaluate()
            metrics_history[client.client_id].append(metrics['rmse'])
    
    # Plot
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Plot 1: RMSE over rounds
    ax = axes[0]
    for client_id, rmse_values in metrics_history.items():
        ax.plot(range(1, len(rmse_values) + 1), rmse_values, 
                marker='o', label=client_id)
    
    ax.set_xlabel('Round', fontsize=12)
    ax.set_ylabel('RMSE on Test Data', fontsize=12)
    ax.set_title('Federated Learning Progress', fontsize=14, fontweight='bold')
    ax.legend()
    ax.grid(alpha=0.3)
    
    # Plot 2: Average RMSE
    ax = axes[1]
    avg_rmse_per_round = []
    for round_idx in range(num_rounds):
        rmse_values = [metrics_history[cid][round_idx] 
                      for cid in metrics_history.keys()]
        avg_rmse_per_round.append(np.mean(rmse_values))
    
    ax.plot(range(1, num_rounds + 1), avg_rmse_per_round,
            marker='o', color='green', linewidth=2, markersize=8)
    ax.fill_between(range(1, num_rounds + 1), avg_rmse_per_round,
                    alpha=0.3, color='green')
    
    ax.set_xlabel('Round', fontsize=12)
    ax.set_ylabel('Average RMSE', fontsize=12)
    ax.set_title('Average Model Performance', fontsize=14, fontweight='bold')
    ax.grid(alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('federated_learning_progress.png', dpi=100, bbox_inches='tight')
    print("\n✓ Saved plot to 'federated_learning_progress.png'")
    plt.show()


def main():
    print("\n" + "="*70)
    print("FEDERATED LEARNING - VISUALIZATION DEMO")
    print("="*70 + "\n")
    
    SERVER_URL = "http://localhost:5000"
    NUM_CLIENTS = 3
    NUM_ROUNDS = 5
    
    # Check server
    try:
        requests.get(f"{SERVER_URL}/health", timeout=2)
    except:
        print("Error: Server not running!")
        return
    
    # Setup
    print("Preparing data and clients...")
    client_data = DataGenerator.create_federated_split(
        n_clients=NUM_CLIENTS,
        n_samples=300,
        n_features=10
    )
    X_test, y_test = DataGenerator.generate_test_data(n_samples=100, n_features=10)
    
    clients = []
    for i in range(NUM_CLIENTS):
        X_train, y_train = client_data[i]
        client = FederatedClient(
            client_id=f"client_{i+1}",
            server_url=SERVER_URL,
            X_train=X_train,
            y_train=y_train,
            X_test=X_test,
            y_test=y_test
        )
        clients.append(client)
    
    print(f"✓ {NUM_CLIENTS} clients ready\n")
    
    # Train and plot
    print("Training federated model...")
    plot_training_progress(clients, num_rounds=NUM_ROUNDS)


if __name__ == '__main__':
    main()
