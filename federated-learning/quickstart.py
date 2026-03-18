"""
Quick Start - Single Client Example
Shows how to manually use the federated learning system
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data.data_generator import DataGenerator
from client.client import FederatedClient
import time


def main():
    print("\n" + "="*70)
    print("FEDERATED LEARNING - QUICK START (Single Client)")
    print("="*70 + "\n")
    
    # Configuration
    SERVER_URL = "http://localhost:5000"
    CLIENT_ID = "quick_start_client"
    
    print("Configuration:")
    print(f"  Server: {SERVER_URL}")
    print(f"  Client ID: {CLIENT_ID}\n")
    
    # Check server
    print("Checking server connection...")
    import requests
    try:
        response = requests.get(f"{SERVER_URL}/health", timeout=2)
        print(f"✓ Server is running\n")
    except:
        print(f"✗ Error: Server is not running!")
        print(f"  Start it with: python server/server.py\n")
        return
    
    # Generate data
    print("Generating data...")
    X_train, y_train = DataGenerator.generate_linear_data(
        n_samples=100,
        n_features=10,
        noise=10.0,
        random_state=42
    )
    X_test, y_test = DataGenerator.generate_test_data(
        n_samples=50,
        n_features=10,
        noise=5.0
    )
    print(f"✓ Data ready")
    print(f"  Training: {X_train.shape}")
    print(f"  Test: {X_test.shape}\n")
    
    # Create client
    print("Creating client...")
    client = FederatedClient(
        client_id=CLIENT_ID,
        server_url=SERVER_URL,
        X_train=X_train,
        y_train=y_train,
        X_test=X_test,
        y_test=y_test
    )
    print("✓ Client initialized\n")
    
    # Run federated rounds
    num_rounds = 5
    print(f"Running {num_rounds} federated rounds...\n")
    
    for round_num in range(num_rounds):
        print(f"{'─'*70}")
        print(f"Round {round_num + 1}/{num_rounds}")
        print(f"{'─'*70}")
        
        # Execute round
        success = client.federated_round(epochs=1)
        
        if success:
            # Evaluate
            metrics = client.evaluate()
            print(f"  ✓ Metrics: MSE={metrics['mse']:.4f}, RMSE={metrics['rmse']:.4f}\n")
        else:
            print(f"  ✗ Round failed\n")
            break
        
        time.sleep(0.5)
    
    # Final evaluation
    print("\n" + "="*70)
    print("FINAL RESULTS")
    print("="*70)
    
    metrics = client.evaluate()
    print(f"\nFinal Metrics:")
    print(f"  MSE:  {metrics['mse']:.4f}")
    print(f"  MAE:  {metrics['mae']:.4f}")
    print(f"  RMSE: {metrics['rmse']:.4f}")
    print(f"  R²:   {metrics['r2']:.4f}")
    
    print(f"\nTraining History (Last 3 epochs):")
    for hist in client.training_history[-3:]:
        print(f"  Epoch {hist['epoch']}: Train MSE={hist['train_mse']:.4f}")
    
    print("\n✓ Quick start completed!\n")


if __name__ == '__main__':
    main()
