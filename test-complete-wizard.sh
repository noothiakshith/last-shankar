#!/bin/bash

echo "=== Complete CSV Upload Wizard Test ==="
echo ""

# Step 1: Upload CSV
echo "Step 1: Uploading CSV..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv")

SESSION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.sessionId')
echo "✓ Session ID: $SESSION_ID"
echo ""

# Step 2: Analyze data
echo "Step 2: Analyzing data..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/analyze" \
  -H "Content-Type: application/json" \
  -d '{"mapping":{"date":"Date","quantity":"Units_Sold","revenue":"Revenue","product":"Product_ID","region":"Region"}}' \
  | jq '{status: .status, totalRows: .totalRows, uniqueProducts: .uniqueProducts, dateRange: .dateRange}'
echo ""

# Step 3: Get LLM summary
echo "Step 3: Getting LLM summary..."
curl -s "http://localhost:3000/api/sales/upload/$SESSION_ID/llm-summary" \
  | jq -r '.summary' | head -c 200
echo "..."
echo ""

# Step 4: Select products
echo "Step 4: Selecting products..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/select-products" \
  -H "Content-Type: application/json" \
  -d '{"topN": 3}' \
  | jq '{selectedProducts: [.selectedProducts[] | {productId, totalSales, recommendation}]}'
echo ""

# Step 5: Train models
echo "Step 5: Training models..."
TRAIN_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/train" \
  -H "Content-Type: application/json" \
  -d '{"modelType": "ARIMA", "region": "Default"}')

echo "$TRAIN_RESPONSE" | jq '{
  status: .status,
  trained: .summary.trained,
  failed: .summary.failed,
  results: [.results[] | {productId, status, r2Score: .metrics.r2Score}]
}'
echo ""

# Step 6: Generate forecasts
echo "Step 6: Generating forecasts..."
FORECAST_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/forecast" \
  -H "Content-Type: application/json" \
  -d '{"horizon": 30, "autoApprove": true}')

echo "$FORECAST_RESPONSE" | jq '{
  status: .status,
  workflowsSummary: .workflowsSummary,
  totalDemand: ([.forecasts[].totalPredictedDemand] | add),
  forecasts: [.forecasts[] | {productId, demand: .totalPredictedDemand, status, workflowState}]
}'
echo ""

echo "=== Test Complete ==="
echo ""
echo "Next steps:"
echo "1. Check the UI at http://localhost:3000/dashboard/sales"
echo "2. View workflows at http://localhost:3000/dashboard/orchestrator"
echo "3. Verify no 'Product not found' errors in the server logs"
