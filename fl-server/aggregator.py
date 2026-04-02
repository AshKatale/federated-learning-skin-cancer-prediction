"""
Federated Learning Aggregators
Implements FedAvg and FedProx for distributed model training.
FedAvg: Weighted averaging of client state_dicts (assumes IID data)
FedProx: Adds proximal term to handle non-IID data better
"""

import torch
import logging

logger = logging.getLogger(__name__)


class FedAvgAggregator:
    def fedavg(self, updates: list[dict]) -> dict:
        """
        FedAvg: Weighted averaging of client updates.
        
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
    
    def fedprox(self, updates: list[dict], global_state: dict = None, mu: float = 0.01) -> dict:
        """
        FedProx: Weighted averaging with proximal term to handle non-IID data.
        Better for heterogeneous data distributions across clients.
        
        Args:
            updates: list of dicts with keys:
                "state_dict"  – client model weights (CPU tensors)
                "num_samples" – number of training samples used
            global_state: Previous global model (for proximal regularization)
            mu: Proximal term coefficient (higher = more stable, lower = faster convergence)

        Returns:
            Aggregated state_dict (CPU tensors)
        """
        if not updates:
            raise ValueError("No updates to aggregate")

        total_samples = sum(u["num_samples"] for u in updates)
        logger.info(
            f"FedProx: {len(updates)} clients, {total_samples} total samples, mu={mu}"
        )

        # If no global state provided, fall back to FedAvg
        if global_state is None:
            logger.warning("No global state provided for FedProx, using FedAvg")
            return self.fedavg(updates)

        agg = {}
        for update in updates:
            weight = update["num_samples"] / total_samples
            for key, tensor in update["state_dict"].items():
                t = tensor.float()
                
                # Proximal term: penalize distance from global model
                if key in global_state:
                    global_t = global_state[key].float()
                    # weight * (update + mu * (update - global))
                    # This encourages updates to stay close to global model
                    t = t + mu * (t - global_t)
                
                if key not in agg:
                    agg[key] = weight * t
                else:
                    agg[key] += weight * t

        return agg
