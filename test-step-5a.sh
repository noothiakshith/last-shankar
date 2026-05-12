#!/bin/bash

# Step 5a: Test batch forecast + pipeline trigger endpoint

echo "=== Step 5a: Batch Forecast + Pipeline Trigger Test ==="
echo ""

# Use the session ID from Step 4
SESSION_ID="cmp2qd0xr000viznyl2r5onne"

echo "Generating forecasts for session: $SESSION_ID"
echo ""

# Call the forecast endpoint with auto-approve enabled
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/forecast" \
  -H "Content-Type: application/json" \
  -d '{"horizon": 30, "autoApprove": true}' | jq '.'

echo ""
echo "=== Forecast Generation Complete ==="
