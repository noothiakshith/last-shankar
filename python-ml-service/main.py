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
    
    df = pd.DataFrame([{"quantity": d.quantity, "date": pd.to_datetime(d.date)} for d in req.data])
    df = df.sort_values(by="date")
    
    y = df["quantity"].values
    
    # Feature engineering
    df["month"] = df["date"].dt.month
    df["day_of_week"] = df["date"].dt.dayofweek
    df["index"] = np.arange(len(df))
    
    X = df[["index", "month", "day_of_week"]].values

    y_std = np.std(y)
    if y_std < 0.1: # Reduced threshold to allow more models
        raise HTTPException(status_code=400, detail="Insufficient variance in data")

    modelType = req.modelType
    model = None

    if modelType == "LINEAR_REGRESSION":
        model = LinearRegression()
        model.fit(X, y)
    elif modelType == "RANDOM_FOREST":
        model = RandomForestRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)
    elif modelType == "XGBOOST":
        model = xgb.XGBRegressor(n_estimators=100, random_state=42)
        model.fit(X, y)
    elif modelType == "ARIMA":
        # ARIMA only uses y
        model = ARIMA(y, order=(1, 1, 1)).fit()
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model type: {modelType}")

    if modelType == "ARIMA":
        predictions = model.predict(start=0, end=len(y)-1)
    else:
        predictions = model.predict(X)

    mae = mean_absolute_error(y, predictions)
    rmse = np.sqrt(mean_squared_error(y, predictions))
    
    if np.var(y) > 0.0001:
        r2 = r2_score(y, predictions)
    else:
        r2 = 0.0

    model_id = f"model-{int(time.time()*1000)}"
    model_path = os.path.join(ARTIFACT_DIR, f"{model_id}.joblib")
    
    joblib_data = {
        "modelType": modelType,
        "model": model,
        "lastTimeIndex": len(y) - 1,
        "lastDate": df["date"].iloc[-1]
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
            # Fallback if lastDate is missing (for older models)
            future_X = np.column_stack([
                future_indices,
                np.zeros(req.horizon),
                np.zeros(req.horizon)
            ])
            
        predictions = model.predict(future_X)

    pred_list = [max(0.0, float(p)) for p in predictions] # Predictions shouldn't be negative

    return {
        "predictions": pred_list
    }

@app.delete("/models")
def delete_model_artifact(path: str):
    if os.path.exists(path):
        os.remove(path)
        return {"status": "deleted"}
    return {"status": "not_found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
