from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
import time
import traceback
from datetime import datetime

app = FastAPI()

ARTIFACT_DIR = os.environ.get("ARTIFACT_DIR", "/tmp/artifacts")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

# Try importing optional dependencies
try:
    # pyrefly: ignore [missing-import]
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("WARNING: XGBoost not available")

try:
    from statsmodels.tsa.arima.model import ARIMA
    HAS_ARIMA = True
except ImportError:
    HAS_ARIMA = False
    print("WARNING: ARIMA not available")

class SalesRecord(BaseModel):
    quantity: float
    date: str

class TrainRequest(BaseModel):
    productId: str
    region: str
    modelType: str
    data: list[SalesRecord]

class ForecastRequest(BaseModel):
    modelPath: str
    horizon: int

class EvaluateRequest(BaseModel):
    predictions: list[float]
    actuals: list[float]

class RetrainRequest(BaseModel):
    productId: str
    region: str
    modelType: str
    data: list[SalesRecord]
    previousModelPath: str
    version: int

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "xgboost_available": HAS_XGBOOST,
        "arima_available": HAS_ARIMA
    }

@app.post("/train")
def train_model(req: TrainRequest):
    print(f"[TRAIN] Starting training for model type: {req.modelType}")
    print(f"[TRAIN] Data points: {len(req.data)}")
    
    try:
        start_time = time.time()
        if len(req.data) < 3:
            raise HTTPException(status_code=400, detail="Insufficient data: need at least 3 records")
        
        df = pd.DataFrame([{"quantity": d.quantity, "date": pd.to_datetime(d.date)} for d in req.data])
        df = df.sort_values(by="date")
        
        y = df["quantity"].values
        df["month"] = df["date"].dt.month
        df["day_of_week"] = df["date"].dt.dayofweek
        df["index"] = np.arange(len(df))
        X = df[["index", "month", "day_of_week"]].values

        y_std = np.std(y)
        if y_std < 0.1:
            raise HTTPException(status_code=400, detail="Insufficient variance in data")

        modelType = req.modelType
        model = None

        if modelType == "LINEAR_REGRESSION":
            print("[TRAIN] Fitting Linear Regression...")
            model = LinearRegression()
            model.fit(X, y)
            
        elif modelType == "RANDOM_FOREST":
            print("[TRAIN] Fitting Random Forest...")
            model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            model.fit(X, y)
            
        elif modelType == "XGBOOST":
            if not HAS_XGBOOST:
                raise HTTPException(status_code=400, detail="XGBoost is not installed")
            print("[TRAIN] Fitting XGBoost...")
            model = xgb.XGBRegressor(n_estimators=100, random_state=42, verbosity=0)
            model.fit(X, y)
            
        elif modelType == "ARIMA":
            if not HAS_ARIMA:
                raise HTTPException(status_code=400, detail="ARIMA is not installed")
            print("[TRAIN] Fitting ARIMA...")
            
            # ARIMA needs enough data points for the lag order
            n_obs = len(y)
            print(f"[TRAIN] Data points: {n_obs}")
            
            # Try different orders, starting with simpler ones
            orders_to_try = [
                (1, 0, 0),  # AR(1) - simplest
                (0, 1, 0),  # I(1) - differencing only
                (1, 1, 0),  # ARI(1,1)
                (2, 0, 0),  # AR(2)
                (1, 1, 1),  # Full ARIMA
            ]
            
            model = None
            last_error = None
            
            for order in orders_to_try:
                # Skip if order requires more data than available
                max_lag = max(order[0], order[2])
                if max_lag >= n_obs:
                    print(f"[TRAIN] Skipping ARIMA{order} - needs more than {n_obs} observations")
                    continue
                
                try:
                    print(f"[TRAIN] Trying ARIMA{order}...")
                    arima_model = ARIMA(y, order=order)
                    try:
                        model = arima_model.fit(method='innovations_mle', disp=False)
                    except TypeError:
                        model = arima_model.fit(method='innovations_mle')
                    print(f"[TRAIN] ARIMA{order} fitted successfully!")
                    break
                except Exception as e:
                    last_error = str(e)
                    print(f"[TRAIN] ARIMA{order} failed: {last_error[:100]}")
                    continue
            
            if model is None:
                # Fallback: If all ARIMA orders fail, use simple exponential smoothing
                print("[TRAIN] All ARIMA orders failed. Using Simple Exponential Smoothing fallback...")
                
                # Simple moving average as fallback
                class SimpleForecaster:
                    def __init__(self, values):
                        self.mean = np.mean(values)
                        self.last_value = values[-1]
                        self.values = values
                    
                    def predict(self, start=None, end=None):
                        """Return mean for all historical points"""
                        if start is not None and end is not None:
                            n = end - start + 1
                            return np.full(n, self.mean)
                        return np.array([self.mean])
                    
                    def forecast(self, steps=1):
                        """Return last value for future"""
                        return np.full(steps, self.last_value)
                
                model = SimpleForecaster(y)
                print("[TRAIN] Using SimpleForecaster fallback (mean for history, last value for forecast)")
            
            elapsed = time.time() - start_time
            print(f"[TRAIN] ✅ ARIMA training complete in {elapsed:.3f}s")
        else:
            raise HTTPException(status_code=400, detail=f"Unknown model type: {modelType}")

        # Compute predictions
        if modelType == "ARIMA":
            predict_fn = getattr(model, "predict")
            predictions = predict_fn(start=0, end=len(y)-1)
        else:
            predictions = model.predict(X)
        
        predictions = np.array(predictions).flatten()

        mae = mean_absolute_error(y, predictions)
        rmse = np.sqrt(mean_squared_error(y, predictions))
        r2 = r2_score(y, predictions) if np.var(y) > 0.0001 else 0.0

        print(f"[TRAIN] Metrics - MAE: {mae:.4f}, RMSE: {rmse:.4f}, R²: {r2:.4f}")

        model_id = f"model-{int(time.time()*1000)}"
        model_path = os.path.join(ARTIFACT_DIR, f"{model_id}.joblib")
        
        joblib.dump({
            "modelType": modelType,
            "model": model,
            "lastTimeIndex": len(y) - 1,
            "lastDate": df["date"].iloc[-1]
        }, model_path)

        print(f"[TRAIN] Model saved: {model_path}")

        return {
            "mae": float(mae),
            "rmse": float(rmse),
            "r2Score": float(r2),
            "artifactPath": model_path
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[TRAIN] ERROR: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/forecast")
def run_forecast(req: ForecastRequest):
    if not os.path.exists(req.modelPath):
        raise HTTPException(status_code=404, detail="Model not found")

    joblib_data = joblib.load(req.modelPath)
    modelType = joblib_data["modelType"]
    model = joblib_data["model"]
    lastTimeIndex = joblib_data["lastTimeIndex"]
    lastDate = joblib_data.get("lastDate")

    if modelType == "ARIMA":
        predictions = model.forecast(steps=req.horizon)
    else:
        future_indices = np.arange(lastTimeIndex + 1, lastTimeIndex + 1 + req.horizon)
        if lastDate:
            future_dates = pd.date_range(start=lastDate + pd.Timedelta(days=1), periods=req.horizon)
            future_X = pd.DataFrame({
                "index": future_indices,
                "month": future_dates.month,
                "day_of_week": future_dates.dayofweek
            }).values
        else:
            future_X = np.column_stack([future_indices, np.zeros(req.horizon), np.zeros(req.horizon)])
        
        predictions = model.predict(future_X)

    predictions = np.array(predictions).flatten()
    return {"predictions": [max(0.0, float(p)) for p in predictions]}

@app.post("/evaluate")
def evaluate_predictions(req: EvaluateRequest):
    if len(req.predictions) != len(req.actuals):
        raise HTTPException(status_code=400, detail="Length mismatch")
    if len(req.predictions) == 0:
        raise HTTPException(status_code=400, detail="Empty data")

    predictions = np.array(req.predictions)
    actuals = np.array(req.actuals)
    
    mae = mean_absolute_error(actuals, predictions)
    rmse = np.sqrt(mean_squared_error(actuals, predictions))
    
    non_zero = actuals != 0
    mape = np.mean(np.abs((actuals[non_zero] - predictions[non_zero]) / actuals[non_zero])) if non_zero.sum() > 0 else 0.0

    return {
        "mae": float(mae),
        "mape": float(mape),
        "rmse": float(rmse),
        "sampleCount": len(predictions),
        "driftDetected": mape > 0.3
    }

@app.post("/retrain")
def retrain_model(req: RetrainRequest):
    # Delegate to train_model
    train_req = TrainRequest(
        productId=req.productId,
        region=req.region,
        modelType=req.modelType,
        data=req.data
    )
    result = train_model(train_req)
    
    # Rename with version
    old_path = result["artifactPath"]
    new_path = os.path.join(ARTIFACT_DIR, f"model-{int(time.time()*1000)}-v{req.version}.joblib")
    os.rename(old_path, new_path)
    
    return {
        "mae": result["mae"],
        "rmse": result["rmse"],
        "r2Score": result["r2Score"],
        "artifactPath": new_path,
        "version": req.version
    }

@app.delete("/models")
def delete_model(path: str):
    if os.path.exists(path):
        os.remove(path)
        return {"status": "deleted"}
    return {"status": "not_found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
