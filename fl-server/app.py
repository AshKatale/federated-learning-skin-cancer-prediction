"""
FL Server - Production REST API
Standalone deployable service (AWS/Azure/Docker)
Handles: model aggregation, global model versioning, inference for web users
"""

import os
import io
import json
import time
import base64
import logging
import threading
from pathlib import Path
from datetime import datetime, timezone

import torch
import numpy as np
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from model import SkinCancerModel
from aggregator import FedAvgAggregator
from round_manager import RoundManager

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024

# ── Config from env ──────────────────────────────────────────────────────────
MODELS_DIR = Path(os.getenv("MODELS_DIR", "./models/global"))
ROUND_DURATION = int(os.getenv("ROUND_DURATION_SECONDS", 86400))  # 24 h default
CLIENT_UPDATES_DIR = Path(os.getenv("CLIENT_UPDATES_DIR", "./client_updates"))

MODELS_DIR.mkdir(parents=True, exist_ok=True)
CLIENT_UPDATES_DIR.mkdir(parents=True, exist_ok=True)

# ── Singletons ────────────────────────────────────────────────────────────────
round_manager = RoundManager(
    models_dir=MODELS_DIR,
    updates_dir=CLIENT_UPDATES_DIR,
    round_duration=ROUND_DURATION,
)
global_model = SkinCancerModel()
aggregator = FedAvgAggregator()

# Load latest saved global model weights if they exist
_latest = round_manager.latest_model_path()
if _latest:
    global_model.load_weights(_latest)
    logger.info(f"Loaded global model from {_latest}")
else:
    logger.info("No saved global model found – starting from ImageNet pretrained weights")


# ── Background round controller ───────────────────────────────────────────────
def _round_loop():
    """Runs in a daemon thread; aggregates at end of every round window."""
    while True:
        now = time.time()
        deadline = round_manager.current_round_deadline()
        sleep_secs = max(0, deadline - now)
        logger.info(
            f"Round {round_manager.current_round()} ends in {sleep_secs/3600:.2f} h"
        )
        time.sleep(sleep_secs)
        _aggregate_and_advance()


def _aggregate_and_advance():
    updates = round_manager.collect_pending_updates()
    if not updates:
        logger.warning("No client updates received this round – skipping aggregation")
        round_manager.advance_round(model_path=None)
        return

    logger.info(f"Aggregating {len(updates)} client update(s)")
    new_state = aggregator.fedavg(updates)

    global_model.set_state_dict(new_state)
    model_path = round_manager.save_global_model(global_model.get_state_dict())
    round_manager.advance_round(model_path=model_path)
    logger.info(f"Round complete – saved {model_path}")


# Start background loop
_bg = threading.Thread(target=_round_loop, daemon=True)
_bg.start()


# ═══════════════════════════════════════════════════════════════════════════════
# HEALTH
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "fl-server",
        "current_round": round_manager.current_round(),
        "round_deadline": datetime.fromtimestamp(
            round_manager.current_round_deadline(), tz=timezone.utc
        ).isoformat(),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# MODEL VERSIONING
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/model/latest", methods=["GET"])
def get_latest_model_info():
    """Clients poll this to check if a newer global model is available."""
    return jsonify({
        "round": round_manager.current_round(),
        "round_deadline": datetime.fromtimestamp(
            round_manager.current_round_deadline(), tz=timezone.utc
        ).isoformat(),
        "model_version": round_manager.current_round() - 1,  # last completed round
    })


@app.route("/api/model/weights", methods=["GET"])
def download_global_weights():
    """
    Download current global model weights as base64-encoded state_dict.
    Clients fetch this to bootstrap local training.
    """
    state = global_model.get_state_dict()
    buf = io.BytesIO()
    torch.save(state, buf)
    buf.seek(0)
    encoded = base64.b64encode(buf.read()).decode("utf-8")
    return jsonify({
        "round": round_manager.current_round() - 1,
        "weights_b64": encoded,
        "timestamp": datetime.now(tz=timezone.utc).isoformat(),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT UPDATE SUBMISSION
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/client/update", methods=["POST"])
def receive_client_update():
    """
    Desktop clients POST their locally-trained state_dict here.
    Body JSON:
      {
        "client_id": "hospital_a",
        "round": 3,
        "num_samples": 150,
        "weights_b64": "<base64 encoded torch.save(state_dict)>"
      }
    Only weights are transferred – NO raw data.
    """
    data = request.get_json(force=True)
    required = ("client_id", "round", "num_samples", "weights_b64")
    if not all(k in data for k in required):
        return jsonify({"error": f"Missing fields: {required}"}), 400

    client_id = data["client_id"]
    client_round = int(data["round"])
    num_samples = int(data["num_samples"])

    # Reject updates for wrong round
    current = round_manager.current_round()
    if client_round != current:
        return jsonify({
            "error": f"Update for round {client_round} rejected – current round is {current}"
        }), 409

    # Decode and persist the state_dict
    try:
        raw = base64.b64decode(data["weights_b64"])
        buf = io.BytesIO(raw)
        state_dict = torch.load(buf, map_location="cpu")
    except Exception as e:
        return jsonify({"error": f"Failed to decode weights: {e}"}), 400

    round_manager.save_client_update(client_id, client_round, state_dict, num_samples)
    logger.info(f"Received update from {client_id} (round {client_round}, {num_samples} samples)")

    return jsonify({
        "status": "accepted",
        "client_id": client_id,
        "round": client_round,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# INFERENCE (for web app users – no local model needed)
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Web users send an image; server runs inference on the global model.
    Accepts multipart/form-data with field 'image'.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image field in request"}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        img_bytes = file.read()
        pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        result = global_model.predict(pil_img)
        return jsonify({"success": True, "prediction": result})
    except Exception as e:
        logger.error(f"Inference error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/round/status", methods=["GET"])
def round_status():
    """Admin / dashboard endpoint – current round state."""
    return jsonify(round_manager.status())


if __name__ == "__main__":
    port = int(os.getenv("FL_SERVER_PORT", 6000))
    logger.info(f"FL Server starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
