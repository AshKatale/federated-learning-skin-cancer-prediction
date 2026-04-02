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

# ── Client Heartbeat Tracker ─────────────────────────────────────────────────
# Track which clients are actively training in the current round
_client_heartbeats = {}  # {round: {client_id: {status, progress, timestamp}}}
_heartbeat_lock = threading.Lock()

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
    
    # Get previous global state for FedProx proximal term
    prev_state = global_model.get_state_dict()
    
    # Use FedProx (improved over FedAvg for non-IID data)
    # mu=0.01 balances convergence speed and robustness to data heterogeneity
    new_state = aggregator.fedprox(updates, global_state=prev_state, mu=0.01)

    global_model.set_state_dict(new_state)
    model_path = round_manager.save_global_model(global_model.get_state_dict())
    
    # Clear heartbeats for completed round
    current_round = round_manager.current_round()
    with _heartbeat_lock:
        if current_round in _client_heartbeats:
            del _client_heartbeats[current_round]
    
    round_manager.advance_round(model_path=model_path)
    logger.info(f"Round complete – saved {model_path}")
    
    # ── Notify Node.js server of round completion for dashboard analytics ────
    # (non-blocking; log errors but don't fail the aggregation)
    try:
        import requests
        node_server_url = os.getenv("NODE_SERVER_URL", "http://localhost:3001")
        payload = {
            "roundNumber": current_round,
            "globalModelPerformance": {
                "accuracy": 0.0,  # TODO: Calculate if test dataset available
                "loss": 0.0,
            }
        }
        requests.post(
            f"{node_server_url}/api/federated-learning/rounds/complete",
            json=payload,
            timeout=5
        )
        logger.info(f"Notified Node.js server of round {current_round} completion")
    except Exception as e:
        logger.warning(f"Failed to notify Node.js server: {e}")


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


@app.route("/api/round/initiate-training", methods=["POST"])
def initiate_training():
    """
    Called by Node.js server when admin clicks "Start New Round".
    Tells all clients that the current round is now accepting training submissions.
    Clients should fetch global model and start training.
    """
    try:
        current_round = round_manager.current_round()
        logger.info(f"[Admin] Initiating training for round {current_round}")
        return jsonify({
            "success": True,
            "round": current_round,
            "should_train": True,
            "message": f"Round {current_round} open for client training submissions"
        }), 200
    except Exception as e:
        logger.error(f"Error initiating training: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/round/aggregate", methods=["POST"])
def trigger_aggregation():
    """Manually trigger round aggregation immediately (admin endpoint)."""
    try:
        logger.info("[Admin] Manual aggregation requested")
        _aggregate_and_advance()
        return jsonify({
            "success": True,
            "message": "Aggregation completed",
            "current_round": round_manager.current_round(),
            "model_path": round_manager.latest_model_path()
        }), 200
    except Exception as e:
        logger.error(f"Aggregation failed: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ═══════════════════════════════════════════════════════════════════════════════
# CLIENT HEARTBEAT MONITORING
# ═══════════════════════════════════════════════════════════════════════════════

@app.route("/api/client/heartbeat", methods=["POST"])
def client_heartbeat():
    """
    Clients send periodic heartbeats during training.
    Body JSON:
      {
        "client_id": "client_win32_OZA19D",
        "round": 1,
        "status": "training",  // or "completed"
        "progress": 0.45,      // 0.0 to 1.0
        "timestamp": 1701234567.89
      }
    """
    try:
        data = request.get_json(force=True)
        client_id = data.get("client_id", "unknown")
        round_num = int(data.get("round", 0))
        status = data.get("status", "training")
        progress = float(data.get("progress", 0.0))
        timestamp = float(data.get("timestamp", time.time()))
        
        # Store in nested dict: _client_heartbeats[round][client_id] = {...}
        with _heartbeat_lock:
            if round_num not in _client_heartbeats:
                _client_heartbeats[round_num] = {}
            _client_heartbeats[round_num][client_id] = {
                "status": status,
                "progress": min(1.0, max(0.0, progress)),
                "timestamp": timestamp
            }
        
        logger.debug(f"Heartbeat from {client_id} (round {round_num}): {progress*100:.1f}%")
        return jsonify({"status": "received"}), 200
    except Exception as e:
        logger.error(f"Heartbeat processing error: {e}")
        return jsonify({"error": str(e)}), 400


@app.route("/api/round/clients-status", methods=["GET"])
def get_clients_status():
    """
    Dashboard / admin endpoint – get live training status of all clients.
    Returns which clients are training, completed, or offline.
    
    Response JSON:
      {
        "current_round": 1,
        "clients": {
          "client_1": {
            "status": "training",  // or "completed" or "offline"
            "progress": 0.45,
            "last_seen": 1701234567.89
          },
          ...
        }
      }
    """
    try:
        current_round = round_manager.current_round()
        now = time.time()
        
        with _heartbeat_lock:
            heartbeats = _client_heartbeats.get(current_round, {})
        
        clients = {}
        for client_id, hb in heartbeats.items():
            seconds_since_seen = now - hb["timestamp"]
            # Mark as offline if no heartbeat in 120 seconds
            if seconds_since_seen > 120:
                status = "offline"
            else:
                status = hb["status"]
            
            clients[client_id] = {
                "status": status,
                "progress": hb["progress"],
                "last_seen": hb["timestamp"],
                "seconds_ago": round(seconds_since_seen, 1)
            }
        
        return jsonify({
            "current_round": current_round,
            "timestamp": now,
            "clients": clients
        }), 200
    except Exception as e:
        logger.error(f"Status retrieval error: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.getenv("FL_SERVER_PORT", 6000))
    logger.info(f"FL Server starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)
