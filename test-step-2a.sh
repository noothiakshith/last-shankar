#!/bin/bash

echo "🧪 Testing Step 2a: Data Profiling + LLM Analysis"
echo "=================================================="
echo ""

# Step 1: Upload CSV
echo "Step 1: Uploading CSV file..."
SESSION_ID=$(curl -s -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv" \
  | jq -r '.sessionId')

echo "✓ Upload complete. Session ID: $SESSION_ID"
echo ""

# Step 2: Run analysis
echo "Step 2: Running data analysis..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/analyze" \
  | jq '.' > analysis_result.json

echo "✓ Analysis complete. Results saved to analysis_result.json"
echo ""

# Show summary
echo "Data Quality Summary:"
jq '.dataQuality' analysis_result.json
echo ""

echo "Top 3 Products:"
jq '.topProducts[:3]' analysis_result.json
echo ""

# Step 3: Generate LLM summary
echo "Step 3: Generating AI summary..."
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/llm-summary" \
  | jq '.' > llm_result.json

echo "✓ LLM summary complete. Results saved to llm_result.json"
echo ""

echo "AI Summary:"
jq -r '.summary' llm_result.json
echo ""

echo "=================================================="
echo "✅ Step 2a test complete!"
echo ""
echo "Files created:"
echo "  - analysis_result.json (full analysis data)"
echo "  - llm_result.json (AI summary)"
