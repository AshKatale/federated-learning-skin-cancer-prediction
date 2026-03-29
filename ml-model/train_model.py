"""
Training script for Skin Cancer Classification Model
Loads HAM10000 dataset and trains the EfficientNet model
"""

import os
import sys
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from torchvision import transforms
import timm
from sklearn.model_selection import train_test_split
from sklearn.utils.class_weight import compute_class_weight
from PIL import Image
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix

from skin_cancer_model import SkinCancerModel, SkinCancerDataset

# Force unbuffered output for real-time logging
sys.stdout.flush()
sys.stderr.flush()


class ModelTrainer:
    """Handles model training and evaluation"""
    
    def __init__(self, model, device=None, output_dir='./models'):
        self.model = model
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def prepare_data(self, dataset_path, metadata_path, test_size=0.2):
        """Prepare data for training"""
        
        # Read metadata
        df = pd.read_csv(metadata_path)
        
        # Create image path mapping - support all 3 parts for federated learning
        image_dict = {}
        image_paths = [
            os.path.join(dataset_path, "HAM10000_images_part_1"),
            os.path.join(dataset_path, "HAM10000_images_part_2"),
            os.path.join(dataset_path, "HAM10000_images_part_3")
        ]
        
        for folder in image_paths:
            if os.path.exists(folder):
                print(f"[LOAD] Loading images from {folder}...")
                sys.stdout.flush()
                for img in os.listdir(folder):
                    image_dict[img.split(".")[0]] = os.path.join(folder, img)
        
        df["path"] = df["image_id"].map(image_dict.get)
        
        # Map labels
        label_mapping = SkinCancerModel.LABEL_MAPPING
        df["label"] = df["dx"].map(label_mapping)
        
        # Split data
        train_df, val_df = train_test_split(
            df,
            test_size=test_size,
            stratify=df["label"],
            random_state=42
        )
        
        return train_df, val_df
    
    def train(self, train_df, val_df, epochs=15, batch_size=32, learning_rate=3e-4):
        """Train the model"""
        
        # Data loaders
        train_transform = self.model.get_transforms(mode='train')
        val_transform = self.model.get_transforms(mode='val')
        
        train_dataset = SkinCancerDataset(train_df, train_transform)
        val_dataset = SkinCancerDataset(val_df, val_transform)
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=2)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=2)
        
        # Loss and optimizer
        class_weights = compute_class_weight(
            class_weight='balanced',
            classes=np.unique(train_df["label"]),
            y=train_df["label"]
        )
        class_weights = torch.tensor(class_weights, dtype=torch.float).to(self.device)
        
        criterion = nn.CrossEntropyLoss(weight=class_weights)
        optimizer = torch.optim.AdamW(
            self.model.model.parameters(),
            lr=learning_rate,
            weight_decay=1e-4
        )
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, mode='min', factor=0.3, patience=2, min_lr=1e-6
        )
        
        # Training loop
        best_val_loss = float("inf")
        patience = 5
        counter = 0
        
        train_losses = []
        val_losses = []
        
        for epoch in range(epochs):
            print(f"\n[EPOCH] Epoch {epoch+1}/{epochs}")
            sys.stdout.flush()
            
            # Training
            self.model.model.train()
            train_loss = 0
            
            for batch_idx, (images, labels) in enumerate(train_loader):
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                optimizer.zero_grad()
                outputs = self.model.model(images)
                loss = criterion(outputs, labels)
                
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
                
                # Log progress every 10 batches
                if (batch_idx + 1) % 10 == 0:
                    print(f"[BATCH] {batch_idx+1}/{len(train_loader)}, Loss: {loss.item():.4f}")
                    sys.stdout.flush()
            
            train_loss = train_loss / len(train_loader)
            train_losses.append(train_loss)
            
            # Validation
            self.model.model.eval()
            val_loss = 0
            
            with torch.no_grad():
                for images, labels in val_loader:
                    images = images.to(self.device)
                    labels = labels.to(self.device)
                    
                    outputs = self.model.model(images)
                    loss = criterion(outputs, labels)
                    val_loss += loss.item()
            
            val_loss = val_loss / len(val_loader)
            val_losses.append(val_loss)
            
            print(f"[RESULT] Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}")
            sys.stdout.flush()
            
            scheduler.step(val_loss)
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                counter = 0
                model_path = os.path.join(self.output_dir, "best_skin_cancer_model.pth")
                self.model.save_model(model_path)
                print("[OK] Model improved and saved")
                sys.stdout.flush()
            else:
                counter += 1
                if counter >= patience:
                    print("Early stopping triggered")
                    break
        
        # Plot training history
        plt.figure(figsize=(10, 5))
        plt.plot(train_losses, label="Train Loss", marker='o')
        plt.plot(val_losses, label="Validation Loss", marker='o')
        plt.xlabel("Epoch")
        plt.ylabel("Loss")
        plt.title("Training vs Validation Loss")
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig(os.path.join(self.output_dir, "training_history.png"))
        print(f"[SAVE] Training history saved to {self.output_dir}/training_history.png")
        sys.stdout.flush()
        
        return train_losses, val_losses
    
    def evaluate(self, val_df, val_loader):
        """Evaluate model on validation set"""
        
        all_preds = []
        all_labels = []
        
        self.model.model.eval()
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                outputs = self.model.model(images)
                _, predicted = torch.max(outputs, 1)
                
                correct += (predicted == labels).sum().item()
                total += labels.size(0)
                
                all_preds.extend(predicted.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        accuracy = correct / total
        print(f"\n[EVAL] Validation Accuracy: {accuracy:.4f}")
        sys.stdout.flush()
        print("\nClassification Report:")
        print(classification_report(all_labels, all_preds, 
                                   target_names=SkinCancerModel.CLASS_NAMES))
        
        # Confusion matrix
        cm = confusion_matrix(all_labels, all_preds)
        plt.figure(figsize=(10, 8))
        sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                   xticklabels=SkinCancerModel.CLASS_NAMES,
                   yticklabels=SkinCancerModel.CLASS_NAMES)
        plt.title("Confusion Matrix")
        plt.ylabel("Actual")
        plt.xlabel("Predicted")
        plt.tight_layout()
        plt.savefig(os.path.join(self.output_dir, "confusion_matrix.png"))
        print(f"Confusion matrix saved to {self.output_dir}/confusion_matrix.png")
        
        return accuracy


if __name__ == "__main__":
    # Configuration
    DATASET_PATH = "D:\\Skin Cancer Dataset"  # Root dataset path with all 3 parts
    METADATA_PATH = os.path.join(DATASET_PATH, "HAM10000_metadata.csv")
    MODEL_OUTPUT_DIR = "./models"
    
    # Initialize model and trainer
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[INIT] Using device: {device}")
    sys.stdout.flush()
    
    model = SkinCancerModel(device=device)
    trainer = ModelTrainer(model, device=device, output_dir=MODEL_OUTPUT_DIR)
    
    # Prepare data
    print("[LOAD] Preparing data...")
    sys.stdout.flush()
    train_df, val_df = trainer.prepare_data(DATASET_PATH, METADATA_PATH)
    print(f"[LOAD] Training samples: {len(train_df)}, Validation samples: {len(val_df)}")
    sys.stdout.flush()
    
    # Train model
    print("[TRAIN] Starting training...")
    sys.stdout.flush()
    train_losses, val_losses = trainer.train(train_df, val_df, epochs=15, batch_size=32)
    
    # Evaluate
    print("[EVAL] Evaluating model...")
    sys.stdout.flush()
    val_transform = model.get_transforms(mode='val')
    val_dataset = SkinCancerDataset(val_df, val_transform)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False, num_workers=2)
    
    accuracy = trainer.evaluate(val_df, val_loader)
    
    print(f"\n[DONE] Training complete! Model saved to {MODEL_OUTPUT_DIR}")
    sys.stdout.flush()
