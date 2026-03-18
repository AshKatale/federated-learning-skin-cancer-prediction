"""
FedProx Demo Script
Demonstrates federated learning using FedProx algorithm
FedProx handles non-IID data better by adding proximal term to local loss
"""
import sys
import os
import time
import requests
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.data_generator import DataGenerator
from client.fedprox_client import FedProxClient
from utils.metrics import Metrics


def run_client_fedprox_rounds(client, num_rounds=3, learning_rate=0.01):
    """Run FedProx federated learning rounds for a single client"""
    for round_num in range(num_rounds):
        print(f"\n{'='*60}")
        print(f"FedProx Round {round_num + 1}/{num_rounds} - {client.client_id}")
        print(f"{'='*60}")
        
        # Execute FedProx round
        client.federated_round(epochs=1, learning_rate=learning_rate)
        
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
        print(f"FedProx AGGREGATION SUCCESSFUL")
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


def print_proximal_info(client, label):
    """Print proximal information"""
    history = client.get_proximal_history()
    if history:
        latest = history[-1]
        print(f"\n{label} FedProx Info:")
        print(f"  μ (Proximal coefficient): {latest['mu']:.4f}")
        if latest['distance_to_global'] is not None:
            print(f"  Distance to global model: {latest['distance_to_global']:.6f}")
            print(f"  Proximal term value: {latest['proximal_term_value']:.6f}")


def main():
    """Main FedProx demo orchestrator"""
    
    print(f"\n{'#'*60}")
    print(f"# Federated Learning with FedProx Algorithm Demo")
    print(f"#{'#'*58}")
    print("\nConfiguration:")
    print("  - Server: http://localhost:5000")
    print("  - Model: Linear Regression with Proximal Term")
    print("  - Clients: 3")
    print("  - Features: 10")
    print("  - Rounds: 5")
    print("  - FedProx μ (proximal coefficient): 0.01")
    print("\nFedProx Algorithm:")
    print("  Minimizes: L(w) + (μ/2) * ||w - w_global||^2")
    print("  Better handles non-IID (heterogeneous) data")
    print()
    
    # Configuration
    SERVER_URL = "http://localhost:5000"
    NUM_CLIENTS = 3
    NUM_ROUNDS = 5
    N_FEATURES = 10
    MU = 0.01  # Proximal coefficient
    LEARNING_RATE = 0.01
    
    # Check server health
    print("Checking server health...")
    if not check_server_health(SERVER_URL):
        print("❌ Server is not running. Please start the server first:")
        print("   python server/server.py")
        return
    print("✓ Server is running\n")
    
    # Generate heterogeneous data
    print("Generating heterogeneous client data...")
    data_gen = DataGenerator(n_features=N_FEATURES)
    
    clients = []
    client_ids = []
    
    for i in range(NUM_CLIENTS):
        client_id = f"fedprox_client_{i+1}"
        
        # Generate data with different distributions (non-IID)
        X_train, y_train = data_gen.generate_data(n_samples=100)
        X_test, y_test = data_gen.generate_data(n_samples=20)
        
        # Create FedProx client with specific μ
        client = FedProxClient(
            client_id=client_id,
            server_url=SERVER_URL,
            X_train=X_train,
            y_train=y_train,
            X_test=X_test,
            y_test=y_test,
            mu=MU
        )
        
        clients.append(client)
        client_ids.append(client_id)
        print(f"  ✓ {client_id} created")
    
    print(f"\n✓ {NUM_CLIENTS} clients created with FedProx (μ={MU})\n")
    
    # Run federated rounds
    with ThreadPoolExecutor(max_workers=NUM_CLIENTS) as executor:
        for round_num in range(NUM_ROUNDS):
            print(f"\n\n{'#'*60}")
            print(f"# Global FedProx Round {round_num + 1}/{NUM_ROUNDS}")
            print(f"#{'#'*58}\n")
            
            # Run clients in parallel
            futures = [
                executor.submit(
                    run_client_fedprox_rounds,
                    client,
                    num_rounds=1,
                    learning_rate=LEARNING_RATE
                )
                for client in clients
            ]
            
            # Wait for all clients to complete
            for future in futures:
                future.result()
            
            # Aggregate
            aggregate_updates(SERVER_URL, client_ids, method='weighted_average')
    
    # Final evaluation
    print(f"\n\n{'#'*60}")
    print(f"# Final Evaluation")
    print(f"#{'#'*58}\n")
    
    for client in clients:
        print_client_evaluation(client, client.client_id)
        print_proximal_info(client, client.client_id)
    
    # Print training history
    print(f"\n\n{'#'*60}")
    print(f"# Training Statistics")
    print(f"#{'#'*58}\n")
    
    for client in clients:
        history = client.get_training_history()
        if history:
            print(f"\n{client.client_id}:")
            print(f"  Initial MSE: {history[0]['train_mse']:.4f}")
            print(f"  Final MSE:   {history[-1]['train_mse']:.4f}")
            print(f"  Improvement: {(history[0]['train_mse'] - history[-1]['train_mse']):.4f}")
            
            prox_history = client.get_proximal_history()
            if prox_history and prox_history[-1]['distance_to_global'] is not None:
                print(f"  Final proximity distance: {prox_history[-1]['distance_to_global']:.6f}")
    
    print(f"\n{'='*60}")
    print("✓ FedProx Demo Completed Successfully!")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
