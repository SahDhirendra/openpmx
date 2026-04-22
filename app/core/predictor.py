import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import os

class BearingPredictor:
    def __init__(self):
        self.baseline_mean = None
        self.baseline_std = None
        self.dynamic_thresholds = None
        self.is_trained = False

    def train(self, data_path: str):
        """Train the predictor on historical bearing data"""
        print("Loading bearing data...")
        first_folder = os.path.join(data_path, "1st_test", "1st_test")
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
        print("Predictor trained successfully!")
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
                "rms": round(reading, 4),
                "health_score": round(health, 1),
                "status": status,
                "threshold": round(thresh, 4)
            }

        # Overall machine health
        overall = min(r["health_score"] for r in results.values())
        
        return {
            "bearings": results,
            "overall_health": round(overall, 1),
            "alert": overall < 50
        }

# Global predictor instance
predictor = BearingPredictor()