"""
FL Client for Desktop App
Responsibilities:
  1. Download global model weights from FL server
  2. Train locally on private dataset (no raw data leaves device)
  3. Upload only weight deltas (state_dict) to FL server
  4. Expose local inference endpoint for Electron IPC
"""

import os
import io
import json
import base64
import logging
import threading
import time
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import torch
import requests
from PIL import Image
from flask import Flask, request, jsonify

from model import SkinCancerModel
from trainer import LocalTrainer
from scheduler import TrainingScheduler

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
# FL Server URL — must match fl-server/app.py port (default 8080)
FL_SERVER_URL = os.getenv("FL_SERVER_URL", "http://127.0.0.1:6000")
CLIENT_ID = os.getenv("CLIENT_ID", "desktop_client_1")
LOCAL_DATA_DIR = os.getenv("LOCAL_DATA_DIR", r"D:\Skin Cancer Dataset")
LOCAL_METADATA = os.getenv("LOCAL_METADATA", r"D:\Skin Cancer Dataset\HAM10000_metadata.csv")
WEIGHTS_DIR = Path(os.getenv("WEIGHTS_DIR", "./local_weights"))
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL_SECONDS", 3600))  # check server every 1h

WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Lazy singletons (Flask starts immediately; model loads on first use) ───────
_local_model = None
_scheduler   = None

def get_model():
    """Return shared SkinCancerModel, initializing it only on first call."""
    global _local_model
    if _local_model is None:
        logger.info("[lazy] Loading SkinCancerModel (EfficientNet-B0)…")
        _local_model = SkinCancerModel()
        logger.info("[lazy] Model ready")
    return _local_model

def get_scheduler():
    global _scheduler
    if _scheduler is None:
        _scheduler = TrainingScheduler()
    return _scheduler

_known_server_round = 0  # last round we synced from server


# ── Model sync helpers ────────────────────────────────────────────────────────

def _download_global_model() -> bool:
    """
    Fetch global model weights from FL server and load into local_model.
    Returns True if a newer model was downloaded.
    """
    global _known_server_round
    try:
        info = requests.get(f"{FL_SERVER_URL}/api/model/latest", timeout=10).json()
        server_round = int(info.get("model_version", 0))

        if server_round <= _known_server_round:
            logger.info("Local model is already up to date (round %d)", _known_server_round)
            return False

        logger.info("Downloading global model (round %d → %d)…", _known_server_round, server_round)
        resp = requests.get(f"{FL_SERVER_URL}/api/model/weights", timeout=60)
        payload = resp.json()

        raw = base64.b64decode(payload["weights_b64"])
        state_dict = torch.load(io.BytesIO(raw), map_location="cpu")
        get_model().set_state_dict(state_dict)

        # Persist locally so we survive restarts without re-downloading
        _save_local_checkpoint(server_round, state_dict)
        _known_server_round = server_round
        logger.info("Global model round %d loaded", server_round)
        return True

    except requests.exceptions.ConnectionError:
        logger.warning("FL server unreachable – using existing local model (offline mode)")
        return False
    except Exception as e:
        logger.error("Sync failed: %s", e)
        return False


def _save_local_checkpoint(round_num: int, state_dict: dict):
    path = WEIGHTS_DIR / f"global_round_{round_num}.pt"
    torch.save(state_dict, path)


def _load_latest_local_checkpoint():
    """Load last persisted global model on startup (offline resilience)."""
    files = sorted(WEIGHTS_DIR.glob("global_round_*.pt"))
    if not files:
        return
    state_dict = torch.load(files[-1], map_location="cpu")
    get_model().set_state_dict(state_dict)   # triggers lazy load
    logger.info("Loaded local checkpoint %s", files[-1])


def _upload_weights(state_dict: dict, num_samples: int, round_num: int) -> bool:
    """
    Send locally-trained state_dict to FL server.
    Only weights – no raw data.
    """
    try:
        buf = io.BytesIO()
        torch.save(state_dict, buf)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode("utf-8")

        payload = {
            "client_id": CLIENT_ID,
            "round": round_num,
            "num_samples": num_samples,
            "weights_b64": encoded,
        }
        resp = requests.post(
            f"{FL_SERVER_URL}/api/client/update",
            json=payload,
            timeout=120,
        )
        if resp.status_code == 200:
            logger.info("Weights uploaded for round %d (%d samples)", round_num, num_samples)
            return True
        else:
            logger.error("Upload rejected: %s", resp.text)
            return False
    except requests.exceptions.ConnectionError:
        logger.warning("Upload failed – will retry next sync cycle")
        return False


# ── Background sync loop ──────────────────────────────────────────────────────

def _sync_loop():
    """
    Periodically:
      1. Check for new global model → download if available
      2. If scheduler says OK to train → train locally → upload weights
    """
    while True:
        time.sleep(SYNC_INTERVAL)
        _sync_once()


def _sync_once():
    global _known_server_round
    updated = _download_global_model()

    if get_scheduler().should_train():
        logger.info("Scheduler: OK to train")
        _run_local_training()
    else:
        logger.info("Scheduler: deferring training (device busy / user active)")


def _run_local_training():
    """Train locally and upload result."""
    global _known_server_round
    try:
        trainer = LocalTrainer(
            model=get_model(),
            data_dir=LOCAL_DATA_DIR,
            metadata_path=LOCAL_METADATA,
        )
        num_samples = trainer.prepare_data(samples_per_class=999999)  # Use ALL images
        if num_samples == 0:
            logger.warning("No training data found in %s", LOCAL_DATA_DIR)
            return

        trainer.train(epochs=int(os.getenv("LOCAL_EPOCHS", 1)))
        state_dict = get_model().get_state_dict()

        success = _upload_weights(state_dict, num_samples, round_num=_known_server_round + 1)
        if not success:
            # Queue for next sync
            _queue_upload(state_dict, num_samples, round_num=_known_server_round + 1)
    except Exception as e:
        logger.error("Local training failed: %s", e)


def _queue_upload(state_dict: dict, num_samples: int, round_num: int):
    """Persist failed upload for retry on next connectivity window."""
    queue_dir = WEIGHTS_DIR / "upload_queue"
    queue_dir.mkdir(exist_ok=True)
    torch.save(state_dict, queue_dir / f"pending_round_{round_num}.pt")
    meta = {"num_samples": num_samples, "round": round_num}
    with open(queue_dir / f"pending_round_{round_num}_meta.json", "w") as f:
        json.dump(meta, f)
    logger.info("Upload queued for later (round %d)", round_num)


def _flush_upload_queue():
    """Retry any queued uploads when connectivity is restored."""
    queue_dir = WEIGHTS_DIR / "upload_queue"
    if not queue_dir.exists():
        return
    for meta_file in queue_dir.glob("*_meta.json"):
        with open(meta_file) as f:
            meta = json.load(f)
        weights_file = meta_file.with_name(meta_file.name.replace("_meta.json", ".pt"))
        if not weights_file.exists():
            continue
        sd = torch.load(weights_file, map_location="cpu")
        ok = _upload_weights(sd, meta["num_samples"], meta["round"])
        if ok:
            meta_file.unlink()
            weights_file.unlink()


# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL HTTP API  (for Electron IPC via preload / renderer)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "fl-desktop-client",
        "client_id": CLIENT_ID,
        "synced_round": _known_server_round,
    })


@app.route("/api/predict", methods=["POST"])
def local_predict():
    """
    Local inference – runs entirely on device, no network required.
    Accepts multipart/form-data with field 'image'.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image provided"}), 400
    file = request.files["image"]
    try:
        img = Image.open(io.BytesIO(file.read())).convert("RGB")
        result = get_model().predict(img)    # triggers lazy load if not yet loaded
        return jsonify({
            "success": True,
            "inference_mode": "local",
            "prediction": result,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/sync", methods=["POST"])
def manual_sync():
    """Triggered by Electron – force sync now."""
    updated = _download_global_model()
    _flush_upload_queue()
    return jsonify({
        "updated": updated,
        "synced_round": _known_server_round,
    })


@app.route("/api/train", methods=["POST"])
def manual_train():
    """Triggered by Electron – start local training in background."""
    t = threading.Thread(target=_run_local_training, daemon=True)
    t.start()
    return jsonify({"status": "training_started", "client_id": CLIENT_ID})


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify({
        "client_id": CLIENT_ID,
        "synced_round": _known_server_round,
        "fl_server": FL_SERVER_URL,
        "training_allowed": get_scheduler().should_train(),
        "data_dir": LOCAL_DATA_DIR,
    })


@app.route("/api/set-dataset", methods=["POST"])
def set_dataset():
    """Triggered by Electron - sets the dataset path."""
    global LOCAL_DATA_DIR
    data = request.json
    new_dir = data.get("data_dir")
    
    if not new_dir or not os.path.exists(new_dir):
        return jsonify({"error": "Invalid directory"}), 400
        
    LOCAL_DATA_DIR = new_dir
    return jsonify({"success": True, "data_dir": LOCAL_DATA_DIR})


# ── Startup ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    _load_latest_local_checkpoint()
    _download_global_model()         # Initial sync
    _flush_upload_queue()            # Retry any pending uploads

    # Background sync thread
    bg = threading.Thread(target=_sync_loop, daemon=True)
    bg.start()

    port = int(os.getenv("FL_CLIENT_PORT", 7000))
    logger.info("FL Desktop Client running on port %d", port)
    app.run(host="127.0.0.1", port=port, debug=False)
