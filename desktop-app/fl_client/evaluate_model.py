"""
evaluate_model.py — Evaluate the global FL model on a local test dataset.

Usage:
  python evaluate_model.py \
    --data-dir   "D:\\Skin Cancer Dataset\\HAM10000_images_part_2" \
    [--metadata  "D:\\Skin Cancer Dataset\\HAM10000_metadata.csv"] \
    [--server    http://127.0.0.1:6000] \
    [--model-path ./local_weights/global_round_N.pt]

The script:
  1. Downloads the current global model from FL server  (or loads --model-path)
  2. Scans --data-dir for images listed in the metadata CSV
  3. Runs inference on every image (no training — eval mode only)
  4. Prints per-batch progress to stdout
  5. Prints a single JSON object as the LAST stdout line:
     {
       "success": true,
       "overall_accuracy": 0.876,
       "total_samples": 1234,
       "correct": 1079,
       "per_class": {
         "Melanoma": {"correct": 210, "total": 245, "accuracy": 0.857},
         ...
       },
       "top3_accuracy": 0.964,
       "model_source": "fl_server | local_checkpoint | pretrained"
     }
"""

import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

import requests
import torch
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset

# ── Import shared modules (injected via PYTHONPATH by Electron) ───────────────
from skin_cancer_model import SkinCancerModel

from torchvision import transforms

# ─────────────────────────────────────────────────────────────────────────────

LABEL_MAP = {
    "akiec": (0, "Actinic Keratosis"),
    "bcc":   (1, "Basal Cell Carcinoma"),
    "bkl":   (2, "Benign Keratosis"),
    "df":    (3, "Dermatofibroma"),
    "mel":   (4, "Melanoma"),
    "nv":    (5, "Nevus"),
    "vasc":  (6, "Vascular Lesion"),
}
IDX_TO_NAME = {v[0]: v[1] for v in LABEL_MAP.values()}


# ── Dataset ───────────────────────────────────────────────────────────────────

class TestDataset(Dataset):
    def __init__(self, samples, transform):
        self.samples  = samples   # list of (image_path, label_idx)
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        img = Image.open(path).convert("RGB")
        return self.transform(img), label, str(path)


# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg):
    print(msg, flush=True)


def find_csv(data_dir: Path):
    """Search common locations for HAM10000_metadata.csv."""
    candidates = [
        data_dir / "HAM10000_metadata.csv",
        data_dir.parent / "HAM10000_metadata.csv",
        data_dir.parent.parent / "HAM10000_metadata.csv",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def scan_images(data_dir: Path):
    """Return {image_id: path} for all images under data_dir."""
    exts = {".jpg", ".jpeg", ".png"}
    found = {}
    for f in data_dir.rglob("*"):
        if f.suffix.lower() in exts:
            found[f.stem] = f
    return found


def build_samples(data_dir: Path, metadata_path: Path = None):
    """
    Match metadata CSV rows to image files.
    Returns list of (path, label_idx) tuples.
    """
    if metadata_path is None or not metadata_path.exists():
        metadata_path = find_csv(data_dir)

    if metadata_path is None or not metadata_path.exists():
        log("[Eval] WARNING: No metadata CSV found – cannot map labels.")
        log("[Eval] Scanning images without ground truth labels is unsupported.")
        return []

    log(f"[Eval] Metadata: {metadata_path}")
    image_map = scan_images(data_dir)
    log(f"[Eval] Found {len(image_map)} images in {data_dir}")

    samples = []
    skipped_no_image = 0
    skipped_unknown_label = 0

    import csv
    with open(metadata_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            image_id = row.get("image_id", "").strip()
            dx       = row.get("dx", "").strip().lower()

            if image_id not in image_map:
                skipped_no_image += 1
                continue
            if dx not in LABEL_MAP:
                skipped_unknown_label += 1
                continue

            label_idx = LABEL_MAP[dx][0]
            samples.append((image_map[image_id], label_idx))

    log(f"[Eval] Matched {len(samples)} samples")
    log(f"[Eval] Skipped {skipped_no_image} (image not in folder) + "
        f"{skipped_unknown_label} (unknown label)")
    return samples


def load_model_weights(model: SkinCancerModel, server_url: str, model_path: str = None):
    """
    Try (in order):
      1. --model-path local file
      2. Latest checkpoint in ./local_weights/
      3. FL server download
    Returns a string describing the source.
    """
    # 1. Explicit local path
    if model_path and Path(model_path).exists():
        log(f"[Eval] Loading weights from {model_path}")
        state_dict = torch.load(model_path, map_location="cpu")
        model.set_model_state_dict(state_dict)
        return "local_file"

    # 2. Latest local checkpoint
    weights_dir = Path(__file__).parent / "local_weights"
    checkpoints = sorted(weights_dir.glob("global_round_*.pt"))
    if checkpoints:
        p = checkpoints[-1]
        log(f"[Eval] Loading latest checkpoint: {p.name}")
        state_dict = torch.load(str(p), map_location="cpu")
        model.set_model_state_dict(state_dict)
        return f"local_checkpoint ({p.name})"

    # 3. FL server download
    if server_url:
        try:
            log(f"[Eval] Downloading global model from {server_url} …")
            info_resp = requests.get(f"{server_url}/api/model/latest", timeout=10)
            info_resp.raise_for_status()
            info = info_resp.json()
            model_version = info.get("model_version", 0)

            if model_version == 0:
                log("[Eval] FL server has no trained model yet (round 0). "
                    "Using ImageNet pretrained weights.")
                return "pretrained"

            weights_resp = requests.get(
                f"{server_url}/api/model/weights", timeout=120
            )
            weights_resp.raise_for_status()
            payload   = weights_resp.json()
            raw       = base64.b64decode(payload["weights_b64"])
            state_dict = torch.load(io.BytesIO(raw), map_location="cpu")
            model.set_model_state_dict(state_dict)
            log(f"[Eval] Loaded global model round {model_version} from FL server")
            return f"fl_server (round {model_version})"

        except Exception as e:
            log(f"[Eval] FL server download failed: {e}")
            log("[Eval] Falling back to ImageNet pretrained weights.")

    return "pretrained"


# ── Main evaluation loop ──────────────────────────────────────────────────────

def evaluate(data_dir: str, metadata_path: str, server_url: str, model_path: str):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log(f"[Eval] Device: {device}")

    # Load model
    log("[Eval] Initialising model …")
    model = SkinCancerModel()
    source = load_model_weights(model, server_url, model_path)

    net = model.model if hasattr(model, "model") else model
    net = net.to(device).eval()

    # Build dataset
    samples = build_samples(Path(data_dir), Path(metadata_path) if metadata_path else None)
    if not samples:
        print(json.dumps({
            "success": False,
            "error":   "No matched samples found. Check --data-dir and metadata CSV.",
        }), flush=True)
        return

    # Evaluation transforms (no augmentation)
    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])
    dataset   = TestDataset(samples, transform)
    loader    = DataLoader(dataset, batch_size=32, num_workers=0, shuffle=False)

    log(f"[Eval] Evaluating {len(dataset)} samples in {len(loader)} batches …")

    # Per-class trackers
    class_correct = {name: 0 for name in IDX_TO_NAME.values()}
    class_total   = {name: 0 for name in IDX_TO_NAME.values()}

    total_correct = 0
    top3_correct  = 0
    total_samples = 0

    with torch.no_grad():
        for batch_idx, (images, labels, _paths) in enumerate(loader):
            images = images.to(device)
            labels = labels.to(device)

            logits = net(images)                          # [B, 7]
            probs  = F.softmax(logits, dim=1)

            # Top-1
            preds = logits.argmax(dim=1)
            correct_mask = preds.eq(labels)
            total_correct += correct_mask.sum().item()

            # Top-3
            top3_preds = probs.topk(3, dim=1).indices   # [B, 3]
            for i, lbl in enumerate(labels):
                if lbl in top3_preds[i]:
                    top3_correct += 1

            # Per-class
            for i in range(len(labels)):
                name = IDX_TO_NAME[labels[i].item()]
                class_total[name]   += 1
                if correct_mask[i].item():
                    class_correct[name] += 1

            total_samples += len(labels)

            # Progress
            done = batch_idx + 1
            pct  = 100 * total_samples / len(dataset)
            running_acc = 100 * total_correct / total_samples
            log(f"[Eval] Batch {done}/{len(loader)} "
                f"({pct:.0f}%)  running accuracy: {running_acc:.1f}%")

    # Build result
    per_class = {}
    for name in IDX_TO_NAME.values():
        tot = class_total[name]
        per_class[name] = {
            "correct":  class_correct[name],
            "total":    tot,
            "accuracy": round(class_correct[name] / tot, 4) if tot > 0 else None,
        }

    overall_accuracy = round(total_correct / total_samples, 4) if total_samples else 0
    top3_accuracy    = round(top3_correct  / total_samples, 4) if total_samples else 0

    log(f"[Eval] [OK] Done!  Overall accuracy: {overall_accuracy * 100:.2f}%  "
        f"| Top-3: {top3_accuracy * 100:.2f}%")

    result = {
        "success":          True,
        "overall_accuracy": overall_accuracy,
        "top3_accuracy":    top3_accuracy,
        "total_samples":    total_samples,
        "correct":          total_correct,
        "per_class":        per_class,
        "model_source":     source,
        "device":           str(device),
    }

    # LAST LINE must be the JSON result (parsed by Electron)
    print(json.dumps(result), flush=True)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate the global FL model accuracy")
    parser.add_argument("--data-dir",    required=True, help="Folder containing test images")
    parser.add_argument("--metadata",    default=None,  help="Path to HAM10000_metadata.csv")
    parser.add_argument("--server",      default="http://127.0.0.1:6000",
                        help="FL server base URL")
    parser.add_argument("--model-path",  default=None,  help="Local .pt weights file (overrides server)")
    args = parser.parse_args()

    try:
        evaluate(
            data_dir=args.data_dir,
            metadata_path=args.metadata,
            server_url=args.server,
            model_path=args.model_path,
        )
    except Exception as exc:
        import traceback
        traceback.print_exc()
        print(json.dumps({"success": False, "error": str(exc)}), flush=True)
        sys.exit(1)
