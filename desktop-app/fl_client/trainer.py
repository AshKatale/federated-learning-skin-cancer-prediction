"""
Local Trainer
Trains EfficientNet-B0 on private client data.
Data never leaves the device – only state_dict weights are uploaded.
"""

import os
import logging
import time
import json
from pathlib import Path

import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image

from model import SkinCancerModel, TRAIN_TRANSFORM

try:
    import requests
except ImportError:
    requests = None  # Gracefully handle missing requests library

logger = logging.getLogger(__name__)

LABEL_MAP = {"akiec": 0, "bcc": 1, "bkl": 2, "df": 3, "mel": 4, "nv": 5, "vasc": 6}


def compute_class_weights_manual(labels: np.ndarray, num_classes: int = 7) -> np.ndarray:
    """
    Compute balanced class weights without sklearn.
    Weight = n_samples / (n_classes * n_samples_per_class)
    Rarer classes get higher weights.
    """
    weights = np.zeros(num_classes)
    class_counts = np.bincount(labels, minlength=num_classes)
    total_samples = len(labels)
    
    for class_id in range(num_classes):
        if class_counts[class_id] > 0:
            # Balanced weight formula
            weights[class_id] = total_samples / (num_classes * class_counts[class_id])
        else:
            # Class not present in this batch
            weights[class_id] = 1.0
    
    return weights


class _SkinDataset(Dataset):
    def __init__(self, df: pd.DataFrame, transform):
        self.df = df.reset_index(drop=True)
        self.transform = transform

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        row = self.df.iloc[idx]
        img = Image.open(row["path"]).convert("RGB")
        return self.transform(img), int(row["label"])


def _find_image(image_id: str, data_dir: str) -> str | None:
    for ext in [".jpg", ".jpeg", ".png"]:
        for sub in ["", "HAM10000_images_part_1", "HAM10000_images_part_2"]:
            p = Path(data_dir) / sub / f"{image_id}{ext}"
            if p.exists():
                return str(p)
    return None


class LocalTrainer:
    def __init__(self, model: SkinCancerModel, data_dir: str, metadata_path: str, 
                 server_url: str = None, client_id: str = None):
        self.model = model
        self.data_dir = data_dir
        self.metadata_path = metadata_path
        self.df = None
        self.class_weights = None  # Will be computed in prepare_data
        self.server_url = server_url  # For heartbeat updates
        self.client_id = client_id    # For heartbeat tracking
        self.last_heartbeat = 0       # Timestamp of last heartbeat

        self.device = model.device
        self.criterion = None  # Will be set after computing class weights
    
    def send_heartbeat(self, round_num: int, progress: float, status: str = "training"):
        """
        Send training progress heartbeat to server.
        progress: 0.0 to 1.0 (fraction of training complete)
        """
        if not self.server_url or not self.client_id or not requests:
            return
        
        # Rate limit: only send every 10 seconds
        now = time.time()
        if now - self.last_heartbeat < 10:
            return
        
        try:
            heartbeat = {
                "client_id": self.client_id,
                "round": round_num,
                "status": status,
                "progress": min(1.0, max(0.0, progress)),
                "timestamp": now
            }
            requests.post(
                f"{self.server_url}/api/client/heartbeat",
                json=heartbeat,
                timeout=2
            )
            self.last_heartbeat = now
        except Exception as e:
            logger.debug(f"Failed to send heartbeat: {e}")

    def prepare_data(self, samples_per_class: int = 50) -> int:
        """Load metadata and resolve image paths. Returns number of usable samples."""
        if not os.path.exists(self.metadata_path):
            logger.error("Metadata not found: %s", self.metadata_path)
            return 0

        meta = pd.read_csv(self.metadata_path)
        meta["label"] = meta["dx"].map(LABEL_MAP)
        meta = meta.dropna(subset=["label"])

        # Sample to keep training fast on client
        meta = meta.groupby("dx").head(samples_per_class)
        meta["path"] = meta["image_id"].apply(
            lambda x: _find_image(x, self.data_dir)
        )
        self.df = meta.dropna(subset=["path"])
        
        # Compute class weights for balanced training (manual, no sklearn dependency)
        class_weights_np = compute_class_weights_manual(
            self.df["label"].values.astype(int),
            num_classes=7
        )
        self.class_weights = torch.tensor(class_weights_np, dtype=torch.float32).to(self.device)
        self.criterion = nn.CrossEntropyLoss(weight=self.class_weights)
        
        logger.info("Prepared %d training samples", len(self.df))
        logger.info("Class weights: %s", self.class_weights.cpu().numpy())
        return len(self.df)

    def train(self, epochs: int = 1, batch_size: int = 16, lr: float = 0.001, round_num: int = 1):
        if self.df is None or len(self.df) == 0:
            raise RuntimeError("Call prepare_data() first")

        dataset = _SkinDataset(self.df, TRAIN_TRANSFORM)
        loader = DataLoader(
            dataset,
            batch_size=min(batch_size, len(dataset)),
            shuffle=True,
            num_workers=0,  # keep 0 for Electron/Windows compatibility
        )

        net = self.model.net
        net.train()
        
        # Use AdamW for better regularization
        optimizer = optim.AdamW(net.parameters(), lr=lr, weight_decay=1e-4)
        
        # More aggressive scheduler: restart with lower factor
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, 
            mode='min', 
            factor=0.7,  # Reduce LR by 30% instead of default 50%
            patience=1,  # Patience of 1 instead of 2
            min_lr=1e-6,
            verbose=True
        )

        final_loss = 0.0
        final_acc = 0.0
        total_samples = 0
        total_batches = epochs * len(loader)
        batch_count = 0

        for epoch in range(epochs):
            total_loss, correct, total = 0.0, 0, 0
            for x, y in loader:
                x, y = x.to(self.device), y.to(self.device)
                optimizer.zero_grad()
                out = net(x)
                loss = self.criterion(out, y)
                loss.backward()
                optimizer.step()

                total_loss += loss.item()
                correct += out.argmax(1).eq(y).sum().item()
                total += y.size(0)
                batch_count += 1
                
                # Send progress heartbeat to server
                progress = batch_count / total_batches
                self.send_heartbeat(round_num, progress, "training")

            avg_loss = total_loss / len(loader)
            acc = 100.0 * correct / total if total else 0
            scheduler.step(avg_loss)
            logger.info(
                "[EPOCH %d/%d] loss=%.4f acc=%.2f%% lr=%.6f", 
                epoch + 1, epochs, avg_loss, acc, 
                optimizer.param_groups[0]['lr']
            )
            final_loss = avg_loss
            final_acc = acc
            total_samples = total

        return final_loss, final_acc, total_samples
