#!/bin/bash

# Step 4a: Test batch training endpoint

echo "=== Step 4a: Batch Training Test ==="
echo ""

# Use the session ID from Step 3
SESSION_ID="cmp2qd0xr000viznyl2r5onne"

echo "Training models for session: $SESSION_ID"
echo ""

# Call the training endpoint
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/train" | jq '.'

echo ""
echo "=== Training Complete ==="
