from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import xgboost as xgb
from statsmodels.tsa.arima.model import ARIMA
import joblib
import os
import time

app = FastAPI()

ARTIFACT_DIR = os.environ.get("ARTIFACT_DIR", "/tmp/artifacts")
os.makedirs(ARTIFACT_DIR, exist_ok=True)

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

@app.post("/train")
def train_model(req: TrainRequest):
    if len(req.data) < 5:
        raise HTTPException(status_code=400, detail="Insufficient data for training: need at least 5 records.")
    
    y = np.array([d.quantity for d in req.data])
    x = np.arange(len(y)).reshape(-1, 1)

    y_std = np.std(y)
    if y_std < 1.0:
        raise HTTPException(status_code=400, detail="Insufficient variance in data")

    modelType = req.modelType
    model = None

    if modelType == "LINEAR_REGRESSION":
        model = LinearRegression()
        model.fit(x, y)
    elif modelType == "RANDOM_FOREST":
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(x, y)
    elif modelType == "XGBOOST":
        model = xgb.XGBRegressor(n_estimators=100, random_state=42)
        model.fit(x, y)
    elif modelType == "ARIMA":
        model = ARIMA(y, order=(1, 1, 1)).fit()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model type: {modelType}")

    if modelType == "ARIMA":
        predictions = model.predict(start=0, end=len(y)-1)
    else:
        predictions = model.predict(x)

    mae = mean_absolute_error(y, predictions)
    rmse = np.sqrt(mean_squared_error(y, predictions))
    
    if np.var(y) > 0.001:
        r2 = r2_score(y, predictions)
    else:
        r2 = 0.0

    model_id = f"model-{int(time.time()*1000)}"
    model_path = os.path.join(ARTIFACT_DIR, f"{model_id}.joblib")
    
    joblib_data = {
        "modelType": modelType,
        "model": model,
        "lastTimeIndex": len(y) - 1
    }
    joblib.dump(joblib_data, model_path)

    return {
        "mae": float(mae),
        "rmse": float(rmse),
        "r2Score": float(r2),
        "artifactPath": model_path
    }

@app.post("/forecast")
def run_forecast(req: ForecastRequest):
    if not os.path.exists(req.modelPath):
        raise HTTPException(status_code=404, detail="Model artifact not found")

    joblib_data = joblib.load(req.modelPath)
    modelType = joblib_data["modelType"]
    model = joblib_data["model"]
    lastTimeIndex = joblib_data["lastTimeIndex"]

    if modelType == "ARIMA":
        predictions = model.forecast(steps=req.horizon)
    else:
        future_x = np.arange(lastTimeIndex + 1, lastTimeIndex + 1 + req.horizon).reshape(-1, 1)
        predictions = model.predict(future_x)

    pred_list = [float(p) for p in predictions]

    return {
        "predictions": pred_list
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
