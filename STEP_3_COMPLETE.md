# Step 3: Product Selection + LLM Model Recommendations - COMPLETE ✅

## 📋 Overview

Step 3 adds intelligent product selection with AI-powered model recommendations to the CSV upload wizard. The system automatically selects the top products for forecasting using a composite scoring algorithm and recommends the best ML model for each product.

## 🎯 What Was Built

### Step 3a: Product Selection Endpoint (Backend)
**Endpoint**: `POST /api/sales/upload/:sessionId/select-products`

**Selection Algorithm**:
1. **Composite Scoring** (4 factors):
   - Volume (30%): Total quantity sold
   - Revenue (30%): Total revenue generated
   - Variability (25%): Coefficient of variation (higher = more important to forecast)
   - Data Sufficiency (15%): Number of unique days with data

2. **Diversity Rule**:
   - After selecting top product, penalize products from same region by 20%
   - Ensures geographic spread in selection

3. **Top 5 Selection**:
   - Picks top 5 products after applying diversity penalties
   - Minimum 1, maximum 5 products

**LLM Model Recommendations**:
- Sends selected products' profiles to Mistral AI
- Asks for model recommendation from: LINEAR_REGRESSION, RANDOM_FOREST, XGBOOST, ARIMA
- Provides one-sentence reasoning for each recommendation
- Considers: data points, variability, trend, volume

**Fallback Logic** (if LLM fails):
- CV < 0.2 + STABLE trend → LINEAR_REGRESSION
- ≥30 days + non-STABLE trend → ARIMA
- CV ≥ 0.3 → RANDOM_FOREST
- Default → XGBOOST

**Database Updates**:
- Adds `selectedProducts` JSON field to `UploadSession`
- Updates `llmRecommendations` JSON field
- Adds `PRODUCTS_SELECTED` status to `UploadStatus` enum
- Migration: `20260512143036_add_selected_products_field`

### Step 3b: Integrated into Step 3a
No separate endpoint needed - LLM recommendations happen in the same call.

### Step 3c: Product Selection UI (Frontend)
**Wizard Flow**: upload → mapping → analysis → **selection** → complete

**UI Components**:

1. **Header Section**
   - Green success banner with product count
   - "← Back to Analysis" button

2. **Selected Products Table**
   - Columns: Rank, Product, Region, Quantity, Revenue, Trend, Score, Action
   - Medals (🥇🥈🥉) for top 3 products
   - Trend arrows (↑↓→)
   - Score badges (highlighted for top 3)
   - Remove button (✕) - disabled if only 1 product remains

3. **Model Recommendations Section**
   - Card for each product with:
     - Product ID
     - AI reasoning (one sentence)
     - Model dropdown (pre-filled with recommendation)
   - User can override any model selection
   - AI Insight box with selection summary

4. **Action Buttons**
   - "← Back to Analysis" - returns to analysis view
   - "🚀 Train Models" - triggers batch training (Step 4)

## 📊 Example Response

```json
{
  "sessionId": "cmp2qd0xr000viznyl2r5onne",
  "selectedProducts": [
    {
      "rank": 1,
      "productId": "PROD-003",
      "region": "North",
      "totalQuantity": 193,
      "totalRevenue": 5597,
      "cv": 0.16,
      "trend": "STABLE",
      "uniqueDays": 10,
      "score": 0.07
    },
    {
      "rank": 2,
      "productId": "PROD-002",
      "region": "South",
      "totalQuantity": 193,
      "totalRevenue": 4439,
      "cv": 0.14,
      "trend": "INCREASING",
      "uniqueDays": 10,
      "score": 0.06
    },
    {
      "rank": 3,
      "productId": "PROD-001",
      "region": "North",
      "totalQuantity": 207,
      "totalRevenue": 4968,
      "cv": 0.12,
      "trend": "STABLE",
      "uniqueDays": 10,
      "score": 0.06
    }
  ],
  "recommendations": {
    "PROD-003": {
      "model": "LINEAR_REGRESSION",
      "reason": "Stable trend and low demand variability make linear regression ideal for this product."
    },
    "PROD-002": {
      "model": "LINEAR_REGRESSION",
      "reason": "Low demand variability and an increasing trend suggest linear regression is appropriate."
    },
    "PROD-001": {
      "model": "LINEAR_REGRESSION",
      "reason": "Stable trend and very low demand variability favor linear regression for accurate forecasts."
    }
  }
}
```

## 🧪 Testing

### Quick Test (Backend)
```bash
# 1. Upload CSV
SESSION_ID=$(curl -s -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv" | jq -r '.sessionId')

# 2. Run analysis
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/analyze" > /dev/null

# 3. Select products
curl -s -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/select-products" | jq '.'
```

### Full UI Test
1. Navigate to http://localhost:3000/dashboard/sales
2. Upload `walmart_sales.csv`
3. Verify column mapping and click "Continue to Analysis"
4. Review analysis results and click "Select Products →"
5. Verify:
   - 3 products displayed with medals
   - Model recommendations shown
   - Dropdowns pre-filled with LINEAR_REGRESSION
   - Can change model selections
   - Can remove products (except last one)
   - "Train Models" button shows placeholder alert

## ✅ Success Criteria

### Backend (Step 3a)
- [x] Endpoint returns 200 status
- [x] Products ranked by composite score
- [x] Diversity rule applied (both regions represented)
- [x] LLM recommendations provided for each product
- [x] Fallback logic works if LLM fails
- [x] Session status updated to PRODUCTS_SELECTED
- [x] Data persisted in database

### Frontend (Step 3c)
- [x] Selection wizard step displays
- [x] Products table shows all selected products
- [x] Medals display for top 3
- [x] Trend arrows display correctly
- [x] Model recommendations display
- [x] Model dropdowns work
- [x] Remove button works (disabled for last product)
- [x] Navigation buttons work
- [x] Loading states display
- [x] No console errors

## 📁 Files Created/Modified

### Created:
- `src/app/api/sales/upload/[sessionId]/select-products/route.ts` - Selection endpoint
- `prisma/migrations/20260512143036_add_selected_products_field/migration.sql` - Database migration
- `test-step-3a.sh` - Automated test script
- `STEP_3A_TEST.md` - Backend documentation
- `STEP_3C_TEST.md` - Frontend documentation
- `STEP_3_COMPLETE.md` - This summary

### Modified:
- `prisma/schema.prisma` - Added `selectedProducts` field and `PRODUCTS_SELECTED` status
- `src/app/dashboard/sales/page.tsx` - Added selection UI and handlers

## 🔄 Complete Wizard Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Upload + Column Mapping                             │
│ ✅ Upload CSV file                                           │
│ ✅ Auto-detect columns                                       │
│ ✅ Preview data                                              │
│ ✅ Confirm mapping                                           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Data Analysis + AI Summary                          │
│ ✅ Calculate data quality metrics                            │
│ ✅ Profile products (volume, revenue, variability)           │
│ ✅ Analyze regions                                           │
│ ✅ Generate AI summary with Mistral                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Product Selection + Model Recommendations           │
│ ✅ Select top products with composite scoring                │
│ ✅ Apply diversity rule for geographic spread                │
│ ✅ Get AI model recommendations                              │
│ ✅ Allow user to override models                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Batch Training + Import (NEXT)                      │
│ ⏳ Train models for selected products                        │
│ ⏳ Import staged records to main database                    │
│ ⏳ Update KPIs and leaderboard                               │
│ ⏳ Show success confirmation                                 │
└─────────────────────────────────────────────────────────────┘
```

## 🎓 Key Learnings

### Composite Scoring Algorithm
The 4-factor scoring system balances:
- **Business Impact**: Volume + Revenue (60%)
- **Forecasting Complexity**: Variability (25%)
- **Data Quality**: Sufficiency (15%)

This ensures we prioritize products that are:
1. Important to the business (high volume/revenue)
2. Challenging to forecast (high variability)
3. Have enough data for reliable models

### Diversity Rule
The 20% regional penalty ensures:
- Geographic spread in selection
- Avoids over-representing one region
- Captures regional demand patterns
- Improves overall forecast coverage

### LLM Model Recommendations
AI considers multiple factors:
- **Data Points**: ARIMA needs >30 days
- **Variability**: High CV → ensemble methods
- **Trend**: Stable → linear, changing → non-linear
- **Volume**: High volume → complex models

This provides intelligent defaults while allowing user override.

## 📝 Next Steps

### Step 4: Batch Training + Import
1. **Batch Training**:
   - Loop through selected products
   - Call `/api/sales/train` for each with selected model
   - Show progress indicator (1/3, 2/3, 3/3)
   - Handle training failures gracefully

2. **Import to Database**:
   - Move records from `StagedSaleRecord` to `SaleRecord`
   - Apply column mapping
   - Update session status to `IMPORTED`
   - Clean up staged records

3. **Success Confirmation**:
   - Show success message with stats
   - Link to model leaderboard
   - Refresh KPI cards
   - Option to upload another file

## 🔗 Related Documentation

- `STEP_1_COMPLETE.md` - Upload wizard (Step 1)
- `STEP_2A_TEST.md` - Data analysis backend (Step 2a/2b)
- `STEP_2C_TEST.md` - Analysis results UI (Step 2c)
- `STEP_3A_TEST.md` - Product selection backend (Step 3a)
- `STEP_3C_TEST.md` - Product selection UI (Step 3c)

## 🎉 Status: COMPLETE ✅

All three sub-steps of Step 3 are fully implemented and tested:
- ✅ Step 3a: Backend endpoint with scoring + LLM recommendations
- ✅ Step 3b: Integrated into Step 3a
- ✅ Step 3c: Frontend UI with model overrides

The wizard is now ready for Step 4: Batch Training + Import!
