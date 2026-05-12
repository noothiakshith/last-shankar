# Orchestrator Dashboard - Workflow States Explained

## Current Situation

You're seeing workflows in the Orchestrator Dashboard, but the newly created ones from the CSV wizard are NOT in the COMPLETED column. Here's why:

### Workflow States in Your Dashboard

Based on the API data, here's what's currently in your Orchestrator:

1. **COMPLETED** (10 workflows) - OLD seed data
   - These are from `prisma/seed.ts` with fake timestamps (28m ago, 3d ago, 6d ago, etc.)
   - Products: prod-widget-a, prod-widget-b, prod-gadget-c, etc.
   - These are NOT from your CSV upload

2. **PENDING_FORECAST_APPROVAL** (2 workflows) - YOUR NEW WORKFLOWS! ⭐
   - Created at: 2026-05-12T15:40:27 (about 2 minutes ago)
   - Products: PROD-001, PROD-002
   - **These are the workflows you just created from the CSV wizard**
   - They're waiting for forecast approval

3. **PENDING_PRODUCTION_AUTH** (4 workflows)
   - Includes PROD-003 from your recent upload
   - Also includes older workflows from previous tests

4. **PENDING_PO_APPROVAL** (6 workflows)
   - Mix of recent and older workflows

## Why Your New Workflows Aren't in COMPLETED

The CSV wizard creates workflows that go through this flow:

```
INITIATED 
  ↓
FORECASTING (forecast generated)
  ↓
PENDING_FORECAST_APPROVAL ← YOU ARE HERE
  ↓ (after approval)
PLANNING
  ↓
PENDING_PRODUCTION_AUTH
  ↓ (after approval)
PROCUREMENT
  ↓
... (continues)
  ↓
COMPLETED
```

### What Happened

1. You ran the CSV wizard (`test-complete-wizard.sh`)
2. It created 3 forecasts (PROD-001, PROD-002, PROD-003)
3. The wizard has `autoApprove: true` in the forecast endpoint
4. **BUT** one of the forecasts (PROD-003) was auto-approved and advanced
5. **The other two** (PROD-001, PROD-002) are stuck in PENDING_FORECAST_APPROVAL

## How to See Your New Workflows

### Option 1: Look in the PENDING_FORECAST_APPROVAL Column

In the Orchestrator Dashboard Kanban board, scroll to find the **PENDING_FORECAST_APPROVAL** column. You should see:
- PROD-001 workflow (created ~2 min ago)
- PROD-002 workflow (created ~2 min ago)

### Option 2: Approve Them in the Sales Dashboard

1. Go to `/dashboard/sales`
2. Find the "Pending Forecasts" section
3. Click "Approve" on each forecast
4. The workflows will advance to the next state
5. Return to `/dashboard/orchestrator` to see them progress

### Option 3: Check the API Directly

```bash
curl "http://localhost:3000/api/orchestrator/workflows?limit=50" | jq '[.[] | select(.state == "PENDING_FORECAST_APPROVAL")]'
```

## Why the Time Shows Wrong

The COMPLETED column shows workflows with these timestamps:
- 28m ago → Created at 15:12:48 (seed data)
- 3d ago → Created at 2026-05-09 (seed data)
- 6d ago → Created at 2026-05-06 (seed data)

These are NOT your workflows. They're from the database seed script that creates fake historical data for demo purposes.

## Solution: Clear Old Data

If you want to see ONLY your real workflows, reset the database:

```bash
npx prisma migrate reset --force
npm run seed
./test-complete-wizard.sh
```

This will:
1. Clear all old workflows
2. Re-seed with fresh data
3. Create 3 new workflows from CSV upload
4. All 3 should complete successfully

## Current Workflow IDs

Your most recent workflows:
- `cmp2srspo004lhxnyudo99p2i` - PROD-003 (PENDING_PRODUCTION_AUTH)
- `cmp2srsow002qhxny3jge88nw` - PROD-002 (PENDING_FORECAST_APPROVAL) ⭐
- `cmp2srso5001thxnyobftito3` - PROD-001 (PENDING_FORECAST_APPROVAL) ⭐

## Next Steps

1. **To see your workflows progress**:
   - Go to Sales Dashboard
   - Approve the pending forecasts
   - Watch them advance in Orchestrator

2. **To clean up old data**:
   - Run `npx prisma migrate reset --force`
   - Re-run the wizard

3. **To verify workflows are working**:
   - Click on any workflow card in Orchestrator
   - View the timeline to see all events
   - Check approval gates section

## Summary

✅ Your workflows ARE in the Orchestrator
✅ They're in PENDING_FORECAST_APPROVAL state (not COMPLETED)
✅ The COMPLETED column shows old seed data (not your workflows)
✅ Approve the forecasts in Sales Dashboard to make them progress
✅ Use the "Back to Sales" link to navigate between dashboards
