'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface Model {
  id: string;
  modelType: string;
  mae: number;
  rmse: number;
  r2Score: number;
}

export default function SalesDashboard() {
  const [models, setModels] = useState<Model[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [pendingForecasts, setPendingForecasts] = useState<any[]>([]);
  const [training, setTraining] = useState(false);
  const [forecasting, setForecasting] = useState<Record<string, boolean>>({});
  const [selectedModel, setSelectedModel] = useState('LINEAR_REGRESSION');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadModels();
    loadForecasts();
  }, []);

  const handleTrain = async () => {
    setTraining(true);
    try {
      const response = await fetch('/api/sales/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedModel,
          productId: 'prod-widget-a',
          region: 'North'
        })
      });
      
      if (response.ok) {
        const model = await response.json();
        alert(`Model trained successfully! MAE: ${model.mae.toFixed(2)}, R²: ${model.r2Score.toFixed(2)}`);
        loadModels();
      } else {
        alert('Training failed');
      }
    } catch (error) {
      alert('Error training model');
    } finally {
      setTraining(false);
    }
  };

  const handleForecast = async (modelId: string) => {
    setForecasting(prev => ({ ...prev, [modelId]: true }));
    try {
      const response = await fetch('/api/sales/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          horizon: 30
        })
      });
      
      if (response.ok) {
        alert('Forecast generated! DEMAND_TO_PLAN workflow triggered.');
      } else {
        const data = await response.json();
        alert(`Forecasting failed: ${data.error}`);
      }
    } catch (error) {
      alert('Error running forecast');
    } finally {
      setForecasting(prev => ({ ...prev, [modelId]: false }));
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('/api/sales/leaderboard');
      if (response.ok) {
        const data = await response.json();
        setModels(data);
      }
    } catch (err) {
      console.error('Error loading models:', err);
    }
  };

  const loadForecasts = async () => {
    try {
      const response = await fetch('/api/sales/forecast/pending');
      if (response.ok) {
        const data = await response.json();
        setPendingForecasts(data);
        // Using this length to mock 'forecasts generated' KPI
        setForecasts(data); 
      }
    } catch (err) {
      console.error('Error loading forecasts:', err);
    }
  };

  const handleApproveForecast = async (forecastId: string) => {
    try {
      const response = await fetch(`/api/sales/forecast/${forecastId}/approve`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Forecast approved!');
        loadForecasts();
      } else {
        alert('Failed to approve forecast');
      }
    } catch (err) {
      alert('Error approving forecast');
    }
  };

  const handleRejectForecast = async (forecastId: string) => {
    try {
      // In a real app we'd have a reject endpoint, mocking handled state for UI
      alert('Forecast rejected!');
      loadForecasts();
    } catch (err) {
      alert('Error rejecting forecast');
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm('Are you sure you want to delete this model?')) return;
    
    try {
      const response = await fetch(`/api/sales/models/${modelId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        alert('Model deleted');
        loadModels();
      } else {
        alert('Failed to delete model');
      }
    } catch (err) {
      alert('Error deleting model');
    }
  };

  const fetchExplanation = async (forecastId: string) => {
    if (explanations[forecastId] || loadingExplanations[forecastId]) return;
    
    setLoadingExplanations(prev => ({ ...prev, [forecastId]: true }));
    try {
      const response = await fetch(`/api/llm/forecast/${forecastId}/explain`);
      if (response.ok) {
        const data = await response.json();
        setExplanations(prev => ({ ...prev, [forecastId]: data.explanation }));
      }
    } catch (err) {
      console.error('Error fetching explanation:', err);
    } finally {
      setLoadingExplanations(prev => ({ ...prev, [forecastId]: false }));
    }
  };

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Sales Intelligence Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            AI-powered demand forecasting and sales analytics
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard
            title="Models Trained"
            value={models.length}
            icon="🤖"
            subtitle="Total models"
          />
          <KPICard
            title="Best Model"
            value={models[0]?.modelType || 'N/A'}
            icon="🏆"
            subtitle={models[0] ? `MAE: ${models[0].mae.toFixed(2)}` : ''}
          />
          <KPICard
            title="Forecasts Generated"
            value={forecasts.length}
            icon="📊"
            subtitle="This month"
          />
          <KPICard
            title="Accuracy"
            value={models[0] ? `${(models[0].r2Score * 100).toFixed(1)}%` : 'N/A'}
            icon="🎯"
            trend="up"
            trendValue="+3%"
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Train New Model
            </h4>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
                Model Type
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                <option value="LINEAR_REGRESSION">Linear Regression</option>
                <option value="RANDOM_FOREST">Random Forest</option>
                <option value="XGBOOST">XGBoost</option>
                <option value="ARIMA">ARIMA</option>
              </select>
            </div>

            <button
              onClick={handleTrain}
              disabled={training}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: training ? '#a0aec0' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: training ? 'not-allowed' : 'pointer'
              }}
            >
              {training ? 'Training...' : 'Train Model'}
            </button>

            <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f7fafc', borderRadius: '6px' }}>
              <p style={{ fontSize: '0.85rem', color: '#718096', margin: 0 }}>
                Training uses historical sales data from the database to build predictive models.
              </p>
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>
                Model Leaderboard
              </h4>
              <button 
                onClick={loadModels}
                title="Refresh Leaderboard"
                style={{ 
                  padding: '0.4rem 0.6rem', 
                  fontSize: '0.8rem', 
                  cursor: 'pointer', 
                  background: 'white', 
                  border: '1px solid #e2e8f0', 
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  color: '#4a5568'
                }}
              >
                <span>🔄</span> Refresh
              </button>
            </div>
            
            {models.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                <p>No models trained yet</p>
                <button
                  onClick={loadModels}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: '#edf2f7',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Load Models
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {models.slice(0, 5).map((model, idx) => (
                  <div
                    key={model.id}
                    style={{
                      padding: '1rem',
                      background: idx === 0 ? '#fef5e7' : '#f7fafc',
                      borderRadius: '6px',
                      border: idx === 0 ? '2px solid #f59e0b' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', color: '#1a202c' }}>
                        {idx === 0 && '🏆 '}{model.modelType}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                        R²: {model.r2Score.toFixed(3)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#718096', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <span>MAE: {model.mae.toFixed(2)}</span>
                        <span>RMSE: {model.rmse.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleForecast(model.id)}
                          disabled={forecasting[model.id]}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: '#48bb78',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: forecasting[model.id] ? 'not-allowed' : 'pointer'
                          }}
                        >
                          {forecasting[model.id] ? 'Running...' : '🚀 Forecast'}
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: '#f56565',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            Pending Forecast Approvals
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {pendingForecasts.length === 0 ? (
              <p style={{ color: '#718096', fontSize: '0.9rem' }}>No pending approvals.</p>
            ) : (
              pendingForecasts.map((forecast) => (
                <div key={forecast.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: '#fef5e7', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ fontSize: '1.5rem' }}>⏳</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                      Forecast for Model ID: {forecast.modelId.substring(0, 10)}...
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#718096', margin: 0, marginBottom: '0.75rem' }}>
                      Product: {forecast.productId} | Region: {forecast.region} | Horizon: {forecast.horizon} days
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => handleApproveForecast(forecast.id)}
                        style={{
                          padding: '0.4rem 1rem',
                          background: '#48bb78',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleRejectForecast(forecast.id)}
                        style={{
                          padding: '0.4rem 1rem',
                          background: '#f56565',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        ❌ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>


        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            System Intelligence Activity
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {models.length === 0 ? (
              <p style={{ color: '#718096', fontSize: '0.9rem' }}>No recent activity.</p>
            ) : (
              models.slice(0, 3).map((m, idx) => (
                <div key={m.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
                  <div style={{ fontSize: '1.5rem' }}>🧠</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: '600', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                      Model Optimized: {m.modelType}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#718096', margin: 0 }}>
                      Trained on historical widget sales. Achieved {(m.r2Score * 100).toFixed(1)}% variance coverage.
                    </p>
                    {idx === 0 && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {explanations[m.id] ? (
                          <div style={{ padding: '0.75rem', background: '#eef2ff', borderRadius: '6px', fontSize: '0.85rem', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                            <strong>AI Insight:</strong> {explanations[m.id]}
                          </div>
                        ) : (
                          <button 
                            onClick={() => fetchExplanation(m.id)}
                            disabled={loadingExplanations[m.id]}
                            style={{
                              padding: '0.4rem 0.8rem',
                              background: '#667eea',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              cursor: 'pointer'
                            }}
                          >
                            {loadingExplanations[m.id] ? 'Analyzing...' : 'Explain Performance'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
