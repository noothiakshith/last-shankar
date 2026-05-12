#!/bin/bash

# Test script for manual forecast approval workflow creation
# This tests the fix for the issue where approving a forecast doesn't create a workflow

echo "=========================================="
echo "MANUAL FORECAST APPROVAL TEST"
echo "=========================================="
echo ""

# Get auth cookie
COOKIE=$(cat cookies.txt 2>/dev/null || echo "")

if [ -z "$COOKIE" ]; then
  echo "❌ No auth cookie found. Please login first."
  exit 1
fi

echo "✅ Auth cookie loaded"
echo ""

# Step 1: Create a forecast manually (not via CSV wizard)
echo "STEP 1: Creating a manual forecast"
echo "-------------------------------------------"

# First, get a trained model
MODEL_RESPONSE=$(curl -s -b cookies.txt "http://localhost:3000/api/sales/models")
MODEL_ID=$(echo "$MODEL_RESPONSE" | jq -r '.[0].id' 2>/dev/null)

if [ -z "$MODEL_ID" ] || [ "$MODEL_ID" = "null" ]; then
  echo "❌ No trained models found. Please train a model first."
  exit 1
fi

echo "Using model: $MODEL_ID"

# Create a forecast
FORECAST_RESPONSE=$(curl -s -b cookies.txt -X POST "http://localhost:3000/api/sales/forecast" \
  -H "Content-Type: application/json" \
  -d "{\"modelId\": \"$MODEL_ID\", \"horizon\": 30}")

FORECAST_ID=$(echo "$FORECAST_RESPONSE" | jq -r '.forecast.id' 2>/dev/null)

if [ -z "$FORECAST_ID" ] || [ "$FORECAST_ID" = "null" ]; then
  echo "❌ Failed to create forecast"
  echo "Response: $FORECAST_RESPONSE"
  exit 1
fi

echo "✅ Forecast created: $FORECAST_ID"
echo ""

# Step 2: Check that no workflow exists yet
echo "STEP 2: Verifying no workflow exists"
echo "-------------------------------------------"

WORKFLOWS_BEFORE=$(curl -s "http://localhost:3000/api/orchestrator/workflows?limit=100" | jq --arg fid "$FORECAST_ID" '[.[] | select(.payload.forecastId == $fid)] | length')

echo "Workflows with this forecastId: $WORKFLOWS_BEFORE"

if [ "$WORKFLOWS_BEFORE" != "0" ]; then
  echo "⚠️  Warning: Workflow already exists (this shouldn't happen)"
fi

echo ""

# Step 3: Approve the forecast
echo "STEP 3: Approving the forecast"
echo "-------------------------------------------"

APPROVE_RESPONSE=$(curl -s -b cookies.txt -X POST "http://localhost:3000/api/sales/forecast/$FORECAST_ID/approve")

APPROVED_STATUS=$(echo "$APPROVE_RESPONSE" | jq -r '.status' 2>/dev/null)

if [ "$APPROVED_STATUS" != "APPROVED" ]; then
  echo "❌ Failed to approve forecast"
  echo "Response: $APPROVE_RESPONSE"
  exit 1
fi

echo "✅ Forecast approved"
echo ""

# Step 4: Wait a moment for workflow creation
echo "STEP 4: Waiting for workflow creation..."
sleep 2
echo ""

# Step 5: Check that workflow was created
echo "STEP 5: Verifying workflow was created"
echo "-------------------------------------------"

WORKFLOWS_AFTER=$(curl -s "http://localhost:3000/api/orchestrator/workflows?limit=100")
WORKFLOW_COUNT=$(echo "$WORKFLOWS_AFTER" | jq --arg fid "$FORECAST_ID" '[.[] | select(.payload.forecastId == $fid)] | length')
WORKFLOW_ID=$(echo "$WORKFLOWS_AFTER" | jq -r --arg fid "$FORECAST_ID" '[.[] | select(.payload.forecastId == $fid)][0].id')
WORKFLOW_STATE=$(echo "$WORKFLOWS_AFTER" | jq -r --arg fid "$FORECAST_ID" '[.[] | select(.payload.forecastId == $fid)][0].state')
WORKFLOW_TYPE=$(echo "$WORKFLOWS_AFTER" | jq -r --arg fid "$FORECAST_ID" '[.[] | select(.payload.forecastId == $fid)][0].type')

echo "Workflows with this forecastId: $WORKFLOW_COUNT"

if [ "$WORKFLOW_COUNT" = "0" ]; then
  echo "❌ FAILED: No workflow was created"
  echo ""
  echo "This means the fix didn't work. Check server logs for errors."
  exit 1
fi

echo "✅ SUCCESS: Workflow was created!"
echo ""
echo "Workflow Details:"
echo "  ID: $WORKFLOW_ID"
echo "  Type: $WORKFLOW_TYPE"
echo "  State: $WORKFLOW_STATE"
echo "  Forecast ID: $FORECAST_ID"
echo ""

# Step 6: Verify workflow appears in Orchestrator Dashboard
echo "STEP 6: Verifying workflow in Orchestrator"
echo "-------------------------------------------"

WORKFLOW_DETAIL=$(curl -s "http://localhost:3000/api/orchestrator/workflow/$WORKFLOW_ID")
WORKFLOW_EVENTS=$(echo "$WORKFLOW_DETAIL" | jq '.events | length')

echo "Workflow has $WORKFLOW_EVENTS events"
echo ""

if [ "$WORKFLOW_EVENTS" -gt 0 ]; then
  echo "✅ Workflow is active and processing"
  echo ""
  echo "Sample event:"
  echo "$WORKFLOW_DETAIL" | jq '.events[0]'
else
  echo "⚠️  Workflow exists but has no events yet"
fi

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
echo ""
echo "✅ Manual forecast approval now creates workflows!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/dashboard/orchestrator"
echo "2. Look for workflow: $WORKFLOW_ID"
echo "3. Verify it appears in the Kanban board"
echo "4. Click to view timeline and events"
