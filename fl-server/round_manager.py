"""
Round Manager
Tracks FL round state, client update persistence, and model versioning.
State is stored in a JSON file so it survives server restarts.
"""

import io
import json
import time
import shutil
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

import torch

logger = logging.getLogger(__name__)

STATE_FILE = "round_state.json"


class RoundManager:
    def __init__(self, models_dir: Path, updates_dir: Path, round_duration: int):
        self.models_dir = Path(models_dir)
        self.updates_dir = Path(updates_dir)
        self.round_duration = round_duration  # seconds

        self.models_dir.mkdir(parents=True, exist_ok=True)
        self.updates_dir.mkdir(parents=True, exist_ok=True)

        self._state = self._load_state()

    # ── Persistence ───────────────────────────────────────────────────────────

    def _state_path(self) -> Path:
        return self.models_dir / STATE_FILE

    def _load_state(self) -> dict:
        p = self._state_path()
        if p.exists():
            with open(p) as f:
                return json.load(f)
        # Bootstrap: round 1 starts now
        state = {
            "current_round": 1,
            "round_start": time.time(),
            "last_model_path": None,
        }
        self._write_state(state)
        return state

    def _write_state(self, state: dict):
        with open(self._state_path(), "w") as f:
            json.dump(state, f, indent=2)

    # ── Round lifecycle ───────────────────────────────────────────────────────

    def current_round(self) -> int:
        return self._state["current_round"]

    def current_round_deadline(self) -> float:
        return self._state["round_start"] + self.round_duration

    def advance_round(self, model_path: Optional[str]):
        """Called after aggregation; bumps to next round."""
        self._state["current_round"] += 1
        self._state["round_start"] = time.time()
        if model_path:
            self._state["last_model_path"] = str(model_path)
        self._write_state(self._state)

    # ── Model versioning ──────────────────────────────────────────────────────

    def save_global_model(self, state_dict: dict) -> Path:
        """Saves aggregated weights as global_model_round_N.pt"""
        rnd = self._state["current_round"]
        path = self.models_dir / f"global_model_round_{rnd}.pt"
        torch.save(state_dict, path)
        logger.info(f"Global model saved: {path}")
        return path

    def latest_model_path(self) -> Optional[str]:
        """Returns path of most recently saved global model, or None."""
        if self._state.get("last_model_path"):
            p = Path(self._state["last_model_path"])
            if p.exists():
                return str(p)
        # Fallback: scan directory
        files = sorted(self.models_dir.glob("global_model_round_*.pt"))
        return str(files[-1]) if files else None

    # ── Client updates ────────────────────────────────────────────────────────

    def save_client_update(
        self, client_id: str, round_num: int, state_dict: dict, num_samples: int
    ):
        """Persist a client's state_dict for the aggregation step."""
        update_dir = self.updates_dir / f"round_{round_num}"
        update_dir.mkdir(parents=True, exist_ok=True)

        # state_dict file
        weights_path = update_dir / f"{client_id}_weights.pt"
        torch.save(state_dict, weights_path)

        # metadata sidecar
        meta_path = update_dir / f"{client_id}_meta.json"
        with open(meta_path, "w") as f:
            json.dump(
                {
                    "client_id": client_id,
                    "round": round_num,
                    "num_samples": num_samples,
                    "received_at": datetime.now(tz=timezone.utc).isoformat(),
                },
                f,
            )

    def collect_pending_updates(self) -> list[dict]:
        """
        Gather all client updates for the current round.
        Returns list of {"state_dict": ..., "num_samples": ...}
        """
        rnd = self._state["current_round"]
        update_dir = self.updates_dir / f"round_{rnd}"
        if not update_dir.exists():
            return []

        updates = []
        for meta_file in update_dir.glob("*_meta.json"):
            with open(meta_file) as f:
                meta = json.load(f)

            weights_file = meta_file.with_name(
                meta_file.name.replace("_meta.json", "_weights.pt")
            )
            if not weights_file.exists():
                logger.warning(f"Missing weights for {meta['client_id']} – skipping")
                continue

            state_dict = torch.load(weights_file, map_location="cpu")
            updates.append(
                {"state_dict": state_dict, "num_samples": meta["num_samples"]}
            )

        # Archive processed updates
        if updates:
            archive = self.updates_dir / f"round_{rnd}_done"
            shutil.move(str(update_dir), str(archive))

        return updates

    def status(self) -> dict:
        rnd = self._state["current_round"]
        update_dir = self.updates_dir / f"round_{rnd}"
        received = len(list(update_dir.glob("*_meta.json"))) if update_dir.exists() else 0
        deadline = self.current_round_deadline()
        return {
            "current_round": rnd,
            "round_deadline": datetime.fromtimestamp(
                deadline, tz=timezone.utc
            ).isoformat(),
            "seconds_remaining": max(0, deadline - time.time()),
            "updates_received": received,
            "last_model": self._state.get("last_model_path"),
        }
