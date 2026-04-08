#!/usr/bin/env python3
"""
training_runner.py  —  CLI training wrapper called by Electron main process
=============================================================================
Electron spawns this script and captures stdout line-by-line, streaming each
line to the React UI via IPC ('training-log' channel).

Usage (called automatically by Electron):
    python training_runner.py \
        --client-id 1 \
        --data-dir "D:/Skin Cancer Dataset" \
        --epochs 2 \
        --server 127.0.0.1:8080

Prints:
    - Progress lines to stdout (streamed to UI)
    - Errors to stderr
    - Final JSON summary on the last stdout line (for Electron to parse)
"""

import sys
import os
import json
import requests
import argparse
import traceback
import base64

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
FL_DIR       = os.path.join(PROJECT_ROOT, 'federated-learning')

for p in [FL_DIR, SCRIPT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Force unbuffered output so Electron receives lines in real-time
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)

# ── Parse arguments ───────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description='Local FL training runner')
parser.add_argument('--client-id',  default='1',                         help='Client identifier')
parser.add_argument('--data-dir',   default=r'D:\Skin Cancer Dataset',   help='Dataset root folder')
parser.add_argument('--epochs',     default='8', type=int,               help='Local training epochs (increased from 1 for better convergence)')
parser.add_argument('--server',     default='127.0.0.1:8080',            help='FL server address host:port')
parser.add_argument('--device',     default='cpu',                       help='Device to use: cpu or cuda')
parser.add_argument('--model',      default=None,                        help='Path to initial model weights')
parser.add_argument('--lr',         default='0.001', type=float,         help='Learning rate')
args = parser.parse_args()


def log(msg):
    """Print a progress line — Electron streams this to the React log panel."""
    print(msg, flush=True)


def main():
    log(f'[FL Training] Starting — client_id={args.client_id}')
    log(f'[FL Training] Dataset: {args.data_dir}')
    log(f'[FL Training] Epochs:  {args.epochs}')
    log(f'[FL Training] Server:  {args.server}')
    log(f'[FL Training] Device:  {args.device}')

    # ── Validate & normalize dataset path ────────────────────────────────────
    if not os.path.isdir(args.data_dir):
        log(f'[FL Training] ERROR: Dataset folder not found: {args.data_dir}')
        log(f'[FL Training] Please select a valid dataset folder in the app.')
        result = {'success': False, 'error': f'Dataset not found: {args.data_dir}'}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    # FLDataLoader expects image_dir = the folder with actual images.
    # If user selected a part subfolder, we keep it as-is for image scanning.
    # We also derive the CSV search root (may be parent if a part subfolder was selected).
    image_dir = args.data_dir
    folder_name = os.path.basename(image_dir)
    if folder_name.startswith('HAM10000_images_part'):
        data_dir = os.path.dirname(image_dir)  # parent — used ONLY for CSV lookup
        log(f'[FL Training] Image folder:    {image_dir}')
        log(f'[FL Training] CSV search root: {data_dir}')
    else:
        data_dir = image_dir  # same folder used for both
        log(f'[FL Training] Dataset root: {data_dir}')

    # ── Import dependencies ───────────────────────────────────────────────────
    try:
        import torch
        log(f'[FL Training] PyTorch {torch.__version__} loaded')
        
        # Use requested device, validating CUDA availability
        device = args.device.lower()
        if device == 'cuda':
            if torch.cuda.is_available():
                log(f'[FL Training] GPU: {torch.cuda.get_device_name(0)}')
                log(f'[FL Training] Using CUDA (fast training)')
            else:
                log(f'[FL Training] WARNING: CUDA requested but not available. Falling back to CPU.')
                log(f'[FL Training] To use GPU, install: pip install torch --index-url https://download.pytorch.org/whl/cu121')
                device = 'cpu'
        else:
            log(f'[FL Training] Using CPU (slower training)')
        
        log(f'[FL Training] Device: {device}')
    except ImportError:
        log('[FL Training] ERROR: PyTorch not installed in the active Python environment.')
        log(f'[FL Training] Python executable : {sys.executable}')
        log(f'[FL Training] PYTHONPATH        : {os.environ.get("PYTHONPATH", "(not set)")}')
        log(f'[FL Training] Fix: activate your venv and run:')
        log(f'[FL Training]   pip install torch torchvision')
        result = {'success': False, 'error': 'PyTorch not installed',
                  'python': sys.executable,
                  'hint': 'Run: pip install torch torchvision in your project venv'}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    try:
        from model import SkinCancerModel, TRAIN_TRANSFORM
        from trainer import LocalTrainer
        log('[FL Training] FL modules imported OK')
    except ImportError as e:
        log(f'[FL Training] ERROR: Cannot import FL modules: {e}')
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        log('[FL Training] Loading EfficientNet model…')
        model_wrapper = SkinCancerModel(device=device)
        if args.model and os.path.exists(args.model):
            model_wrapper.load_weights(args.model)
            log(f'[FL Training] Loaded weights from {args.model}')
        model = model_wrapper.net
        model.to(device)
        log('[FL Training] Model ready')
    except Exception as e:
        log(f'[FL Training] ERROR loading model: {e}')
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    # ── Load data ─────────────────────────────────────────────────────────────
    try:
        # Auto-discover metadata CSV:
        # 1. In the selected folder itself
        # 2. In the parent folder (user may have selected an images subfolder)
        parent_dir = os.path.dirname(data_dir)
        candidates = [
            os.path.join(image_dir,  'HAM10000_metadata.csv'),  # in selected folder
            os.path.join(data_dir,   'HAM10000_metadata.csv'),  # in CSV root
            os.path.join(parent_dir, 'HAM10000_metadata.csv'),  # one level up
        ]
        metadata_path = next((p for p in candidates if os.path.isfile(p)), None)

        if metadata_path is None:
            log(f'[FL Training] ERROR: HAM10000_metadata.csv not found.')
            log(f'[FL Training] Searched: {candidates[0]}')
            log(f'[FL Training] Searched: {candidates[1]}')
            log(f'[FL Training] Please place HAM10000_metadata.csv in your dataset folder.')
            result = {'success': False, 'error': 'HAM10000_metadata.csv not found'}
            print(json.dumps(result), flush=True)
            sys.exit(1)

        log(f'[FL Training] Metadata found: {metadata_path}')
        log(f'[FL Training] Loading client data (client_id={args.client_id})…')

        # Get current round from FL server (with retry logic)
        fl_server_url = f'http://{args.server}' if '://' not in args.server else args.server
        current_round = None
        
        # Retry loop: try up to 3 times to fetch the round
        for attempt in range(1, 4):
            try:
                resp = requests.get(f'{fl_server_url}/api/round/status', timeout=5)
                if resp.status_code == 200:
                    current_round = resp.json().get('current_round')
                    if current_round is not None:
                        log(f'[FL Training] ✓ Fetched current round: {current_round}')
                        break
            except Exception as e:
                if attempt < 3:
                    log(f'[FL Training] ⚠ Round fetch attempt {attempt}/3 failed: {e}')
                else:
                    log(f'[FL Training] ⚠ Could not fetch round number after 3 attempts: {e}')
        
        # Fallback strategy if round could not be determined
        if current_round is None:
            # Try to use environment variable or cached round
            cached_round = os.environ.get('FL_CURRENT_ROUND')
            if cached_round and cached_round.isdigit():
                current_round = int(cached_round)
                log(f'[FL Training] ⚠ Using cached round from environment: {current_round}')
            else:
                log(f'[FL Training] ⚠ Could not determine current round. Weights will NOT be uploaded.')
                log(f'[FL Training] ⚠ Suggestion: Start FL server before running training.')
                current_round = -1  # Use -1 to indicate "unknown", will skip upload

        # Use LocalTrainer to prepare data
        trainer = LocalTrainer(model_wrapper, image_dir, metadata_path, 
                              server_url=fl_server_url, client_id=args.client_id)
        num_samples = trainer.prepare_data(samples_per_class=999999)  # use ALL images
        log(f'[FL Training] Data loaded — {num_samples} samples')

        if num_samples == 0:
            log('[FL Training] ERROR: No training samples found. Check dataset path.')
            result = {'success': False, 'error': 'No training data'}
            print(json.dumps(result), flush=True)
            sys.exit(1)
    except Exception as e:
        log(f'[FL Training] ERROR loading data: {e}')
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    # ── Train ─────────────────────────────────────────────────────────────────
    try:
        log(f'[FL Training] Starting training for {args.epochs} epochs…')
        loss_avg, acc, num_samples = trainer.train(epochs=args.epochs, batch_size=16, 
                                                    lr=args.lr, round_num=current_round)
        log(f'[FL Training] [OK] Training complete — Loss={loss_avg:.4f} Acc={acc:.1f}%')

        # ── Save local weights ────────────────────────────────────────────────
        weights_dir = os.path.join(SCRIPT_DIR, 'local_weights')
        os.makedirs(weights_dir, exist_ok=True)
        checkpoint_path = os.path.join(weights_dir, f'client_{args.client_id}_trained.pt')
        model_wrapper.save_weights(checkpoint_path)
        log(f'[FL Training] Weights saved → {checkpoint_path}')

        # ── Auto-upload trained weights to FL server ──────────────────────────
        if current_round >= 0:
            log(f'[FL Training] Auto-uploading weights to FL server (round {current_round})…')
            try:
                # Load trained weights and upload to FL server's /api/client/update endpoint
                state_dict = torch.load(checkpoint_path, map_location='cpu')
                weights_b64 = model_wrapper._state_dict_to_b64(state_dict)
                
                fl_server_url = f'http://{args.server}' if '://' not in args.server else args.server
                upload_response = requests.post(
                    f'{fl_server_url}/api/client/update',
                    json={
                        'client_id': args.client_id,
                        'round': current_round,
                        'num_samples': num_samples,
                        'weights_b64': weights_b64,
                    },
                    timeout=30
                )
                
                if upload_response.status_code == 200:
                    log(f'[FL Training] ✓ Weights uploaded successfully')
                else:
                    log(f'[FL Training] ⚠ Upload response: {upload_response.status_code}')
                    log(f'[FL Training] Response: {upload_response.text}')
            except Exception as upload_err:
                log(f'[FL Training] ⚠ Upload failed (non-fatal): {upload_err}')
        else:
            log(f'[FL Training] ⚠ Skipping upload: could not determine current round')
            log(f'[FL Training] ⚠ Weights saved locally but NOT uploaded to server')

        result = {
            'success':      True,
            'client_id':    args.client_id,
            'epochs':       args.epochs,
            'final_loss':   round(loss_avg, 4),
            'final_acc':    round(acc, 2),
            'samples':      num_samples,
            'checkpoint':   checkpoint_path,
        }
        log('[FL Training] 🎉 Training complete')

    except Exception as e:
        log(f'[FL Training] ERROR during training: {e}')
        traceback.print_exc(file=sys.stderr)
        result = {'success': False, 'error': str(e)}

    # ── Print final JSON (Electron reads this line) ───────────────────────────
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
