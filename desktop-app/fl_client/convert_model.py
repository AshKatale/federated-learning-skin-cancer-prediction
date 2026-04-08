#!/usr/bin/env python3
"""
Convert PyTorch model directory to state_dict .pth file
Loads the trained model and extracts just the weights
"""

import torch
from pathlib import Path

# Load the trained model from directory
model_dir = Path('local_weights/best_skin_model')
model_file = 'global_model_round_9.pth'

print(f"Loading model from: {model_dir}")
try:
    # Load the full model from directory
    model = torch.load(str(model_dir))
    print(f"Loaded model type: {type(model)}")
    
    # Extract state_dict if it's a full model, otherwise use as-is
    if hasattr(model, 'state_dict'):
        state_dict = model.state_dict()
        print(f"Extracted state_dict with {len(state_dict)} parameters")
    else:
        state_dict = model
        print(f"Using model as state_dict")
    
    # Save to a simple .pth file that evaluation can load
    output_path = Path('local_weights') / model_file
    torch.save(state_dict, str(output_path))
    print(f"✅ Saved to: {output_path}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
