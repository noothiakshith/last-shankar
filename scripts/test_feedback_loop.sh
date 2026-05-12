#!/bin/bash

# Test script for ML Feedback Loop
# This demonstrates the complete feedback cycle

echo "🧪 Testing ML Feedback Loop"
echo "================================"
echo ""

# Configuration
API_BASE="http://localhost:3000/api"
PRODUCT_ID="prod-widget-a"
REGION="North America"

echo "📊 Step 1: Train a model"
echo "Run this via the UI or API first to get a modelId"
echo ""

echo "📈 Step 2: Run a forecast"
echo "Run this via the UI to generate predictions"
echo ""

echo "⏰ Step 3: Simulate actual sales data arriving"
echo "Recording actual sales for the next 5 days..."
echo ""

# Get today's date
TODAY=$(date +%Y-%m-%d)

# Simulate 5 days of actual sales with intentional errors to trigger drift
for i in {1..5}; do
  FUTURE_DATE=$(date -v+${i}d +%Y-%m-%d 2>/dev/null || date -d "+${i} days" +%Y-%m-%d)
  
  # Intentionally add high error (predicted ~50, actual ~80) to trigger drift
  QUANTITY=$((70 + RANDOM % 20))
  REVENUE=$((QUANTITY * 180))
  
  echo "Recording actual for $FUTURE_DATE: quantity=$QUANTITY"
  
  curl -X POST "$API_BASE/sales/feedback" \
    -H "Content-Type: application/json" \
    -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
    -d "{
      \"productId\": \"$PRODUCT_ID\",
      \"region\": \"$REGION\",
      \"date\": \"$FUTURE_DATE\",
      \"quantity\": $QUANTITY,
      \"revenue\": $REVENUE
    }" \
    -s | jq '.'
  
  echo ""
  sleep 1
done

echo "✅ Step 4: Check model drift status"
echo "Replace MODEL_ID with your actual model ID:"
echo ""
echo "curl $API_BASE/sales/drift/MODEL_ID \\"
echo "  -H 'Cookie: next-auth.session-token=YOUR_SESSION_TOKEN' | jq '.'"
echo ""

echo "🔄 Step 5: Watch for automatic retraining"
echo "Check the Python service terminal (npm run dev:ml)"
echo "When MAPE > 30%, you'll see retraining logs automatically"
echo ""

echo "📝 Step 6: Verify in database"
echo "psql nexiserp -c 'SELECT * FROM \"PredictionLog\" ORDER BY \"loggedAt\" DESC LIMIT 10;'"
echo ""

echo "================================"
echo "✅ Feedback loop test complete!"
echo ""
echo "To see the full cycle:"
echo "1. Train a model via UI"
echo "2. Run a forecast"
echo "3. Run this script with your session token"
echo "4. Watch Python terminal for automatic retraining"
