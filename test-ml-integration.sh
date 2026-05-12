#!/bin/bash

echo "🧪 Testing ML Service Integration"
echo "=================================="
echo ""

# Test 1: Check if ML service is running
echo "1️⃣  Testing ML Service Health..."
ML_HEALTH=$(curl -s http://localhost:8000/docs | head -1)
if [[ $ML_HEALTH == *"<!DOCTYPE html>"* ]]; then
    echo "   ✅ ML Service is running on port 8000"
else
    echo "   ❌ ML Service is not responding"
    exit 1
fi
echo ""

# Test 2: Direct ML service training test
echo "2️⃣  Testing ML Service Training Endpoint..."
TRAIN_RESPONSE=$(curl -s -X POST http://localhost:8000/train \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "test-product",
    "region": "test-region",
    "modelType": "LINEAR_REGRESSION",
    "data": [
      {"quantity": 100, "date": "2024-01-01"},
      {"quantity": 110, "date": "2024-01-02"},
      {"quantity": 105, "date": "2024-01-03"},
      {"quantity": 115, "date": "2024-01-04"},
      {"quantity": 120, "date": "2024-01-05"}
    ]
  }')

if [[ $TRAIN_RESPONSE == *"mae"* ]]; then
    echo "   ✅ ML Service training works!"
    echo "   Response: $TRAIN_RESPONSE" | jq '.' 2>/dev/null || echo "   Response: $TRAIN_RESPONSE"
else
    echo "   ❌ ML Service training failed"
    echo "   Response: $TRAIN_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Check database connection
echo "3️⃣  Testing Database Connection..."
DB_TEST=$(docker exec shankar-db-1 psql -U postgres -d nexiserp -c "SELECT COUNT(*) FROM \"User\";" 2>&1)
if [[ $DB_TEST == *"(1 row)"* ]]; then
    echo "   ✅ Database is accessible"
else
    echo "   ❌ Database connection failed"
    echo "   Error: $DB_TEST"
fi
echo ""

# Test 4: Check Next.js server
echo "4️⃣  Testing Next.js Server..."
NEXTJS_HEALTH=$(curl -s http://localhost:3000 | head -1)
if [[ $NEXTJS_HEALTH == *"<!DOCTYPE html>"* ]]; then
    echo "   ✅ Next.js server is running on port 3000"
else
    echo "   ❌ Next.js server is not responding"
    echo "   Make sure you run: npm run dev"
fi
echo ""

echo "=================================="
echo "✨ Integration Test Complete!"
echo ""
echo "📝 To test the full flow:"
echo "   1. Visit http://localhost:3000"
echo "   2. Login with: admin@nexis.com / admin123"
echo "   3. Go to Sales Dashboard"
echo "   4. Click 'Train Model' button"
echo ""
echo "📊 To view ML training logs:"
echo "   docker-compose logs -f ml-engine"
