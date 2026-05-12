# Step 3a: Product Selection + LLM Model Recommendations - Testing Guide

## ✅ What Was Built

Created the product selection endpoint with intelligent scoring and AI-powered model recommendations:

### 1. **Endpoint**: `POST /api/sales/upload/:sessionId/select-products`

### 2. **Selection Algorithm**
- **Composite Scoring**: Products scored on:
  - Volume (30%): Total quantity sold
  - Revenue (30%): Total revenue generated
  - Variability (25%): Coefficient of variation (higher = more important to forecast)
  - Data Sufficiency (15%): Number of unique days with data
- **Diversity Rule**: After selecting top product, penalize products from same region by 20% to ensure geographic spread
- **Top 5 Selection**: Picks top 5 products after applying diversity penalties

### 3. **LLM Model Recommendations**
- Sends selected products' profiles to Mistral AI
- Asks for model recommendation for each product from:
  - `LINEAR_REGRESSION`: Stable, low-variance demand with linear trends
  - `RANDOM_FOREST`: Moderate variability with non-linear patterns
  - `XGBOOST`: High volume with complex interactions and seasonality
  - `ARIMA`: Time-series with strong autocorrelation (>30 data points)
- LLM provides model choice + one-sentence reasoning for each product

### 4. **Fallback Logic**
If LLM fails, applies heuristic-based defaults:
- CV < 0.2 + STABLE trend → `LINEAR_REGRESSION`
- ≥30 days + non-STABLE trend → `ARIMA`
- CV ≥ 0.3 → `RANDOM_FOREST`
- Default → `XGBOOST`

### 5. **Database Updates**
- Adds `selectedProducts` JSON field to `UploadSession`
- Updates `llmRecommendations` JSON field
- Adds `PRODUCTS_SELECTED` status to `UploadStatus` enum
- Migration: `20260512143036_add_selected_products_field`

## 🧪 How to Test

### Quick Test (Automated Script)
```bash
./test-step-3a.sh
```

### Manual Test (Step by Step)

#### 1. Upload CSV
```bash
curl -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv"
```

Save the `sessionId` from response.

#### 2. Run Analysis
```bash
SESSION_ID="your-session-id-here"

curl -X POST "http://localhost:3000/api/sales/upload/$cmp2qd0xr000viznyl2r5onne/analyze"
```

#### 3. Get LLM Summary (Optional)
```bash
curl -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/llm-summary"
```

#### 4. Select Products + Get Recommendations
```bash
curl -s -X POST "http://localhost:3000/api/sales/upload/cmp2qd0xr000viznyl2r5onne/select-products" | jq '.'
```

## 📊 Expected Results

### Response Structure
```json
{
  "sessionId": "cmp2pxvd3002lwonyxmos5zve",
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
      "productId": "PROD-001",
      "region": "South",
      "totalQuantity": 207,
      "totalRevenue": 4968,
      "cv": 0.12,
      "trend": "STABLE",
      "uniqueDays": 10,
      "score": 0.06
    },
    {
      "rank": 3,
      "productId": "PROD-002",
      "region": "North",
      "totalQuantity": 193,
      "totalRevenue": 4439,
      "cv": 0.14,
      "trend": "INCREASING",
      "uniqueDays": 10,
      "score": 0.05
    }
  ],
  "recommendations": {
    "PROD-003": {
      "model": "LINEAR_REGRESSION",
      "reason": "Stable demand with low variability suggests a simple linear model."
    },
    "PROD-001": {
      "model": "LINEAR_REGRESSION",
      "reason": "Highest volume with very low variability; linear model avoids overfitting."
    },
    "PROD-002": {
      "model": "RANDOM_FOREST",
      "reason": "Increasing trend with moderate variability; ensemble method captures growth."
    }
  }
}
```

### For walmart_sales.csv (30 rows, 3 products, 2 regions)

**Expected Selection:**
- Should select all 3 products (since there are only 3)
- Diversity rule should ensure both regions are represented
- PROD-003 likely rank 1 (highest revenue)
- PROD-001 likely rank 2 (highest volume)
- PROD-002 likely rank 3

**Expected Recommendations:**
- All products have low CV (<0.2) and limited data (10 days)
- LLM should recommend `LINEAR_REGRESSION` or `RANDOM_FOREST`
- ARIMA unlikely due to insufficient data points (<30 days)
- XGBOOST possible for products with higher variability

## ✅ Success Criteria

- [ ] Endpoint returns 200 status
- [ ] `selectedProducts` array contains 3 products (all available products)
- [ ] Products are ranked by composite score
- [ ] Each product has: rank, productId, region, quantity, revenue, cv, trend, uniqueDays, score
- [ ] `recommendations` object has entry for each selected product
- [ ] Each recommendation has: model (valid ModelType) and reason (string)
- [ ] Diversity rule applied: both North and South regions represented
- [ ] Session status updated to `PRODUCTS_SELECTED` in database
- [ ] `selectedProducts` and `llmRecommendations` stored in database

## 🔍 Verification Queries

### Check Session Status
```bash
# In psql or database client
SELECT id, status, "selectedProducts", "llmRecommendations" 
FROM "UploadSession" 
WHERE id = 'your-session-id';
```

### Verify Product Selection
```bash
curl -s "http://localhost:3000/api/sales/upload/$SESSION_ID/select-products" | jq '.selectedProducts | length'
# Should return: 3
```

### Verify Recommendations
```bash
curl -s "http://localhost:3000/api/sales/upload/$SESSION_ID/select-products" | jq '.recommendations | keys'
# Should return: ["PROD-001", "PROD-002", "PROD-003"]
```

## 🐛 Troubleshooting

### Issue: "Profile data not found"
**Solution**: Run analysis endpoint first:
```bash
curl -X POST "http://localhost:3000/api/sales/upload/$SESSION_ID/analyze"
```

### Issue: LLM recommendations are all defaults
**Cause**: Mistral API key missing or LLM call failed
**Solution**: Check `.env.local` for `MISTRAL_API_KEY`. Defaults are acceptable for testing.

### Issue: Only 1-2 products selected instead of 3
**Cause**: Diversity penalty too aggressive or scoring issue
**Solution**: Check `productStats` in analysis response to verify all products have scores

## 📝 Next Steps

**Step 3b**: Not needed - LLM recommendations already integrated in Step 3a

**Step 3c**: Product Selection UI
- Add `selection` wizard step to sales dashboard
- Display selected products table with rank, product, region, stats
- Show model recommendations with dropdowns for override
- Add "Add Product" and "Remove Product" buttons
- Wire up "Train Models" button to trigger training for selected products

## 🎯 Files Created/Modified

### Created:
- `src/app/api/sales/upload/[sessionId]/select-products/route.ts` - Product selection endpoint
- `prisma/migrations/20260512143036_add_selected_products_field/migration.sql` - Database migration
- `test-step-3a.sh` - Automated test script
- `STEP_3A_TEST.md` - This documentation

### Modified:
- `prisma/schema.prisma` - Added `selectedProducts` field and `PRODUCTS_SELECTED` status

## 🔗 Related Files

- `src/app/api/sales/upload/[sessionId]/analyze/route.ts` - Analysis endpoint (provides profile data)
- `src/modules/llm/llmService.ts` - LLM service (pattern reference)
- `STEP_2A_TEST.md` - Step 2 documentation
- `STEP_2C_TEST.md` - Step 2c UI documentation
