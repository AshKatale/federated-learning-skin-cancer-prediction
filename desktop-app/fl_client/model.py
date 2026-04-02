"""
Skin Cancer EfficientNet-B0 model wrapper.
Shared between fl-server and desktop-app local inference.
Only transfers state_dict – never full .pth files between services.
"""

import os
import io
import torch
import torch.nn as nn
from torchvision import transforms
from PIL import Image
import timm


CLASS_NAMES = [
    "Actinic Keratosis",
    "Basal Cell Carcinoma",
    "Benign Keratosis",
    "Dermatofibroma",
    "Melanoma",
    "Nevus",
    "Vascular",
]
SHORT_LABELS = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
RISK = {"mel": "High", "bcc": "High", "akiec": "Medium"}

_NORMALIZE = transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])

TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(),
    transforms.RandomVerticalFlip(),
    transforms.RandomRotation(20),
    transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
    transforms.ToTensor(),
    _NORMALIZE,
])

INFER_TRANSFORM = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    _NORMALIZE,
])


def _build_efficientnet() -> nn.Module:
    return timm.create_model("efficientnet_b0", pretrained=True, num_classes=7)


class SkinCancerModel:
    def __init__(self, device: str | None = None):
        self.device = torch.device(
            device or ("cuda" if torch.cuda.is_available() else "cpu")
        )
        self.net = _build_efficientnet().to(self.device)

    def get_state_dict(self) -> dict:
        return {k: v.cpu() for k, v in self.net.state_dict().items()}

    def set_state_dict(self, state_dict: dict):
        self.net.load_state_dict(state_dict)
        self.net.to(self.device)

    def load_weights(self, path: str):
        sd = torch.load(path, map_location="cpu")
        self.net.load_state_dict(sd)
        self.net.to(self.device)

    def save_weights(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save(self.get_state_dict(), path)

    def _state_dict_to_b64(self, state_dict: dict) -> str:
        """Convert a state_dict to base64-encoded string for transmission."""
        import base64
        buf = io.BytesIO()
        torch.save(state_dict, buf)
        buf.seek(0)
        return base64.b64encode(buf.read()).decode("utf-8")

    def predict(self, image: Image.Image) -> dict:
        self.net.eval()
        x = INFER_TRANSFORM(image).unsqueeze(0).to(self.device)
        with torch.no_grad():
            logits = self.net(x)
            probs = torch.softmax(logits, dim=1)[0]
        cls_idx = probs.argmax().item()
        return {
            "class_id": cls_idx,
            "class_name": CLASS_NAMES[cls_idx],
            "short_label": SHORT_LABELS[cls_idx],
            "confidence": round(float(probs[cls_idx]), 4),
            "risk_level": RISK.get(SHORT_LABELS[cls_idx], "Low"),
            "all_probabilities": {
                CLASS_NAMES[i]: round(float(probs[i]), 4) for i in range(7)
            },
        }
