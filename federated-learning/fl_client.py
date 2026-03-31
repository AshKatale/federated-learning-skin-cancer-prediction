"""
Federated Learning Client
Entry point for FL clients
Responsible for client initialization and server connection
"""

import sys
import io
import os

# Force unbuffered output BEFORE any other imports
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import flwr as fl
import torch
import logging

from skin_cancer_model import SkinCancerModel
from fl_data_loader import FLDataLoader
from fl_client_numpy import SkinCancerNNClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(message)s'
)
logger = logging.getLogger(__name__)


def start_client(
    client_id,
    server_address,
    dataset_path=None,
    metadata_path=None,
    learning_rate=0.001,
    model_path=None
):
    """
    Start a Flower client and connect to server
    
    Args:
        client_id: Client identifier
        server_address: FL server address (e.g., 'localhost:8080')
        dataset_path: Path to HAM10000 dataset root
        metadata_path: Path to metadata.csv
        learning_rate: Learning rate for local training
        model_path: Path to pre-trained model (optional)
    """
    logger.info(f"\n[CLIENT {client_id}] ========== INITIALIZE ==========")
    logger.info(f"[CLIENT {client_id}] Starting FL client")
    logger.info(f"[CLIENT {client_id}] Server: {server_address}")
    
    # Default paths if not provided
    if dataset_path is None:
        dataset_path = r"D:\Skin Cancer Dataset"
    if metadata_path is None:
        metadata_path = os.path.join(dataset_path, "HAM10000_metadata.csv")
    
    # Load or create model
    logger.info(f"[CLIENT {client_id}] Loading EfficientNet model")
    model_eager = SkinCancerModel(model_path=model_path, device='cpu')
    model = model_eager.model
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)
    
    logger.info(f"[CLIENT {client_id}] Using device: {device}")
    
    # Load client data
    X_train, y_train, X_val, y_val = load_client_data(
        client_id=client_id,
        dataset_path=dataset_path,
        metadata_path=metadata_path,
        samples_per_client=100
    )
    
    if len(X_train) == 0:
        logger.error(f"[CLIENT {client_id}] No training data loaded, exiting")
        sys.exit(1)
    
    # Create FL client
    logger.info(f"[CLIENT {client_id}] Creating Flower NumPy client")
    client = SkinCancerNNClient(
        client_id=client_id,
        model=model,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        learning_rate=learning_rate,
        device=device
    )


def start_client(
    client_id,
    server_address,
    dataset_path=None,
    metadata_path=None,
    learning_rate=0.001,
    model_path=None
):
    """
    Start a Flower client and connect to server
    
    Args:
        client_id: Client identifier
        server_address: FL server address (e.g., 'localhost:8080')
        dataset_path: Path to HAM10000 dataset root
        metadata_path: Path to metadata.csv
        learning_rate: Learning rate for local training
        model_path: Path to pre-trained model (optional)
    """
    logger.info(f"\n[CLIENT {client_id}] ========== INITIALIZE ==========")
    logger.info(f"[CLIENT {client_id}] Starting FL client")
    logger.info(f"[CLIENT {client_id}] Server: {server_address}")
    
    # Default paths if not provided
    if dataset_path is None:
        dataset_path = r"D:\Skin Cancer Dataset"
    if metadata_path is None:
        metadata_path = os.path.join(dataset_path, "HAM10000_metadata.csv")
    
    # Load or create model
    logger.info(f"[CLIENT {client_id}] Loading EfficientNet model")
    model_wrapper = SkinCancerModel(model_path=model_path, device='cpu')
    model = model_wrapper.model
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    model.to(device)
    
    logger.info(f"[CLIENT {client_id}] Using device: {device}")
    
    # Load client data using isolated data loader
    X_train, y_train, X_val, y_val = FLDataLoader.load_client_data(
        client_id=client_id,
        dataset_path=dataset_path,
        metadata_path=metadata_path,
        transform_fn=model_wrapper.get_transforms,
        samples_per_client=100
    )
    
    if len(X_train) == 0:
        logger.error(f"[CLIENT {client_id}] No training data loaded, exiting")
        sys.exit(1)
    
    # Create FL NumPy client with isolated trainer
    logger.info(f"[CLIENT {client_id}] Creating Flower NumPy client")
    client = SkinCancerNNClient(
        client_id=client_id,
        model=model,
        X_train=X_train,
        y_train=y_train,
        X_val=X_val,
        y_val=y_val,
        learning_rate=learning_rate,
        device=device
    )
    
    # Connect to Flower server
    logger.info(f"[CLIENT {client_id}] Connecting to server at {server_address}")
    try:
        fl.client.start_numpy_client(
            server_address=server_address,
            client=client
        )
        logger.info(f"[CLIENT {client_id}] Client finished")
    except Exception as e:
        logger.error(f"[CLIENT {client_id}] ERROR: {e}")
        raise


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python fl_client.py <client_id> [server_address] [dataset_path]")
        print("Example: python fl_client.py 1 127.0.0.1:8080 'D:\\Skin Cancer Dataset'")
        sys.exit(1)
    
    client_id = sys.argv[1]
    server_address = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1:8080"
    dataset_path = sys.argv[3] if len(sys.argv) > 3 else r"D:\Skin Cancer Dataset"
    
    start_client(
        client_id=client_id,
        server_address=server_address,
        dataset_path=dataset_path
    )
