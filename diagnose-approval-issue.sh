#!/bin/bash

echo "=== DIAGNOSTIC SCRIPT FOR MANUAL FORECAST APPROVAL ==="
echo ""
echo "This script will help diagnose whether workflows are being created when you approve forecasts."
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Check for pending forecasts${NC}"
echo "Fetching forecasts with status PENDING_APPROVAL..."
echo ""

PENDING_FORECASTS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const forecasts = await prisma.forecastResult.findMany({
    where: { status: 'PENDING_APPROVAL' },
    select: {
      id: true,
      productId: true,
      region: true,
      status: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  if (forecasts.length === 0) {
    console.log('❌ No pending forecasts found.');
    console.log('');
    console.log('To create a pending forecast:');
    console.log('1. Go to Sales Dashboard');
    console.log('2. Find a trained model in the leaderboard');
    console.log('3. Click \"🚀 Forecast\" button');
    console.log('');
  } else {
    console.log('✅ Found ' + forecasts.length + ' pending forecast(s):');
    console.log('');
    forecasts.forEach((f, i) => {
      console.log((i + 1) + '. ID: ' + f.id);
      console.log('   Product: ' + f.productId);
      console.log('   Region: ' + f.region);
      console.log('   Created: ' + new Date(f.createdAt).toLocaleString());
      console.log('');
    });
  }
  
  await prisma.\$disconnect();
})();
")

echo "$PENDING_FORECASTS"
echo ""

echo -e "${YELLOW}Step 2: Check for workflows with triggeredBy = 'manual-approval'${NC}"
echo "Fetching workflows created from manual approvals..."
echo ""

MANUAL_WORKFLOWS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const workflows = await prisma.workflowRun.findMany({
    where: {
      OR: [
        { triggeredBy: { contains: 'manual-approval' } },
        { triggeredBy: { contains: '@' } } // Email addresses
      ]
    },
    select: {
      id: true,
      type: true,
      state: true,
      triggeredBy: true,
      payload: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  if (workflows.length === 0) {
    console.log('❌ No workflows found with manual approval trigger.');
    console.log('');
    console.log('This means:');
    console.log('- Either no forecasts have been approved yet');
    console.log('- OR the approval endpoint is not creating workflows');
    console.log('');
  } else {
    console.log('✅ Found ' + workflows.length + ' workflow(s) from manual approvals:');
    console.log('');
    workflows.forEach((w, i) => {
      console.log((i + 1) + '. ID: ' + w.id);
      console.log('   Type: ' + w.type);
      console.log('   State: ' + w.state);
      console.log('   Triggered By: ' + w.triggeredBy);
      console.log('   Forecast ID: ' + (w.payload?.forecastId || 'N/A'));
      console.log('   Product: ' + (w.payload?.productId || 'N/A'));
      console.log('   Created: ' + new Date(w.createdAt).toLocaleString());
      console.log('');
    });
  }
  
  await prisma.\$disconnect();
})();
")

echo "$MANUAL_WORKFLOWS"
echo ""

echo -e "${YELLOW}Step 3: Check recent workflows (last 5)${NC}"
echo "Fetching most recent workflows regardless of trigger..."
echo ""

RECENT_WORKFLOWS=$(node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const workflows = await prisma.workflowRun.findMany({
    select: {
      id: true,
      type: true,
      state: true,
      triggeredBy: true,
      payload: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  
  console.log('Most recent workflows:');
  console.log('');
  workflows.forEach((w, i) => {
    console.log((i + 1) + '. ID: ' + w.id);
    console.log('   Type: ' + w.type);
    console.log('   State: ' + w.state);
    console.log('   Triggered By: ' + w.triggeredBy);
    console.log('   Product: ' + (w.payload?.productId || 'N/A'));
    console.log('   Created: ' + new Date(w.createdAt).toLocaleString());
    console.log('');
  });
  
  await prisma.\$disconnect();
})();
")

echo "$RECENT_WORKFLOWS"
echo ""

echo -e "${YELLOW}Step 4: Instructions for testing${NC}"
echo ""
echo "To test the manual approval workflow:"
echo ""
echo "1. Open your browser to http://localhost:3000/dashboard/sales"
echo "2. Find a pending forecast in the 'Pending Approvals' section"
echo "3. Open your terminal where 'npm run dev' is running"
echo "4. Click '✅ Approve' on a forecast"
echo "5. Watch the terminal for these log messages:"
echo "   - '[FORECAST APPROVAL] No existing workflow found, creating DEMAND_TO_PLAN workflow for forecast: ...'"
echo "   - '[FORECAST APPROVAL] Workflow created successfully'"
echo ""
echo "6. Then run this script again to verify the workflow was created"
echo ""
echo "If you see errors in the terminal, copy them and share them."
echo ""

echo -e "${GREEN}=== DIAGNOSTIC COMPLETE ===${NC}"
