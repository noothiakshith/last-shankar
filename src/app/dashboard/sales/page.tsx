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

interface UploadSession {
  sessionId: string;
  fileName: string;
  totalRows: number;
  columns: string[];
  detectedMapping: {
    dateColumn: string | null;
    quantityColumn: string | null;
    revenueColumn: string | null;
    productColumn: string | null;
    regionColumn: string | null;
    categoryColumn: string | null;
  };
  preview: Record<string, string>[];
}

export default function SalesDashboard() {
  const [models, setModels] = useState<Model[]>([]);
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [pendingForecasts, setPendingForecasts] = useState<any[]>([]);
  const [training, setTraining] = useState(false);
  const [forecasting, setForecasting] = useState<Record<string, boolean>>({});
  const [selectedModel, setSelectedModel] = useState('LINEAR_REGRESSION');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('North America');
  const [loadingExplanations, setLoadingExplanations] = useState<Record<string, boolean>>({});

  // Upload wizard state
  const [uploadSession, setUploadSession] = useState<UploadSession | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [wizardStep, setWizardStep] = useState<'upload' | 'mapping' | 'analysis' | 'selection' | 'training' | 'complete'>('upload');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [llmSummary, setLlmSummary] = useState<string>('');
  const [selecting, setSelecting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);
  const [modelRecommendations, setModelRecommendations] = useState<Record<string, any>>({});
  const [modelOverrides, setModelOverrides] = useState<Record<string, string>>({});
  const [trainingInProgress, setTrainingInProgress] = useState(false);
  const [trainingResults, setTrainingResults] = useState<any[]>([]);
  const [trainingSummary, setTrainingSummary] = useState<any>(null);
  const [llmTrainingSummary, setLlmTrainingSummary] = useState<string>('');
  const [forecastingInProgress, setForecastingInProgress] = useState(false);
  const [forecastResults, setForecastResults] = useState<any[]>([]);
  const [workflowsSummary, setWorkflowsSummary] = useState<any>(null);

  useEffect(() => {
    loadProducts();
    loadModels();
    loadForecasts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
        if (data.length > 0) setSelectedProduct(data[0].id);
      }
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const handleTrain = async () => {
    setTraining(true);
    try {
      const response = await fetch('/api/sales/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedModel,
          productId: selectedProduct,
          region: selectedRegion
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
      const response = await fetch(`/api/sales/forecast/${forecastId}/reject`, {
        method: 'POST'
      });
      if (response.ok) {
        alert('Forecast rejected!');
        loadForecasts();
      } else {
        alert('Failed to reject forecast');
      }
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

  // Upload handlers
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/sales/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploadSession(data);
        setWizardStep('mapping');
        // Initialize column mapping with detected values
        setColumnMapping({
          date: data.detectedMapping.dateColumn || '',
          quantity: data.detectedMapping.quantityColumn || '',
          revenue: data.detectedMapping.revenueColumn || '',
          product: data.detectedMapping.productColumn || '',
          region: data.detectedMapping.regionColumn || '',
          category: data.detectedMapping.categoryColumn || '',
        });
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFileUpload(file);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleConfirmMapping = async () => {
    if (!uploadSession) return;
    
    setWizardStep('analysis');
    setAnalyzing(true);
    
    try {
      // Step 1: Run data profiling analysis
      const analyzeResponse = await fetch(`/api/sales/upload/${uploadSession.sessionId}/analyze`, {
        method: 'POST',
      });
      
      if (!analyzeResponse.ok) {
        throw new Error('Analysis failed');
      }
      
      const analyzeData = await analyzeResponse.json();
      setAnalysisData(analyzeData);
      
      // Step 2: Get LLM summary
      const llmResponse = await fetch(`/api/sales/upload/${uploadSession.sessionId}/llm-summary`, {
        method: 'POST',
      });
      
      if (llmResponse.ok) {
        const llmData = await llmResponse.json();
        setLlmSummary(llmData.summary);
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze data. Please try again.');
      setWizardStep('mapping');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleResetUpload = () => {
    setUploadSession(null);
    setColumnMapping({});
    setWizardStep('upload');
    setAnalysisData(null);
    setLlmSummary('');
    setSelectedProducts([]);
    setModelRecommendations({});
    setModelOverrides({});
  };

  const handleSelectProducts = async () => {
    if (!uploadSession) return;
    
    setWizardStep('selection');
    setSelecting(true);
    
    try {
      const response = await fetch(`/api/sales/upload/${uploadSession.sessionId}/select-products`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Product selection failed');
      }
      
      const data = await response.json();
      setSelectedProducts(data.selectedProducts);
      setModelRecommendations(data.recommendations);
      
      // Initialize model overrides with recommendations
      const overrides: Record<string, string> = {};
      data.selectedProducts.forEach((p: any) => {
        overrides[p.productId] = data.recommendations[p.productId]?.model || 'XGBOOST';
      });
      setModelOverrides(overrides);
      
    } catch (error) {
      console.error('Product selection error:', error);
      alert('Failed to select products. Please try again.');
      setWizardStep('analysis');
    } finally {
      setSelecting(false);
    }
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
    const newOverrides = { ...modelOverrides };
    delete newOverrides[productId];
    setModelOverrides(newOverrides);
  };

  const handleModelOverride = (productId: string, model: string) => {
    setModelOverrides(prev => ({ ...prev, [productId]: model }));
  };

  const handleTrainModels = async () => {
    if (!uploadSession) return;
    
    setWizardStep('training');
    setTrainingInProgress(true);
    
    try {
      const response = await fetch(`/api/sales/upload/${uploadSession.sessionId}/train`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Training failed');
      }
      
      const data = await response.json();
      setTrainingResults(data.results);
      setTrainingSummary(data.summary);
      setLlmTrainingSummary(data.llmTrainingSummary || '');
      
    } catch (error) {
      console.error('Training error:', error);
      alert('Failed to train models. Please try again.');
      setWizardStep('selection');
    } finally {
      setTrainingInProgress(false);
    }
  };

  const handleGenerateForecasts = async () => {
    if (!uploadSession) return;
    
    setWizardStep('complete');
    setForecastingInProgress(true);
    
    try {
      const response = await fetch(`/api/sales/upload/${uploadSession.sessionId}/forecast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizon: 30, autoApprove: true }),
      });
      
      if (!response.ok) {
        throw new Error('Forecast generation failed');
      }
      
      const data = await response.json();
      setForecastResults(data.forecasts);
      setWorkflowsSummary(data.workflowsSummary);
      
    } catch (error) {
      console.error('Forecast error:', error);
      alert('Failed to generate forecasts. Please try again.');
      setWizardStep('training');
    } finally {
      setForecastingInProgress(false);
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

        {/* Upload Wizard Section */}
        <div style={{
          background: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📤 Upload Sales Data
          </h4>

          {wizardStep === 'upload' && !uploadSession ? (
            // File drop zone
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              style={{
                border: dragActive ? '2px dashed #667eea' : '2px dashed #e2e8f0',
                borderRadius: '8px',
                padding: '3rem',
                textAlign: 'center',
                background: dragActive ? '#f7fafc' : '#fafafa',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {uploading ? (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                  <p style={{ color: '#718096', fontSize: '1rem' }}>Uploading and analyzing...</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Drop your CSV file here
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <button
                      onClick={() => document.getElementById('file-upload')?.click()}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Select CSV File
                    </button>
                  </label>
                  <p style={{ color: '#a0aec0', fontSize: '0.8rem', marginTop: '1rem' }}>
                    Supported format: CSV with headers (date, product, quantity, revenue, region)
                  </p>
                </div>
              )}
            </div>
          ) : wizardStep === 'mapping' && uploadSession ? (
            // Preview and mapping section
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem' }}>
                    📄 {uploadSession.fileName}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                    {uploadSession.totalRows} rows uploaded
                  </p>
                </div>
                <button
                  onClick={handleResetUpload}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f56565',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  🗑️ Remove
                </button>
              </div>

              {/* Column Mapping */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c' }}>
                  Column Mapping
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {[
                    { key: 'date', label: 'Date Column', required: true },
                    { key: 'quantity', label: 'Quantity Column', required: true },
                    { key: 'revenue', label: 'Revenue Column', required: true },
                    { key: 'product', label: 'Product Column', required: true },
                    { key: 'region', label: 'Region Column', required: false },
                    { key: 'category', label: 'Category Column', required: false },
                  ].map(({ key, label, required }) => (
                    <div key={key}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: '#4a5568', fontWeight: '500' }}>
                        {label} {required && <span style={{ color: '#f56565' }}>*</span>}
                      </label>
                      <select
                        value={columnMapping[key] || ''}
                        onChange={(e) => setColumnMapping(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '0.9rem',
                          background: columnMapping[key] ? '#f0fff4' : 'white'
                        }}
                      >
                        <option value="">-- Select --</option>
                        {uploadSession.columns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c' }}>
                  Data Preview (First 10 Rows)
                </h5>
                <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc' }}>
                        {uploadSession.columns.map(col => (
                          <th key={col} style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadSession.preview.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f7fafc' }}>
                          {uploadSession.columns.map(col => (
                            <td key={col} style={{ padding: '0.75rem', color: '#1a202c' }}>
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleConfirmMapping}
                  disabled={!columnMapping.date || !columnMapping.quantity || !columnMapping.revenue || !columnMapping.product}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: (!columnMapping.date || !columnMapping.quantity || !columnMapping.revenue || !columnMapping.product) ? '#a0aec0' : '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: (!columnMapping.date || !columnMapping.quantity || !columnMapping.revenue || !columnMapping.product) ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✅ Continue to Analysis
                </button>
              </div>
            </div>
          ) : wizardStep === 'analysis' ? (
            // Analysis Results View
            <div>
              {analyzing ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Analyzing your data...
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                    AI is profiling your dataset and generating insights
                  </p>
                </div>
              ) : analysisData ? (
                <div>
                  {/* Header with file info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#f0fff4', borderRadius: '6px', border: '1px solid #9ae6b4' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✅ Analysis Complete: {uploadSession?.fileName}
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                        {analysisData.dataQuality.totalRows} rows analyzed
                      </p>
                    </div>
                    <button
                      onClick={handleResetUpload}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Upload
                    </button>
                  </div>

                  {/* Data Quality Report */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📊 Data Quality Report
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Total Rows</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a202c' }}>{analysisData.dataQuality.totalRows.toLocaleString()}</p>
                      </div>
                      <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Date Range</p>
                        <p style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1a202c' }}>
                          {analysisData.dataQuality.dateRange.from} to {analysisData.dataQuality.dateRange.to}
                        </p>
                      </div>
                      <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Products</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a202c' }}>{analysisData.dataQuality.uniqueProducts}</p>
                      </div>
                      <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Regions</p>
                        <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a202c' }}>{analysisData.dataQuality.uniqueRegions}</p>
                      </div>
                    </div>

                    {/* Quality Metrics */}
                    <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>
                            {analysisData.dataQuality.missingDates === 0 ? '✅' : '⚠️'} Missing Dates
                          </p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: analysisData.dataQuality.missingDates === 0 ? '#48bb78' : '#f59e0b' }}>
                            {analysisData.dataQuality.missingDates}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>
                            {analysisData.dataQuality.missingQuantities === 0 ? '✅' : '⚠️'} Missing Quantities
                          </p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: analysisData.dataQuality.missingQuantities === 0 ? '#48bb78' : '#f59e0b' }}>
                            {analysisData.dataQuality.missingQuantities}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>
                            {analysisData.dataQuality.duplicates === 0 ? '✅' : '⚠️'} Duplicates
                          </p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: analysisData.dataQuality.duplicates === 0 ? '#48bb78' : '#f59e0b' }}>
                            {analysisData.dataQuality.duplicates}
                          </p>
                        </div>
                        <div>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>
                            {analysisData.dataQuality.outliers === 0 ? '✅' : '⚠️'} Outliers
                          </p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: analysisData.dataQuality.outliers === 0 ? '#48bb78' : '#f59e0b' }}>
                            {analysisData.dataQuality.outliers}
                          </p>
                        </div>
                      </div>

                      {/* Quality Score Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>Overall Quality Score</p>
                          <p style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>
                            {(analysisData.dataQuality.qualityScore * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${analysisData.dataQuality.qualityScore * 100}%`,
                            height: '100%',
                            background: analysisData.dataQuality.qualityScore >= 0.9 ? '#48bb78' : analysisData.dataQuality.qualityScore >= 0.7 ? '#f59e0b' : '#f56565',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Products Table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🏆 Top Products by Operational Impact
                    </h5>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f7fafc' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Rank</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Product</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Total Quantity</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Total Revenue</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Impact Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysisData.topProducts.map((product: any) => (
                            <tr key={product.productId} style={{ borderBottom: '1px solid #f7fafc' }}>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>
                                {product.rank === 1 ? '🥇' : product.rank === 2 ? '🥈' : product.rank === 3 ? '🥉' : product.rank}
                              </td>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>{product.productId}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>{product.totalQuantity.toLocaleString()}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>${product.totalRevenue.toLocaleString()}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  background: product.rank <= 3 ? '#fef5e7' : '#f7fafc',
                                  borderRadius: '4px',
                                  fontWeight: '600',
                                  color: product.rank <= 3 ? '#f59e0b' : '#718096'
                                }}>
                                  {product.score.toFixed(2)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Region Summary */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🌍 Regional Performance
                    </h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                      {analysisData.regionStats.map((region: any) => (
                        <div key={region.region} style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.75rem' }}>
                            {region.region}
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.85rem', color: '#718096' }}>Quantity:</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>{region.totalQuantity.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.85rem', color: '#718096' }}>Revenue:</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>${region.totalRevenue.toLocaleString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.85rem', color: '#718096' }}>Products:</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>{region.uniqueProducts}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Summary */}
                  {llmSummary && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🤖 AI Analysis Summary
                      </h5>
                      <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <p style={{ fontSize: '0.95rem', color: '#1e40af', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                          {llmSummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleResetUpload}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Upload
                    </button>
                    <button
                      onClick={handleSelectProducts}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Select Products →
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Analysis Failed
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Unable to analyze the uploaded data
                  </p>
                  <button
                    onClick={() => setWizardStep('mapping')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Mapping
                  </button>
                </div>
              )}
            </div>
          ) : wizardStep === 'selection' ? (
            // Product Selection View
            <div>
              {selecting ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Selecting optimal products...
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                    AI is analyzing product profiles and recommending models
                  </p>
                </div>
              ) : selectedProducts.length > 0 ? (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#f0fff4', borderRadius: '6px', border: '1px solid #9ae6b4' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✅ Top {selectedProducts.length} Products Selected for Forecasting
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                        AI has recommended optimal models for each product
                      </p>
                    </div>
                    <button
                      onClick={() => setWizardStep('analysis')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Analysis
                    </button>
                  </div>

                  {/* Selected Products Table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📦 Selected Products
                    </h5>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f7fafc' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Rank</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Product</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Region</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Quantity</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Revenue</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Trend</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Score</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProducts.map((product) => (
                            <tr key={product.productId} style={{ borderBottom: '1px solid #f7fafc' }}>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>
                                {product.rank === 1 ? '🥇' : product.rank === 2 ? '🥈' : product.rank === 3 ? '🥉' : product.rank}
                              </td>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>{product.productId}</td>
                              <td style={{ padding: '0.75rem', color: '#1a202c' }}>{product.region || 'N/A'}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>{product.totalQuantity.toLocaleString()}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>${product.totalRevenue.toLocaleString()}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'center', color: '#1a202c' }}>
                                {product.trend === 'INCREASING' ? '↑' : product.trend === 'DECREASING' ? '↓' : '→'}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  background: product.rank <= 3 ? '#fef5e7' : '#f7fafc',
                                  borderRadius: '4px',
                                  fontWeight: '600',
                                  color: product.rank <= 3 ? '#f59e0b' : '#718096'
                                }}>
                                  {product.score.toFixed(2)}
                                </span>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleRemoveProduct(product.productId)}
                                  disabled={selectedProducts.length === 1}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    background: selectedProducts.length === 1 ? '#e2e8f0' : '#f56565',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    cursor: selectedProducts.length === 1 ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#718096', marginTop: '0.5rem' }}>
                      Minimum 1 product required. Remove button disabled for last product.
                    </p>
                  </div>

                  {/* Model Recommendations */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🤖 AI Model Recommendations
                    </h5>
                    <div style={{ padding: '1.5rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                        {selectedProducts.map((product) => {
                          const recommendation = modelRecommendations[product.productId];
                          return (
                            <div key={product.productId} style={{ padding: '1rem', background: 'white', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem' }}>
                                    {product.productId}
                                  </p>
                                  <p style={{ fontSize: '0.85rem', color: '#718096', lineHeight: '1.5' }}>
                                    {recommendation?.reason || 'No recommendation available'}
                                  </p>
                                </div>
                                <div style={{ marginLeft: '1rem' }}>
                                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.75rem', color: '#718096', fontWeight: '500' }}>
                                    Model
                                  </label>
                                  <select
                                    value={modelOverrides[product.productId] || recommendation?.model || 'XGBOOST'}
                                    onChange={(e) => handleModelOverride(product.productId, e.target.value)}
                                    style={{
                                      padding: '0.5rem',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '4px',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      background: 'white',
                                      minWidth: '180px'
                                    }}
                                  >
                                    <option value="LINEAR_REGRESSION">Linear Regression</option>
                                    <option value="RANDOM_FOREST">Random Forest</option>
                                    <option value="XGBOOST">XGBoost</option>
                                    <option value="ARIMA">ARIMA</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* AI Summary */}
                      <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <p style={{ fontSize: '0.9rem', color: '#1e40af', lineHeight: '1.6', margin: 0 }}>
                          🤖 <strong>AI Insight:</strong> These {selectedProducts.length} products cover {new Set(selectedProducts.map(p => p.region)).size} region(s) with diverse demand patterns. 
                          {modelRecommendations[selectedProducts[0]?.productId]?.model === 'XGBOOST' && ' XGBoost is recommended for the top product to capture non-linear seasonality.'}
                          {modelRecommendations[selectedProducts[0]?.productId]?.model === 'LINEAR_REGRESSION' && ' Linear models are recommended for stable, predictable demand.'}
                          {modelRecommendations[selectedProducts[0]?.productId]?.model === 'RANDOM_FOREST' && ' Ensemble methods are recommended to handle demand variability.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setWizardStep('analysis')}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Analysis
                    </button>
                    <button
                      onClick={handleTrainModels}
                      disabled={selectedProducts.length === 0}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: selectedProducts.length === 0 ? '#a0aec0' : '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: selectedProducts.length === 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      🚀 Train Models
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Product Selection Failed
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Unable to select products from the analysis
                  </p>
                  <button
                    onClick={() => setWizardStep('analysis')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Analysis
                  </button>
                </div>
              )}
            </div>
          ) : wizardStep === 'training' ? (
            // Training Progress and Results View
            <div>
              {trainingInProgress ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚀</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Training Models...
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                    AI is training forecasting models for selected products
                  </p>
                  <div style={{ marginTop: '2rem', maxWidth: '400px', margin: '2rem auto 0' }}>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: '60%',
                        height: '100%',
                        background: '#667eea',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }} />
                    </div>
                  </div>
                </div>
              ) : trainingResults.length > 0 ? (
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '1rem', background: '#f0fff4', borderRadius: '6px', border: '1px solid #9ae6b4' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ✅ Training Complete — {trainingSummary?.succeeded || 0} Model{trainingSummary?.succeeded !== 1 ? 's' : ''} Ready
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                        {trainingSummary?.failed > 0 && `${trainingSummary.failed} model(s) failed to train`}
                      </p>
                    </div>
                    <button
                      onClick={() => setWizardStep('selection')}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Selection
                    </button>
                  </div>

                  {/* Training Results Table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📊 Training Results
                    </h5>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f7fafc' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Product</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Model</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>MAE</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>RMSE</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>R²</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trainingResults.map((result) => (
                            <tr key={result.productId} style={{ borderBottom: '1px solid #f7fafc' }}>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>{result.productId}</td>
                              <td style={{ padding: '0.75rem', color: '#1a202c' }}>{result.modelType.replace('_', ' ')}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>
                                {result.status === 'SUCCESS' ? result.metrics.mae.toFixed(2) : '—'}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>
                                {result.status === 'SUCCESS' ? result.metrics.rmse.toFixed(2) : '—'}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c' }}>
                                {result.status === 'SUCCESS' ? (
                                  <span style={{
                                    padding: '0.25rem 0.5rem',
                                    background: result.metrics.r2Score >= 0.9 ? '#d4edda' : result.metrics.r2Score >= 0.7 ? '#fff3cd' : '#f8d7da',
                                    borderRadius: '4px',
                                    fontWeight: '600',
                                    color: result.metrics.r2Score >= 0.9 ? '#155724' : result.metrics.r2Score >= 0.7 ? '#856404' : '#721c24'
                                  }}>
                                    {result.metrics.r2Score.toFixed(2)}
                                  </span>
                                ) : '—'}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                {result.status === 'SUCCESS' ? (
                                  <span style={{ color: '#48bb78', fontWeight: '600' }}>✅</span>
                                ) : (
                                  <span style={{ color: '#f56565', fontWeight: '600' }} title={result.error}>❌</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  {trainingSummary && (
                    <div style={{ marginBottom: '2rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div style={{ padding: '1rem', background: '#f0fff4', borderRadius: '6px', border: '1px solid #9ae6b4' }}>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Best Model</p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1a202c' }}>
                            {trainingSummary.bestModel?.productId || 'N/A'}
                          </p>
                          <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                            R² = {trainingSummary.bestModel?.r2Score.toFixed(2) || 'N/A'}
                          </p>
                        </div>
                        <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Average R²</p>
                          <p style={{ fontSize: '1.2rem', fontWeight: '600', color: '#1a202c' }}>
                            {trainingSummary.succeeded > 0 
                              ? (trainingResults
                                  .filter((r: any) => r.status === 'SUCCESS')
                                  .reduce((sum: number, r: any) => sum + r.metrics.r2Score, 0) / trainingSummary.succeeded
                                ).toFixed(2)
                              : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LLM Training Summary */}
                  {llmTrainingSummary && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🤖 AI Summary
                      </h5>
                      <div style={{ padding: '1.5rem', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                        <p style={{ fontSize: '0.95rem', color: '#1e40af', lineHeight: '1.6', margin: 0 }}>
                          {llmTrainingSummary}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setWizardStep('selection')}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#718096',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ← Back to Product Selection
                    </button>
                    <button
                      onClick={() => {
                        loadModels();
                        handleResetUpload();
                        alert('Models trained successfully! Check the leaderboard below.');
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                      onClick={handleGenerateForecasts}
                    >
                      📊 Generate Forecasts →
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Training Failed
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Unable to train models
                  </p>
                  <button
                    onClick={() => setWizardStep('selection')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    ← Back to Selection
                  </button>
                </div>
              )}
            </div>
          ) : wizardStep === 'complete' ? (
            // Forecast Results and Pipeline Status View
            <div>
              {forecastingInProgress ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
                    Generating Forecasts...
                  </p>
                  <p style={{ color: '#718096', fontSize: '0.9rem' }}>
                    AI is generating demand forecasts and triggering workflows
                  </p>
                  <div style={{ marginTop: '2rem', maxWidth: '400px', margin: '2rem auto 0' }}>
                    <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: '70%',
                        height: '100%',
                        background: '#48bb78',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }} />
                    </div>
                  </div>
                </div>
              ) : forecastResults.length > 0 ? (
                <div>
                  {/* Header */}
                  <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f0fff4', borderRadius: '6px', border: '1px solid #9ae6b4' }}>
                    <p style={{ fontWeight: '600', color: '#1a202c', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                      ✅ Wizard Complete — All Forecasts Generated
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                      {workflowsSummary?.triggered || 0} workflow{workflowsSummary?.triggered !== 1 ? 's' : ''} triggered successfully
                    </p>
                  </div>

                  {/* Forecast Results Table */}
                  <div style={{ marginBottom: '2rem' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📊 Forecast Results
                    </h5>
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#f7fafc' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Product</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>30-Day Demand</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Workflow</th>
                            <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#4a5568' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {forecastResults.map((result) => (
                            <tr key={result.productId} style={{ borderBottom: '1px solid #f7fafc' }}>
                              <td style={{ padding: '0.75rem', color: '#1a202c', fontWeight: '600' }}>{result.productId}</td>
                              <td style={{ padding: '0.75rem', textAlign: 'right', color: '#1a202c', fontWeight: '600' }}>
                                {result.totalPredictedDemand} units
                              </td>
                              <td style={{ padding: '0.75rem', color: '#718096', fontSize: '0.8rem' }}>
                                {result.workflowState}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                {result.status === 'SUCCESS' ? (
                                  <span style={{ color: '#48bb78', fontWeight: '600' }}>✅</span>
                                ) : (
                                  <span style={{ color: '#f56565', fontWeight: '600' }} title={result.error}>❌</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Total Demand */}
                  <div style={{ marginBottom: '2rem', padding: '1rem', background: '#f7fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontSize: '0.8rem', color: '#718096', marginBottom: '0.25rem' }}>Total Predicted Demand</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a202c' }}>
                      {forecastResults.reduce((sum, r) => sum + r.totalPredictedDemand, 0).toLocaleString()} units
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#718096' }}>over 30 days</p>
                  </div>

                  {/* Pipeline Status */}
                  <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#ebf8ff', borderRadius: '6px', border: '1px solid #90cdf4' }}>
                    <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1a202c', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      🔄 Pipeline Status
                    </h5>
                    <p style={{ fontSize: '0.9rem', color: '#2d3748', marginBottom: '1rem' }}>
                      Each forecast has triggered an automated workflow:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                      {forecastResults.filter(r => r.status === 'SUCCESS').map((result) => (
                        <li key={result.productId} style={{ padding: '0.5rem 0', color: '#2d3748', fontSize: '0.85rem' }}>
                          <strong>{result.productId}</strong> → Workflow {result.workflowState} → Will plan production
                        </li>
                      ))}
                    </ul>
                    <p style={{ fontSize: '0.85rem', color: '#4a5568', fontStyle: 'italic' }}>
                      💡 The orchestrator is now running MRP, detecting shortages, and creating procurement orders automatically for each product.
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                      onClick={() => window.location.href = '/dashboard/orchestrator'}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      View Orchestrator Dashboard →
                    </button>
                    <button
                      onClick={() => {
                        setWizardStep('upload');
                        setUploadSession(null);
                        setForecastResults([]);
                        setTrainingResults([]);
                        setSelectedProducts([]);
                        setAnalysisData(null);
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#48bb78',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Start New Upload
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
                Product
              </label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
                Region
              </label>
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem'
                }}
              >
                <option value="North America">North America</option>
                <option value="South America">South America</option>
                <option value="Europe">Europe</option>
                <option value="Asia Pacific">Asia Pacific</option>
                <option value="Middle East">Middle East</option>
                <option value="Africa">Africa</option>
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
