"""
Manual Server-Client Example
Shows direct API usage without demo orchestration
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
import json
import time
from data.data_generator import DataGenerator
from client.client import FederatedClient


def manual_federation_round():
    """Manually run one federated round"""
    
    SERVER_URL = "http://localhost:5000"
    
    print("\n" + "="*70)
    print("MANUAL FEDERATED ROUND")
    print("="*70 + "\n")
    
    # Step 1: Create 2 clients
    print("Step 1: Creating clients...")
    client_data = DataGenerator.create_federated_split(n_clients=2)
    X_test, y_test = DataGenerator.generate_test_data()
    
    clients = []
    for i in range(2):
        X_train, y_train = client_data[i]
        client = FederatedClient(
            client_id=f"manual_client_{i+1}",
            server_url=SERVER_URL,
            X_train=X_train,
            y_train=y_train,
            X_test=X_test,
            y_test=y_test
        )
        clients.append(client)
        print(f"  ✓ Created {client.client_id}")
    
    # Step 2: Get initial model
    print("\nStep 2: Downloading initial model...")
    response = requests.get(f"{SERVER_URL}/get_model")
    initial_model = response.json()['weights']
    print(f"  ✓ Downloaded at round {response.json()['round']}")
    
    # Step 3: Each client trains locally
    print("\nStep 3: Clients training locally...")
    for client in clients:
        client.download_model()
        client.train_local(epochs=1)
        print(f"  ✓ {client.client_id} trained")
        time.sleep(0.5)
    
    # Step 4: Clients upload updates
    print("\nStep 4: Clients uploading updates...")
    for client in clients:
        client.upload_model()
        print(f"  ✓ {client.client_id} uploaded")
        time.sleep(0.5)
    
    # Step 5: Server aggregates
    print("\nStep 5: Server aggregating...")
    client_ids = [c.client_id for c in clients]
    response = requests.post(
        f"{SERVER_URL}/aggregate",
        json={'client_ids': client_ids, 'method': 'average'}
    )
    new_round = response.json()['round']
    print(f"  ✓ Aggregated {response.json()['clients_aggregated']} updates")
    print(f"  ✓ New round: {new_round}")
    
    # Step 6: Check new global model by downloading
    print("\nStep 6: Downloading new global model...")
    response = requests.get(f"{SERVER_URL}/get_model")
    new_model = response.json()['weights']
    
    # Compare models
    import numpy as np
    weight_diff = np.linalg.norm(
        np.array(new_model['weights']) - 
        np.array(initial_model['weights'])
    )
    print(f"  ✓ Model changed (L2 norm diff: {weight_diff:.6f})")
    
    # Step 7: Evaluate all clients
    print("\nStep 7: Final evaluation...")
    for client in clients:
        metrics = client.evaluate()
        print(f"  {client.client_id}: RMSE={metrics['rmse']:.4f}")
    
    print("\n" + "="*70)
    print("MANUAL ROUND COMPLETE")
    print("="*70 + "\n")


if __name__ == '__main__':
    manual_federation_round()
