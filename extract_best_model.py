#!/usr/bin/env python3
"""Extract
 the trained model from the complex directory structure."""

import torch
from pathlib import Path

model_source = Path('fl-server/models/global/global_model_round_9.pth')
model_output = Path('desktop-app/fl_client/local_weights/global_model_round_9_extracted.pth')

print(f"Attempting to load from: {model_source}")

try:
    # Load the model from directory
    loaded = torch.load(str(model_source), weights_only=False, map_location='cpu')
    print(f"✅ Loaded successfully: {type(loaded)}")
    
    # Extract state dict if needed
    if hasattr(loaded, 'state_dict'):
        state = loaded.state_dict()
        print(f"  Extracted state_dict: {len(state)} parameters")
    else:
        state = loaded
        print(f"  Using as-is: {type(state)}")
    
    # Save as simple state dict file
    torch.save(state, str(model_output))
    print(f"✅ Saved state dict to: {model_output}")
    
    # Verify
    verify = torch.load(str(model_output), map_location='cpu')
    print(f"✅ Verification successful, loaded {len(verify)} parameters")
    print(f"\n⚡ Now copy this file:")
    print(f'copy "{model_output}" "{Path("desktop-app/fl_client/local_weights/global_model_round_9.pth")}"')
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
