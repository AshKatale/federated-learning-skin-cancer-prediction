#!/usr/bin/env python3
"""
inference_runner.py  —  CLI wrapper called by Electron main process
======================================================================
Electron calls:
    python inference_runner.py --image <abs_path>

This script:
  1. Loads the trained EfficientNet model (local weights or default)
  2. Runs inference on the given image
  3. Prints a single JSON line to stdout  ← Electron reads this

Usage:
    python inference_runner.py --image "D:/photos/lesion.jpg"
    python inference_runner.py --image "D:/photos/lesion.jpg" --model "D:/weights/model.pt"

Output (stdout, last line):
    {"class_name": "Melanoma", "confidence": 0.87, "risk_level": "High", "top_predictions": [...]}
"""

import sys
import os
import json
import argparse
import traceback

# ── Resolve project root so imports work regardless of cwd ────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
FL_DIR       = os.path.join(PROJECT_ROOT, 'federated-learning')

# Add federated-learning dir to path so we can import SkinCancerModel etc.
for p in [FL_DIR, SCRIPT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

# ── Parse arguments ───────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='Local skin cancer inference')
parser.add_argument('--image',  required=True,  help='Absolute path to image file')
parser.add_argument('--model',  default=None,   help='Path to model weights (.pt)')
parser.add_argument('--device', default='auto', choices=['auto', 'cpu', 'cuda'],
                    help='Device to run inference on')
args = parser.parse_args()

def eprint(msg):
    """Print to stderr (shown as [stderr] in Electron log panel)."""
    print(msg, file=sys.stderr, flush=True)


def main():
    image_path = args.image

    # ── Validate image path ───────────────────────────────────────────────────
    if not os.path.isfile(image_path):
        result = {'error': f'Image not found: {image_path}', 'success': False}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    eprint(f'[inference] Image: {image_path}')

    # ── Device selection ──────────────────────────────────────────────────────
    try:
        import torch
        if args.device == 'auto':
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        else:
            device = args.device
        eprint(f'[inference] Device: {device}')
    except ImportError:
        eprint('[inference] WARNING: torch not found — cannot run inference')
        print(json.dumps({'error': 'PyTorch not installed', 'success': False}), flush=True)
        sys.exit(1)

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        from skin_cancer_model import SkinCancerModel  # from federated-learning/
        model_wrapper = SkinCancerModel(model_path=args.model, device=device)
        eprint('[inference] Model loaded')
    except Exception as e:
        eprint(f'[inference] Model load error: {e}')
        print(json.dumps({'error': f'Model load failed: {str(e)}', 'success': False}), flush=True)
        sys.exit(1)

    # ── Run inference ─────────────────────────────────────────────────────────
    try:
        from PIL import Image as PILImage
        img = PILImage.open(image_path).convert('RGB')
        eprint(f'[inference] Image loaded: {img.size}')

        prediction = model_wrapper.predict(img)
        eprint(f'[inference] Done: {prediction}')

        # Ensure the result has all the fields Electron/React expects
        result = {
            'success':      True,
            'class_name':   prediction.get('class_name', prediction.get('predicted_class', 'Unknown')),
            'confidence':   float(prediction.get('confidence', 0.0)),
            'risk_level':   prediction.get('risk_level', 'Unknown'),
            'top_predictions': prediction.get('top_predictions', []),
            'device':       device,
            'image_path':   image_path,
        }
    except Exception as e:
        eprint(f'[inference] Inference error: {traceback.format_exc()}')
        result = {'error': str(e), 'success': False}

    # ── Output JSON to stdout (Electron reads this) ───────────────────────────
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
