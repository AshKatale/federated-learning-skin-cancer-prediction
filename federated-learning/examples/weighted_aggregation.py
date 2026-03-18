"""
Custom Aggregation Example - Weighted aggregation
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
from data.data_generator import DataGenerator
from client.client import FederatedClient
import time


def weighted_aggregation_demo():
    """
    Demonstrate weighted aggregation where larger datasets
    have more influence on the global model
    """
    
    SERVER_URL = "http://localhost:5000"
    
    print("\n" + "="*70)
    print("WEIGHTED AGGREGATION DEMO")
    print("="*70 + "\n")
    
    print("This demo shows how to weight client contributions")
    print("based on their dataset size.\n")
    
    # Create 3 clients with DIFFERENT dataset sizes
    print("Creating clients with different dataset sizes...")
    
    # Client 1: Small dataset
    X_train_1, y_train_1 = DataGenerator.generate_linear_data(
        n_samples=50, n_features=10, random_state=1
    )
    
    # Client 2: Medium dataset
    X_train_2, y_train_2 = DataGenerator.generate_linear_data(
        n_samples=100, n_features=10, random_state=2
    )
    
    # Client 3: Large dataset
    X_train_3, y_train_3 = DataGenerator.generate_linear_data(
        n_samples=150, n_features=10, random_state=3
    )
    
    X_test, y_test = DataGenerator.generate_test_data()
    
    # Create clients
    clients = [
        FederatedClient("weighted_client_1", SERVER_URL, X_train_1, y_train_1, X_test, y_test),
        FederatedClient("weighted_client_2", SERVER_URL, X_train_2, y_train_2, X_test, y_test),
        FederatedClient("weighted_client_3", SERVER_URL, X_train_3, y_train_3, X_test, y_test),
    ]
    
    print(f"✓ Client 1: {len(X_train_1)} samples (weight: 20%)")
    print(f"✓ Client 2: {len(X_train_2)} samples (weight: 33%)")
    print(f"✓ Client 3: {len(X_train_3)} samples (weight: 47%)\n")
    
    # Run one weighted aggregation round
    print("Running federated round with weighted aggregation...\n")
    
    # Download
    for client in clients:
        client.download_model()
        time.sleep(0.3)
    
    # Train
    for client in clients:
        client.train_local(epochs=1)
        time.sleep(0.3)
    
    # Upload
    for client in clients:
        client.upload_model()
        time.sleep(0.3)
    
    # Aggregate with WEIGHTED method
    print("\nAggregating with weighted method...")
    client_ids = [c.client_id for c in clients]
    
    response = requests.post(
        f"{SERVER_URL}/aggregate",
        json={
            'client_ids': client_ids,
            'method': 'weighted_average'  # Key difference!
        }
    )
    
    if response.status_code == 200:
        print("✓ Weighted aggregation successful!")
        print(f"  - Larger datasets have more influence")
        print(f"  - Client 3 (150 samples) weighted at 47%")
        print(f"  - Client 2 (100 samples) weighted at 33%")
        print(f"  - Client 1 (50 samples) weighted at 20%")
    else:
        print(f"✗ Aggregation failed: {response.text}")
    
    print("\n" + "="*70)
    print("WEIGHTED AGGREGATION DEMO COMPLETE")
    print("="*70 + "\n")
    
    print("Note: Simple averaging uses equal weights (25% each)")
    print("      Weighted averaging uses dataset size (50%, 33%, 17%)")


if __name__ == '__main__':
    weighted_aggregation_demo()
