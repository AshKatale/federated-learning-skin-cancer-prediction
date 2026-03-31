"""
FedAvg Aggregator
Performs weighted averaging of client state_dicts.
num_samples-based weighting ensures larger datasets contribute more.
"""

import torch
import logging

logger = logging.getLogger(__name__)


class FedAvgAggregator:
    def fedavg(self, updates: list[dict]) -> dict:
        """
        Args:
            updates: list of dicts with keys:
                "state_dict"  – client model weights (CPU tensors)
                "num_samples" – number of training samples used

        Returns:
            Aggregated state_dict (CPU tensors)
        """
        if not updates:
            raise ValueError("No updates to aggregate")

        total_samples = sum(u["num_samples"] for u in updates)
        logger.info(
            f"FedAvg: {len(updates)} clients, {total_samples} total samples"
        )

        agg = {}
        for update in updates:
            weight = update["num_samples"] / total_samples
            for key, tensor in update["state_dict"].items():
                t = tensor.float()
                if key not in agg:
                    agg[key] = weight * t
                else:
                    agg[key] += weight * t

        return agg
