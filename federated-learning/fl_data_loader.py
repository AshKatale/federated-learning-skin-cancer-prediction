"""
Federated Learning Data Loader
Handles loading and preprocessing data for FL clients
Isolated data handling logic
"""

import os
import pandas as pd
import torch
from PIL import Image
import logging
import sys

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(name)s] %(message)s'
)
logger = logging.getLogger(__name__)


class FLDataLoader:
    """
    Load and preprocess data for Federated Learning clients
    Handles HAM10000 dataset with multi-part structure
    """
    
    @staticmethod
    def load_client_data(
        client_id,
        dataset_path,
        metadata_path,
        transform_fn=None,
        samples_per_client=100
    ):
        """
        Load dataset for a specific client
        Distributes samples across clients (simulating federated setup)
        
        Args:
            client_id: Client identifier (1-based)
            dataset_path: Path to dataset root
            metadata_path: Path to metadata CSV
            transform_fn: Function to apply transforms (gets 'train' or 'val' mode)
            samples_per_client: Number of samples per client
            
        Returns:
            X_train, y_train, X_val, y_val as tensors
        """
        from skin_cancer_model import SkinCancerModel
        
        logger.info(f"[CLIENT {client_id}] Loading dataset from {dataset_path}")
        
        # Read metadata
        df = pd.read_csv(metadata_path)
        
        # Build image dictionary from the provided folder
        image_dict = {}

        # Check if the folder itself contains images directly
        direct_images = [f for f in os.listdir(dataset_path)
                         if f.lower().endswith(('.jpg', '.jpeg', '.png'))]

        if direct_images:
            # User provided the images folder directly — scan it
            scan_paths = [dataset_path]
        else:
            # Folder has no images; try HAM10000_images_part_* subfolders
            scan_paths = [
                os.path.join(dataset_path, "HAM10000_images_part_1"),
                os.path.join(dataset_path, "HAM10000_images_part_2"),
                os.path.join(dataset_path, "HAM10000_images_part_3"),
            ]

        for folder in scan_paths:
            if os.path.exists(folder):
                for img_file in os.listdir(folder):
                    if img_file.lower().endswith(('.jpg', '.jpeg', '.png')):
                        image_id = os.path.splitext(img_file)[0]
                        image_dict[image_id] = os.path.join(folder, img_file)
        
        logger.info(f"[CLIENT {client_id}] Found {len(image_dict)} images in dataset")
        
        # Map labels and image paths
        label_mapping = SkinCancerModel.LABEL_MAPPING
        df['label'] = df['dx'].map(label_mapping)
        df['path'] = df['image_id'].map(image_dict)
        
        # Filter out missing images
        df = df[df['path'].notna() & df['label'].notna()]
        
        logger.info(f"[CLIENT {client_id}] After filtering: {len(df)} valid images")
        
        # Use all available images (single desktop client — no round-robin split needed)
        client_df = df.copy()
        
        # Limit to samples_per_client if set (999999 = effectively all)
        client_idx = int(client_id) - 1
        if len(client_df) > samples_per_client:
            client_df = client_df.sample(n=samples_per_client, random_state=client_idx)
        
        logger.info(f"[CLIENT {client_id}] Allocated {len(client_df)} samples for training")
        
        # Load images and preprocess
        images_list = []
        labels_list = []
        
        # Get transforms from model
        train_transform = transform_fn(mode='train') if transform_fn else None
        
        for idx, row in client_df.iterrows():
            try:
                img = Image.open(row['path']).convert('RGB')
                
                # Apply transforms if provided
                if train_transform:
                    img_tensor = train_transform(img)
                else:
                    # Default: just convert to tensor
                    img_tensor = torch.tensor(img, dtype=torch.float32).permute(2, 0, 1) / 255.0
                
                images_list.append(img_tensor)
                labels_list.append(int(row['label']))
            except Exception as e:
                logger.warning(f"[CLIENT {client_id}] Failed to load image {row['path']}: {e}")
                continue
        
        logger.info(f"[CLIENT {client_id}] Successfully loaded {len(images_list)} images")
        
        # Convert to tensors
        X_data = torch.stack(images_list) if images_list else torch.empty((0, 3, 224, 224))
        y_data = torch.tensor(labels_list) if labels_list else torch.empty((0,), dtype=torch.long)
        
        # Split into train/val (80/20)
        num_train = int(0.8 * len(X_data))
        indices = torch.randperm(len(X_data))
        
        train_indices = indices[:num_train]
        val_indices = indices[num_train:]
        
        X_train = X_data[train_indices]
        y_train = y_data[train_indices]
        X_val = X_data[val_indices]
        y_val = y_data[val_indices]
        
        logger.info(f"[CLIENT {client_id}] Train set: {len(X_train)}, Val set: {len(X_val)}")
        
        return X_train, y_train, X_val, y_val
