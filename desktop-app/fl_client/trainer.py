"""
Local Trainer
Trains EfficientNet-B0 on private client data.
Data never leaves the device – only state_dict weights are uploaded.
"""

import os
import logging
from pathlib import Path

import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
from PIL import Image

from model import SkinCancerModel, TRAIN_TRANSFORM

logger = logging.getLogger(__name__)

LABEL_MAP = {"akiec": 0, "bcc": 1, "bkl": 2, "df": 3, "mel": 4, "nv": 5, "vasc": 6}


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
    def __init__(self, model: SkinCancerModel, data_dir: str, metadata_path: str):
        self.model = model
        self.data_dir = data_dir
        self.metadata_path = metadata_path
        self.df = None

        self.device = model.device
        self.criterion = nn.CrossEntropyLoss()

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
        logger.info("Prepared %d training samples", len(self.df))
        return len(self.df)

    def train(self, epochs: int = 1, batch_size: int = 16, lr: float = 0.001):
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
        optimizer = optim.Adam(net.parameters(), lr=lr)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=2)

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

            avg_loss = total_loss / len(loader)
            acc = 100.0 * correct / total if total else 0
            scheduler.step(avg_loss)
            logger.info(
                "[EPOCH %d/%d] loss=%.4f acc=%.2f%%", epoch + 1, epochs, avg_loss, acc
            )
