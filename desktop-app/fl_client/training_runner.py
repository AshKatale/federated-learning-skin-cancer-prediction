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
import argparse
import traceback

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
parser.add_argument('--epochs',     default='1', type=int,               help='Local training epochs')
parser.add_argument('--server',     default='127.0.0.1:8080',            help='FL server address host:port')
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
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
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
        from skin_cancer_model import SkinCancerModel
        from fl_data_loader     import FLDataLoader
        log('[FL Training] FL modules imported OK')
    except ImportError as e:
        log(f'[FL Training] ERROR: Cannot import FL modules: {e}')
        result = {'success': False, 'error': str(e)}
        print(json.dumps(result), flush=True)
        sys.exit(1)

    # ── Load model ────────────────────────────────────────────────────────────
    try:
        log('[FL Training] Loading EfficientNet model…')
        model_wrapper = SkinCancerModel(model_path=args.model, device=device)
        model = model_wrapper.model
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

        X_train, y_train, X_val, y_val = FLDataLoader.load_client_data(
            client_id=args.client_id,
            dataset_path=image_dir,          # the actual selected images folder
            metadata_path=metadata_path,
            transform_fn=model_wrapper.get_transforms,
            samples_per_client=999999,       # use ALL images in selected folder
        )
        log(f'[FL Training] Data loaded — train={len(X_train)}, val={len(y_val)}')

        if len(X_train) == 0:
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
        import torch.optim as optim
        import torch.nn as nn
        import numpy as np

        optimizer = optim.Adam(model.parameters(), lr=args.lr)
        criterion = nn.CrossEntropyLoss()

        # Convert to tensors if needed
        if not isinstance(X_train, torch.Tensor):
            X_train = torch.tensor(np.array(X_train), dtype=torch.float32)
            y_train = torch.tensor(np.array(y_train), dtype=torch.long)

        dataset = torch.utils.data.TensorDataset(X_train, y_train)
        loader  = torch.utils.data.DataLoader(dataset, batch_size=32, shuffle=True)

        for epoch in range(1, args.epochs + 1):
            model.train()
            total_loss, correct, total = 0.0, 0, 0

            for batch_idx, (images, labels) in enumerate(loader):
                images, labels = images.to(device), labels.to(device)
                optimizer.zero_grad()
                outputs = model(images)
                loss    = criterion(outputs, labels)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                _, predicted = outputs.max(1)
                correct += predicted.eq(labels).sum().item()
                total   += labels.size(0)

                if (batch_idx + 1) % 5 == 0:
                    log(f'[FL Training] Epoch {epoch}/{args.epochs} '
                        f'Batch {batch_idx+1}/{len(loader)} '
                        f'Loss={total_loss/(batch_idx+1):.4f} '
                        f'Acc={100.*correct/total:.1f}%')

            acc  = 100. * correct / total if total > 0 else 0
            loss_avg = total_loss / len(loader) if len(loader) > 0 else 0
            log(f'[FL Training] ✅ Epoch {epoch}/{args.epochs} complete — '
                f'Loss={loss_avg:.4f} Acc={acc:.1f}%')

        # ── Save local weights ────────────────────────────────────────────────
        weights_dir = os.path.join(SCRIPT_DIR, 'local_weights')
        os.makedirs(weights_dir, exist_ok=True)
        checkpoint_path = os.path.join(weights_dir, f'client_{args.client_id}_trained.pt')
        torch.save(model.state_dict(), checkpoint_path)
        log(f'[FL Training] Weights saved → {checkpoint_path}')

        result = {
            'success':      True,
            'client_id':    args.client_id,
            'epochs':       args.epochs,
            'final_loss':   round(loss_avg, 4),
            'final_acc':    round(acc, 2),
            'samples':      total,
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
