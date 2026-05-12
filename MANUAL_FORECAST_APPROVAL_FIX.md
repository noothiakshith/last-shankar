# Manual Forecast Approval Fix

## Problem Identified

The forecast approval flow had **TWO separate but related issues**:

### Issue 1: Status Mismatch in Backend
```
runForecast()      →  creates forecast with status: DRAFT
approveForecast()  →  expects status: PENDING_APPROVAL
                   →  throws error: "is not pending approval"
                   →  error is caught silently
```

### Issue 2: Missing States in Frontend
The orchestrator dashboard was **hiding workflows in PENDING states**:

```typescript
// OLD CODE - Missing 3 critical states
const boardStates = [
  'INITIATED',
  'FORECASTING',
  'PLANNING',        // ← workflows race through these
  'PROCUREMENT',     // ← and park in PENDING states
  'FINANCE_REVIEW',  // ← that have no columns
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'REJECTED'
];
```

**The three missing states:**
- `PENDING_FORECAST_APPROVAL` ← workflows waiting for forecast approval
- `PENDING_PO_APPROVAL` ← workflows waiting for PO approval  
- `PENDING_PRODUCTION_AUTH` ← workflows waiting for production authorization

These are exactly the states where workflows spend **most of their time** — the "waiting for human action" states.

---

## The Trace

Here's what happens after you approve a forecast:

```
PENDING_FORECAST_APPROVAL  ← NOT SHOWN ON BOARD (invisible)
  → user approves
  → PLANNING                ← shown briefly
  → PROCUREMENT             ← shown briefly
  → PENDING_PO_APPROVAL     ← NOT SHOWN ON BOARD (invisible)
  → FINANCE_REVIEW          ← shown briefly
  → PENDING_PRODUCTION_AUTH ← NOT SHOWN ON BOARD (invisible)
  → EXECUTING               ← shown briefly
  → COMPLETED               ← shown
```

The workflow races through the visible states and parks in a PENDING state that has no column. You never catch it in a displayed state.

---

## Solution Applied

### Backend Fix (2 files)

**File 1: `/src/app/api/sales/forecast/route.ts`** (Leaderboard)

After `runForecast`, immediately update status to `PENDING_APPROVAL`:

```typescript
const forecast = await salesIntelligenceService.runForecast(modelId, horizon);

// Update status to PENDING_APPROVAL so it appears in "Pending Forecast Approvals"
await prisma.forecastResult.update({
  where: { id: forecast.id },
  data: { status: 'PENDING_APPROVAL' }
});

return NextResponse.json({ forecast }, { status: 201 });
```

**File 2: `/src/app/api/sales/upload/[sessionId]/forecast/route.ts`** (CSV Wizard)

In the auto-approve block, update status before approving:

```typescript
if (autoApprove) {
  try {
    // First: DRAFT → PENDING_APPROVAL
    await prisma.forecastResult.update({
      where: { id: forecast.id },
      data: { status: 'PENDING_APPROVAL' }
    });
    
    // Then: PENDING_APPROVAL → APPROVED
    await salesIntelligenceService.approveForecast(forecast.id, 'csv-upload-wizard');
  } catch (approveErr) {
    console.warn(`Auto-approve failed for forecast ${forecast.id}:`, approveErr);
  }
}
```

### Frontend Fix (1 file)

**File 3: `/src/app/dashboard/orchestrator/page.tsx`**

Added the three PENDING states to the board:

```typescript
const boardStates = [
  'INITIATED',
  'FORECASTING',
  'PENDING_FORECAST_APPROVAL',  // ← ADDED
  'PLANNING',
  'PROCUREMENT',
  'PENDING_PO_APPROVAL',        // ← ADDED
  'FINANCE_REVIEW',
  'PENDING_PRODUCTION_AUTH',    // ← ADDED
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'REJECTED'
].filter(state => workflowsByState[state]?.length > 0 || ['COMPLETED', 'FAILED'].includes(state));
```

These states already have proper styling defined in `STATE_CONFIG` with yellow highlighting and ⏳ icons.

---

## Expected Behavior After Fix

### Leaderboard Flow (Manual)
1. Click "🚀 Forecast" → forecast created as `DRAFT` → **immediately updated to `PENDING_APPROVAL`**
2. Forecast **appears** in "Pending Forecast Approvals"
3. Click "✅ Approve" → forecast approved → workflow created
4. **Workflow appears on Orchestrator in `PENDING_FORECAST_APPROVAL` column** (yellow, with ⏳)
5. Workflow progresses through pipeline, pausing at each PENDING state
6. All PENDING states are now **visible** on the board

### CSV Wizard Flow (Auto)
1. `runForecast()` → `DRAFT` → **updated to `PENDING_APPROVAL`** → **approved** → `APPROVED`
2. Workflow created with auto-approved forecast
3. **Workflow appears on Orchestrator** (skips `PENDING_FORECAST_APPROVAL` since auto-approved)
4. Workflow pauses at `PENDING_PO_APPROVAL` and `PENDING_PRODUCTION_AUTH`
5. All PENDING states are now **visible** on the board

---

## Testing

### Test Leaderboard Flow
1. Go to Sales Intelligence dashboard
2. Click "🚀 Forecast" on any trained model
3. **Verify:** Forecast appears in "Pending Forecast Approvals" section
4. Click "✅ Approve"
5. **Verify:** Workflow appears on Orchestrator dashboard in **PENDING_FORECAST_APPROVAL column** (yellow)
6. **Verify:** Workflow progresses and pauses at other PENDING states (all visible)

### Test CSV Wizard Flow
1. Upload CSV → Analyze → Train → Forecast (with auto-approve)
2. **Verify:** Forecast is auto-approved (status = `APPROVED`)
3. **Verify:** Workflow appears on Orchestrator dashboard
4. **Verify:** Workflow pauses at `PENDING_PO_APPROVAL` and `PENDING_PRODUCTION_AUTH` (both visible)
5. **Verify:** No silent errors in console

### Verify Database
```bash
node check-forecasts.js
```

Should show:
- New forecasts with status `PENDING_APPROVAL` (from leaderboard)
- Auto-approved forecasts with status `APPROVED` (from CSV wizard)
- No orphaned `DRAFT` forecasts

---

## Root Cause Analysis

**Why workflows were "disappearing":**

1. **Backend:** Forecasts created as `DRAFT` couldn't be approved (status mismatch)
2. **Frontend:** Even when workflows were created, they parked in PENDING states that had no board columns
3. **Result:** Workflows existed in the database and API returned them, but the UI filtered them out

**The smoking gun:** The workflows **were being created** — the logs proved it. The problem was purely a frontend rendering issue combined with a backend status mismatch.

---

## Status
✅ **FIXED** - Three files updated with minimal changes
- Backend: Forecasts now transition through proper status flow
- Frontend: All workflow states are now visible on the board
- PENDING states (where workflows spend most time) are now displayed with yellow highlighting

