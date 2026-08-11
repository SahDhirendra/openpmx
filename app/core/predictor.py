import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import os
import json

# Path to save trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "model.json")
MODEL_PATH = os.path.abspath(MODEL_PATH)

class BearingPredictor:
    def __init__(self):
        self.baseline_mean = None
        self.baseline_std = None
        self.dynamic_thresholds = None
        self.is_trained = False
        
        # Try to load saved model on startup
        self.load_model()

    def save_model(self):
        """Save trained model to disk"""
        if not self.is_trained:
            return
        
        model_data = {
            "baseline_mean": self.baseline_mean.tolist(),
            "baseline_std": self.baseline_std.tolist(),
            "dynamic_thresholds": self.dynamic_thresholds.tolist(),
            "is_trained": True
        }
        
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        with open(MODEL_PATH, "w") as f:
            json.dump(model_data, f)
        print(f"Model saved to: {MODEL_PATH}")

    def load_model(self):
        """Load saved model from disk"""
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "r") as f:
                    model_data = json.load(f)
                
                self.baseline_mean = np.array(model_data["baseline_mean"])
                self.baseline_std = np.array(model_data["baseline_std"])
                self.dynamic_thresholds = np.array(model_data["dynamic_thresholds"])
                self.is_trained = True
                print(f"Model loaded from: {MODEL_PATH}")
                print(f"Baseline mean: {self.baseline_mean}")
            except Exception as e:
                print(f"Failed to load model: {e}")
                self.is_trained = False
        else:
            print("No saved model found — train the model first")

    def train(self, data_path: str):
        """Train the predictor on historical bearing data"""
        import zipfile

        first_folder = os.path.join(data_path, "1st_test", "1st_test")

        # Download data if not present
        if not os.path.exists(first_folder):
            print("Data not found. Downloading from Kaggle...")
            os.makedirs(data_path, exist_ok=True)

            import subprocess
            subprocess.run([
                "pip", "install", "kaggle"
            ], check=True)

            zip_path = os.path.join(data_path, "bearing-dataset.zip")
            subprocess.run([
                "kaggle", "datasets", "download",
                "-d", "vinayak123tyagi/bearing-dataset",
                "-p", data_path
            ], check=True)

            print("Extracting dataset...")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(data_path)

            os.remove(zip_path)
            print("Dataset ready!")

        print("Loading bearing data...")
        all_files = sorted(os.listdir(first_folder))

        records = []
        for file in all_files:
            file_path = os.path.join(first_folder, file)
            data = pd.read_csv(file_path, sep="\t", header=None)
            record = {
                "bearing1_rms": np.sqrt(np.mean(data.iloc[:, 0]**2)),
                "bearing2_rms": np.sqrt(np.mean(data.iloc[:, 2]**2)),
                "bearing3_rms": np.sqrt(np.mean(data.iloc[:, 4]**2)),
                "bearing4_rms": np.sqrt(np.mean(data.iloc[:, 6]**2))
            }
            records.append(record)

        df = pd.DataFrame(records)

        # Calculate baseline from first 500 snapshots
        baseline = df.values[:500]
        self.baseline_mean = baseline.mean(axis=0)
        self.baseline_std = baseline.std(axis=0)
        self.dynamic_thresholds = self.baseline_mean * 2

        self.is_trained = True
        
        # Save model to disk immediately
        self.save_model()
        
        print("Predictor trained and saved successfully!")
        print(f"Baseline mean: {self.baseline_mean}")
        print(f"Thresholds: {self.dynamic_thresholds}")

    def predict(self, bearing1: float, bearing2: float,
                bearing3: float, bearing4: float) -> dict:
        """Predict health scores for 4 bearings"""
        if not self.is_trained:
            raise Exception("Predictor not trained yet!")

        readings = [bearing1, bearing2, bearing3, bearing4]
        results = {}

        for i, (reading, mean, thresh) in enumerate(
            zip(readings, self.baseline_mean, self.dynamic_thresholds)
        ):
            # Calculate health score
            health = 100 * (1 - (reading - mean) / (thresh - mean))
            health = max(0, min(100, health))

            # Determine status
            if health >= 75:
                status = "healthy"
            elif health >= 50:
                status = "monitor"
            elif health >= 25:
                status = "warning"
            else:
                status = "critical"

            results[f"bearing{i+1}"] = {
                "rms": round(float(reading), 4),
                "health_score": round(float(health), 1),
                "status": status,
                "threshold": round(float(thresh), 4)
            }

        # Overall machine health
        overall = min(r["health_score"] for r in results.values())

        return {
            "bearings": results,
            "overall_health": round(float(overall), 1),
            "alert": bool(overall < 50)
        }

# Global predictor instance
predictor = BearingPredictor()