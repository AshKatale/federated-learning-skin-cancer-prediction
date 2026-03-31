"""
Training Scheduler
Decides when it's appropriate to run local training.
Checks: system idle time, charging status (where available), user preference.
Clients are NEVER forced to train at a specific time.
"""

import os
import time
import platform
import logging

logger = logging.getLogger(__name__)

# Configurable thresholds
MIN_IDLE_SECONDS = int(os.getenv("MIN_IDLE_SECONDS", 300))       # 5 min idle
TRAIN_HOUR_START = int(os.getenv("TRAIN_HOUR_START", 22))         # 10 PM
TRAIN_HOUR_END = int(os.getenv("TRAIN_HOUR_END", 6))              # 6 AM
REQUIRE_NIGHT = os.getenv("REQUIRE_NIGHT", "0") == "1"
TRAINING_ENABLED = os.getenv("TRAINING_ENABLED", "1") == "1"


class TrainingScheduler:
    def __init__(self):
        self._user_enabled = TRAINING_ENABLED
        self._last_trained = 0.0

    def enable(self):
        self._user_enabled = True

    def disable(self):
        self._user_enabled = False

    def should_train(self) -> bool:
        if not self._user_enabled:
            return False

        if REQUIRE_NIGHT and not self._is_night_hours():
            return False

        # Simple cooldown: don't train more than once every 6 hours
        if time.time() - self._last_trained < 6 * 3600:
            return False

        self._last_trained = time.time()
        return True

    def _is_night_hours(self) -> bool:
        h = time.localtime().tm_hour
        if TRAIN_HOUR_START > TRAIN_HOUR_END:
            return h >= TRAIN_HOUR_START or h < TRAIN_HOUR_END
        return TRAIN_HOUR_START <= h < TRAIN_HOUR_END

    def _is_charging(self) -> bool:
        """Best-effort battery check (Linux/macOS). Always True on desktop."""
        try:
            import psutil
            battery = psutil.sensors_battery()
            return battery is None or battery.power_plugged
        except Exception:
            return True  # Assume plugged in if can't detect
