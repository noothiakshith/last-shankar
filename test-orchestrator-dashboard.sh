#!/bin/bash

# Test script for Orchestrator Dashboard
# Tests the new API endpoint and verifies data structure

echo "=========================================="
echo "ORCHESTRATOR DASHBOARD TEST"
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

# Test 1: List all workflows
echo "TEST 1: List all workflows"
echo "-------------------------------------------"
RESPONSE=$(curl -s -X GET "http://localhost:3000/api/orchestrator/workflows?limit=10")

WORKFLOW_COUNT=$(echo "$RESPONSE" | jq 'length' 2>/dev/null)
if [ -z "$WORKFLOW_COUNT" ]; then
  WORKFLOW_COUNT=0
fi

echo "Found $WORKFLOW_COUNT workflows"

if [ "$WORKFLOW_COUNT" -gt 0 ]; then
  echo "✅ Workflows endpoint working"
  
  # Get first workflow ID
  WORKFLOW_ID=$(echo "$RESPONSE" | jq -r '.[0].id' 2>/dev/null)
  echo "First workflow ID: $WORKFLOW_ID"
  echo ""
  
  # Test 2: Get workflow detail
  echo "TEST 2: Get workflow detail"
  echo "-------------------------------------------"
  DETAIL_RESPONSE=$(curl -s -X GET "http://localhost:3000/api/orchestrator/workflow/$WORKFLOW_ID")
  
  # Check if detail has required fields
  HAS_ID=$(echo "$DETAIL_RESPONSE" | jq -r '.id' 2>/dev/null)
  HAS_TYPE=$(echo "$DETAIL_RESPONSE" | jq -r '.type' 2>/dev/null)
  HAS_STATE=$(echo "$DETAIL_RESPONSE" | jq -r '.state' 2>/dev/null)
  HAS_EVENTS=$(echo "$DETAIL_RESPONSE" | jq -r '.events | length' 2>/dev/null)
  HAS_APPROVALS=$(echo "$DETAIL_RESPONSE" | jq -r '.approvals | length' 2>/dev/null)
  
  echo "Workflow ID: $HAS_ID"
  echo "Type: $HAS_TYPE"
  echo "State: $HAS_STATE"
  echo "Events: $HAS_EVENTS"
  echo "Approvals: $HAS_APPROVALS"
  
  if [ "$HAS_ID" != "null" ] && [ "$HAS_TYPE" != "null" ] && [ "$HAS_STATE" != "null" ]; then
    echo "✅ Workflow detail endpoint working"
    echo ""
    
    # Show sample event
    if [ "$HAS_EVENTS" -gt 0 ]; then
      echo "Sample Event:"
      echo "$DETAIL_RESPONSE" | jq '.events[0]' 2>/dev/null
      echo ""
    fi
    
    # Show sample approval
    if [ "$HAS_APPROVALS" -gt 0 ]; then
      echo "Sample Approval:"
      echo "$DETAIL_RESPONSE" | jq '.approvals[0]' 2>/dev/null
      echo ""
    fi
  else
    echo "❌ Workflow detail endpoint returned incomplete data"
    echo "Response: $DETAIL_RESPONSE"
  fi
else
  echo "⚠️  No workflows found. Run the CSV wizard test first to create workflows."
  echo ""
  echo "Run: ./test-complete-wizard.sh"
fi

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000/dashboard/orchestrator in your browser"
echo "2. Verify the Kanban board displays workflows correctly"
echo "3. Click on a workflow card to open detail view"
echo "4. Verify timeline renders with events"
echo "5. Check auto-refresh works (10 second interval)"
