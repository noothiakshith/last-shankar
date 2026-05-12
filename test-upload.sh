#!/bin/bash

# Simple test for CSV upload (no auth required)

echo "🧪 Testing CSV Upload Endpoint"
echo "================================"
echo ""

echo "Uploading walmart_sales.csv..."
curl -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv" \
  | jq '.'

echo ""
echo "================================"
echo "✅ Test complete!"
