"""
Model Aggregation Script
Unified aggregator for combining trained models (Federated Averaging)
Used for creating central model from distributed training
"""

import os
import sys
import json
import torch
import numpy as np
from pathlib import Path
from datetime import datetime

def aggregate_models(model_paths, output_path, weights=None):
    """
    Aggregate multiple model weights using weighted averaging
    
    Args:
        model_paths: List of paths to model checkpoint files (.pth)
        output_path: Path to save aggregated model
        weights: Optional weights for weighted averaging (default: equal)
    
    Returns:
        dict: Aggregation metrics
    """
    if not model_paths:
        raise ValueError("No model paths provided")
    
    print(f"[AGG] Starting model aggregation")
    sys.stdout.flush()
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Load first model to get structure
    print(f"[AGG] Loading model structure from: {model_paths[0]}")
    sys.stdout.flush()
    state_dict_0 = torch.load(model_paths[0], map_location='cpu')
    
    # Initialize aggregated state dict
    aggregated_state = {}
    
    # Set default equal weights
    if weights is None:
        weights = np.ones(len(model_paths)) / len(model_paths)
    else:
        weights = np.array(weights)
        weights = weights / weights.sum()  # Normalize
    
    print(f"[AGG] Aggregating {len(model_paths)} models with weights: {weights}")
    sys.stdout.flush()
    
    # Load and average weights
    for idx, weight in enumerate(weights):
        model_path = model_paths[idx]
        
        if not os.path.exists(model_path):
            print(f"[AGG] WARNING: Model file not found: {model_path}")
            sys.stdout.flush()
            continue
        
        print(f"[AGG] [{idx+1}/{len(model_paths)}] Loading: {os.path.basename(model_path)} (weight={weight:.4f})")
        sys.stdout.flush()
        
        try:
            state_dict = torch.load(model_path, map_location='cpu')
            
            # Add weighted parameters to aggregated state
            for key, param in state_dict.items():
                if key not in aggregated_state:
                    aggregated_state[key] = torch.zeros_like(param)
                
                aggregated_state[key] += weight * param.float()
        
        except Exception as e:
            print(f"[AGG] ERROR loading model {model_path}: {e}")
            sys.stdout.flush()
            continue
    
    print(f"[AGG] Saving aggregated model to: {output_path}")
    sys.stdout.flush()
    torch.save(aggregated_state, output_path)
    
    # Return metrics
    metrics = {
        'aggregation_date': datetime.now().isoformat(),
        'num_models_aggregated': len(model_paths),
        'aggregation_type': 'federated_averaging',
        'model_weights': weights.tolist(),
        'output_file': output_path,
        'output_size_mb': os.path.getsize(output_path) / (1024**2),
        'status': 'success'
    }
    
    print(f"[AGG] Aggregation complete! Output size: {metrics['output_size_mb']:.2f} MB")
    sys.stdout.flush()
    
    return metrics


def weighted_average_models(model_data_list, output_path):
    """
    Perform weighted averaging based on model accuracy/performance
    Each model's contribution is weighted by its validation accuracy
    
    Args:
        model_data_list: List of dicts with 'path' and 'accuracy' keys
        output_path: Path to save aggregated model
    
    Returns:
        dict: Aggregation metrics
    """
    model_paths = [m['path'] for m in model_data_list]
    accuracies = np.array([m['accuracy'] for m in model_data_list])
    
    # Normalize accuracies as weights
    weights = accuracies / accuracies.sum()
    
    print(f"[AGG] Performing weighted averaging based on accuracy")
    print(f"[AGG] Accuracy weights: {weights}")
    
    return aggregate_models(model_paths, output_path, weights=weights)


if __name__ == "__main__":
    # Example usage
    import sys
    
    if len(sys.argv) < 3:
        print("Usage: python model_aggregator.py <model_path1> [model_path2] ... <output_path>")
        sys.exit(1)
    
    model_paths = sys.argv[1:-1]
    output_path = sys.argv[-1]
    
    try:
        metrics = aggregate_models(model_paths, output_path)
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        print(f"[AGG] FAILED: {e}")
        sys.exit(1)
