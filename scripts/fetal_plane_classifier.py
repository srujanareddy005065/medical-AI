import os
import pandas as pd
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import ViTImageProcessor, ViTForImageClassification, TrainingArguments, Trainer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
import warnings
import platform
warnings.filterwarnings('ignore')

def get_device():
    if torch.backends.mps.is_available() and torch.backends.mps.is_built():
        print("🚀 Using Apple Silicon MPS (Metal Performance Shaders)")
        return torch.device("mps")
    elif torch.cuda.is_available():
        print("🚀 Using CUDA GPU")
        return torch.device("cuda")
    else:
        print("💻 Using CPU")
        return torch.device("cpu")

def optimize_for_apple_silicon():
    if platform.machine() == 'arm64':
        os.environ['PYTORCH_ENABLE_MPS_FALLBACK'] = '1'
        if torch.backends.mps.is_available():
            try:
                if hasattr(torch.backends.mps, 'empty_cache'):
                    torch.backends.mps.empty_cache()
            except AttributeError:
                pass
        print("✅ Apple Silicon optimizations enabled")

class FetalPlaneDataset(Dataset):
    def __init__(self, image_paths, labels, processor, transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.processor = processor
        self.transform = transform
    
    def __len__(self):
        return len(self.image_paths)
    
    def __getitem__(self, idx):
        try:
            image_path = self.image_paths[idx]
            image = Image.open(image_path).convert('RGB')
            
            if self.transform:
                image = self.transform(image)
            
            inputs = self.processor(images=image, return_tensors="pt")
            pixel_values = inputs['pixel_values'].squeeze()
            
            return {
                'pixel_values': pixel_values,
                'labels': torch.tensor(self.labels[idx], dtype=torch.long)
            }
        except Exception as e:
            print(f"Error loading image {image_path}: {e}")
            return self.__getitem__((idx + 1) % len(self.image_paths))

def load_and_preprocess_data(data_dir):
    csv_path = os.path.join(data_dir, 'FETAL_PLANES_DB_data.csv')
    images_dir = os.path.join(data_dir, 'Images')
    
    df = pd.read_csv(csv_path, delimiter=';')
    
    df['image_path'] = df['Image_name'].apply(lambda x: os.path.join(images_dir, f"{x}.png"))
    
    existing_images = df[df['image_path'].apply(os.path.exists)]
    print(f"Found {len(existing_images)} existing images out of {len(df)} total entries")
    
    existing_images['combined_label'] = existing_images['Plane'] + '_' + existing_images['Brain_plane']
    
    label_encoder = LabelEncoder()
    existing_images['encoded_label'] = label_encoder.fit_transform(existing_images['combined_label'])
    
    print("\nLabel distribution:")
    print(existing_images['combined_label'].value_counts())
    
    return existing_images, label_encoder

def compute_metrics(eval_pred):
    predictions, labels = eval_pred
    predictions = np.argmax(predictions, axis=1)
    return {'accuracy': accuracy_score(labels, predictions)}

def train_fetal_plane_classifier(data_dir, output_dir='./fetal_plane_model', epochs=10, batch_size=16):
    print("🔬 Initializing Fetal Plane Classifier Training")
    print("=" * 50)
    
    optimize_for_apple_silicon()
    device = get_device()
    
    if device.type == 'mps':
        batch_size = min(batch_size, 8)
        print(f"📱 Optimized batch size for Apple Silicon: {batch_size}")
    
    print("Loading and preprocessing data...")
    df, label_encoder = load_and_preprocess_data(data_dir)
    
    model_name = "google/vit-base-patch16-224-in21k"
    processor = ViTImageProcessor.from_pretrained(model_name)
    
    num_labels = len(label_encoder.classes_)
    model = ViTForImageClassification.from_pretrained(
        model_name,
        num_labels=num_labels,
        ignore_mismatched_sizes=True
    )
    
    model = model.to(device)
    print(f"📱 Model moved to device: {device}")
    
    train_df, val_df = train_test_split(
        df, 
        test_size=0.2, 
        random_state=42, 
        stratify=df['encoded_label']
    )
    
    print(f"Training samples: {len(train_df)}")
    print(f"Validation samples: {len(val_df)}")
    
    train_dataset = FetalPlaneDataset(
        train_df['image_path'].tolist(),
        train_df['encoded_label'].tolist(),
        processor
    )
    
    val_dataset = FetalPlaneDataset(
        val_df['image_path'].tolist(),
        val_df['encoded_label'].tolist(),
        processor
    )
    
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=epochs,
        per_device_train_batch_size=batch_size,
        per_device_eval_batch_size=batch_size,
        warmup_steps=min(500, len(train_df) // (batch_size * 4)),
        weight_decay=0.01,
        logging_dir=f'{output_dir}/logs',
        logging_steps=50,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="accuracy",
        greater_is_better=True,
        save_total_limit=2,
        remove_unused_columns=False,
        dataloader_pin_memory=False,
        dataloader_num_workers=0 if device.type == 'mps' else 2,
        fp16=False,
        bf16=False,
        use_mps_device=device.type == 'mps',
        gradient_accumulation_steps=2 if device.type == 'mps' else 1,
        max_grad_norm=1.0,
        lr_scheduler_type="cosine",
        learning_rate=5e-5 if device.type == 'mps' else 2e-5,
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=val_dataset,
        compute_metrics=compute_metrics,
    )
    
    print("Starting training...")
    trainer.train()
    
    print("Evaluating model...")
    eval_results = trainer.evaluate()
    print(f"Validation Accuracy: {eval_results['eval_accuracy']:.4f}")
    
    print("Saving model and processor...")
    model.save_pretrained(output_dir)
    processor.save_pretrained(output_dir)
    
    import joblib
    joblib.dump(label_encoder, os.path.join(output_dir, 'label_encoder.pkl'))
    
    print(f"Model saved to {output_dir}")
    
    return model, processor, label_encoder, eval_results

def predict_fetal_plane(image_path, model_dir='./fetal_plane_model'):
    device = get_device()
    
    processor = ViTImageProcessor.from_pretrained(model_dir)
    model = ViTForImageClassification.from_pretrained(model_dir)
    model = model.to(device)
    model.eval()
    
    import joblib
    label_encoder = joblib.load(os.path.join(model_dir, 'label_encoder.pkl'))
    
    image = Image.open(image_path).convert('RGB')
    inputs = processor(images=image, return_tensors="pt")
    inputs = {k: v.to(device) for k, v in inputs.items()}
    
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class_idx = predictions.argmax().item()
        confidence = predictions[0][predicted_class_idx].item()
    
    predicted_label = label_encoder.inverse_transform([predicted_class_idx])[0]
    
    return predicted_label, confidence

def main():
    data_dir = '../datasets/FETAL_PLANES_ZENODO'
    output_dir = '/Users/karthik/Projects/hackathon15092025/models/fetal_plane_model'
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("🔬 Fetal Plane Classification Model Training")
    print("🍎 Optimized for Apple Silicon (M4 Chip)")
    print("=" * 50)
    
    device = get_device()
    optimal_batch_size = 4 if device.type == 'mps' else 8
    optimal_epochs = 3 if device.type == 'mps' else 5
    
    print(f"📊 Training Configuration:")
    print(f"   - Device: {device}")
    print(f"   - Batch Size: {optimal_batch_size}")
    print(f"   - Epochs: {optimal_epochs}")
    print(f"   - Architecture: {platform.machine()}")
    
    model, processor, label_encoder, results = train_fetal_plane_classifier(
        data_dir=data_dir,
        output_dir=output_dir,
        epochs=optimal_epochs,
        batch_size=optimal_batch_size
    )
    
    print("\n✅ Training completed successfully!")
    print(f"Final validation accuracy: {results['eval_accuracy']:.4f}")
    
    print("\n📋 Available classes:")
    for i, class_name in enumerate(label_encoder.classes_):
        print(f"{i}: {class_name}")
    
    sample_image = '/Users/karthik/Projects/hackathon15092025/FETAL_PLANES_ZENODO/Images/Patient00037_Plane1_1_of_3.png'
    if os.path.exists(sample_image):
        print(f"\n🔍 Testing prediction on sample image: {sample_image}")
        predicted_label, confidence = predict_fetal_plane(sample_image, output_dir)
        print(f"Predicted: {predicted_label} (Confidence: {confidence:.3f})")

if __name__ == "__main__":
    main()