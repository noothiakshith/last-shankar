#!/bin/bash

echo "=== Step 3a: Product Selection + LLM Recommendations Test ==="
echo ""

# Step 1: Upload CSV
echo "Step 1: Uploading walmart_sales.csv..."
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv")

SESSION_ID=$(echo $UPLOAD_RESPONSE | jq -r '.sessionId')
echo "✅ Upload complete. Session ID: $SESSION_ID"
echo ""

# Step 2: Run analysis
echo "Step 2: Running data analysis..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/analyze" > /dev/null
echo "✅ Analysis complete"
echo ""

# Step 3: Get LLM summary
echo "Step 3: Getting LLM summary..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/llm-summary" > /dev/null
echo "✅ LLM summary complete"
echo ""

# Step 4: Select products and get model recommendations
echo "Step 4: Selecting products and getting model recommendations..."
echo ""
SELECTION_RESPONSE=$(curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/select-products")

echo "📊 Product Selection Results:"
echo ""
echo "$SELECTION_RESPONSE" | jq '.'
echo ""

# Extract and display key info
echo "=== Summary ==="
PRODUCT_COUNT=$(echo "$SELECTION_RESPONSE" | jq '.selectedProducts | length')
echo "Products Selected: $PRODUCT_COUNT"
echo ""

echo "Selected Products:"
echo "$SELECTION_RESPONSE" | jq -r '.selectedProducts[] | "  \(.rank). \(.productId) - Region: \(.region // "N/A"), Score: \(.score), Trend: \(.trend)"'
echo ""

echo "Model Recommendations:"
echo "$SELECTION_RESPONSE" | jq -r '.recommendations | to_entries[] | "  \(.key): \(.value.model) - \(.value.reason)"'
echo ""

echo "✅ Step 3a Complete!"
