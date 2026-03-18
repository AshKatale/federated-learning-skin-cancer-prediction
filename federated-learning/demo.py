"""
Federated Learning Demo Script
Demonstrates federated learning with 3 clients training simultaneously
"""
import sys
import os
import time
import requests
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.data_generator import DataGenerator
from client.client import FederatedClient
from utils.metrics import Metrics


def run_client_federated_rounds(client, num_rounds=3):
    """Run federated learning rounds for a single client"""
    for round_num in range(num_rounds):
        print(f"\n{'='*60}")
        print(f"Round {round_num + 1}/{num_rounds} - {client.client_id}")
        print(f"{'='*60}")
        
        # Execute federated round
        client.federated_round(epochs=1)
        
        # Small delay to avoid socket errors
        time.sleep(0.5)


def aggregate_updates(server_url, client_ids, method='average'):
    """Aggregate updates from all clients"""
    try:
        payload = {
            'client_ids': client_ids,
            'method': method
        }
        
        response = requests.post(
            f'{server_url}/aggregate',
            json=payload,
            timeout=10
        )
        response.raise_for_status()
        
        data = response.json()
        print(f"\n{'='*60}")
        print(f"AGGREGATION SUCCESSFUL")
        print(f"{'='*60}")
        print(f"Aggregated {data['clients_aggregated']} client updates")
        print(f"New global round: {data['round']}")
        print()
        
        return True
    
    except Exception as e:
        print(f"Error aggregating: {e}")
        return False


def check_server_health(server_url):
    """Check if server is running"""
    try:
        response = requests.get(f'{server_url}/health', timeout=2)
        return response.status_code == 200
    except:
        return False


def print_client_evaluation(client, label):
    """Print client evaluation metrics"""
    metrics = client.evaluate()
    print(f"\n{label} Evaluation Metrics:")
    print(f"  MSE:  {metrics['mse']:.4f}")
    print(f"  MAE:  {metrics['mae']:.4f}")
    print(f"  RMSE: {metrics['rmse']:.4f}")
    print(f"  R²:   {metrics['r2']:.4f}")


def main():
    """Main demo orchestrator"""
    
    print(f"\n{'#'*60}")
    print(f"# Federated Learning Demo")
    print(f"#{'#'*58}")
    print("\nConfiguration:")
    print("  - Server: http://localhost:5000")
    print("  - Model: Linear Regression")
    print("  - Clients: 3")
    print("  - Features: 10")
    print("  - Rounds: 5")
    print()
    
    # Configuration
    SERVER_URL = "http://localhost:5000"
    NUM_CLIENTS = 3
    NUM_ROUNDS = 5
    N_FEATURES = 10
    
    # ========== Check Server ==========
    print("Checking server connection...")
    if not check_server_health(SERVER_URL):
        print("\n❌ ERROR: Server is not running!")
        print("Please start the server first:")
        print("  python server/server.py")
        return
    
    print("✓ Server is healthy\n")
    
    # ========== Generate Data ==========
    print("Generating federated data split...")
    client_data = DataGenerator.create_federated_split(
        n_clients=NUM_CLIENTS,
        n_samples=300,
        n_features=N_FEATURES,
        noise=10.0
    )
    print(f"✓ Created {NUM_CLIENTS} client datasets\n")
    
    # Generate test data (shared across all clients)
    print("Generating test data...")
    X_test, y_test = DataGenerator.generate_test_data(
        n_samples=100,
        n_features=N_FEATURES,
        noise=5.0
    )
    print("✓ Test data ready\n")
    
    # ========== Initialize Clients ==========
    print("Initializing clients...")
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
        print(f"  ✓ {client.client_id} initialized ({len(X_train)} samples)")
    
    print()
    
    # ========== Federated Learning Rounds ==========
    print(f"\nStarting {NUM_ROUNDS} federated learning rounds...\n")
    
    for round_num in range(NUM_ROUNDS):
        print(f"\n{'='*70}")
        print(f"FEDERATED LEARNING ROUND {round_num + 1}/{NUM_ROUNDS}")
        print(f"{'='*70}\n")
        
        # Run training in parallel for all clients
        print("Phase 1: Clients training locally in parallel...")
        with ThreadPoolExecutor(max_workers=NUM_CLIENTS) as executor:
            futures = [
                executor.submit(run_client_federated_rounds, client, 1)
                for client in clients
            ]
            for future in futures:
                future.result()
        
        # Aggregate updates
        print("\nPhase 2: Server aggregating model updates...")
        time.sleep(1)  # Small delay
        
        client_ids = [client.client_id for client in clients]
        if not aggregate_updates(SERVER_URL, client_ids, method='average'):
            print("Failed to aggregate")
            return
        
        # Evaluate current model
        print("\nPhase 3: Evaluating model on test data...")
        for i, client in enumerate(clients):
            print_client_evaluation(client, f"Client {i+1}")
        
        print()
    
    # ========== Final Evaluation ==========
    print(f"\n{'='*70}")
    print(f"FINAL MODEL EVALUATION")
    print(f"{'='*70}")
    
    print("\nFinal metrics on test data:")
    for i, client in enumerate(clients):
        print_client_evaluation(client, f"\nClient {i+1}")
    
    # Calculate average across clients
    all_metrics = [client.evaluate() for client in clients]
    avg_mse = sum(m['mse'] for m in all_metrics) / len(all_metrics)
    avg_mae = sum(m['mae'] for m in all_metrics) / len(all_metrics)
    avg_rmse = sum(m['rmse'] for m in all_metrics) / len(all_metrics)
    
    print(f"\n{'─'*40}")
    print(f"Average Metrics Across All Clients:")
    print(f"  MSE:  {avg_mse:.4f}")
    print(f"  MAE:  {avg_mae:.4f}")
    print(f"  RMSE: {avg_rmse:.4f}")
    print(f"{'─'*40}\n")
    
    print(f"\n{'#'*60}")
    print(f"# Demo Completed Successfully!")
    print(f"#{'#'*58}\n")
    
    print("Summary:")
    print(f"  ✓ Trained 3 clients collaboratively")
    print(f"  ✓ Completed {NUM_ROUNDS} federated rounds")
    print(f"  ✓ Average RMSE: {avg_rmse:.4f}")
    print("\nNext steps:")
    print("  - Modify NUM_ROUNDS to train longer")
    print("  - Change NUM_CLIENTS to use different splits")
    print("  - Check client X_train.shape[0] for different data distributions")
    print()


if __name__ == '__main__':
    main()
