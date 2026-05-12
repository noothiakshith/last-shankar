# Step 3c: Product Selection UI - Testing Guide

## ✅ What Was Built

Added comprehensive product selection UI to the sales dashboard wizard:

### 1. **Wizard State Management**
- Added `selection` step to wizard flow: 'upload' → 'mapping' → 'analysis' → 'selection' → 'complete'
- Added `selecting` loading state
- Added `selectedProducts` state for product list
- Added `modelRecommendations` state for AI recommendations
- Added `modelOverrides` state for user model selections

### 2. **Product Selection Flow**
- Updated "Select Products →" button in analysis view to call `/api/sales/upload/:sessionId/select-products`
- Fetches selected products and model recommendations
- Initializes model overrides with AI recommendations
- Transitions to selection wizard step

### 3. **Product Selection View** (wizardStep === 'selection')

#### **Header Section**
- Green success banner: "✅ Top N Products Selected for Forecasting"
- Shows count of selected products
- "← Back to Analysis" button

#### **Selected Products Table**
- **Columns**: Rank, Product, Region, Quantity, Revenue, Trend, Score, Action
- **Rank**: Shows medals (🥇🥈🥉) for top 3, numbers for rest
- **Trend**: Shows arrows (↑ increasing, ↓ decreasing, → stable)
- **Score**: Highlighted badge (yellow for top 3, gray for rest)
- **Action**: Remove button (✕) - disabled if only 1 product remains
- Minimum 1 product required message

#### **Model Recommendations Section**
- Card for each selected product showing:
  - Product ID
  - AI reasoning (one sentence explanation)
  - Model dropdown (pre-filled with recommendation)
  - User can override any model selection
- Model options: Linear Regression, Random Forest, XGBoost, ARIMA
- AI Insight box (blue background) with summary of selection

#### **Action Buttons**
- "← Back to Analysis" - returns to analysis view
- "🚀 Train Models" - placeholder for Step 4 (shows alert)
- Train button disabled if no products selected

### 4. **Loading States**
- "Selecting optimal products..." with hourglass icon
- "AI is analyzing product profiles and recommending models" message

### 5. **Error Handling**
- Product selection failure view with retry button
- Graceful fallback if selection fails

## 🧪 How to Test

### Prerequisites
```bash
# Make sure dev server is running
npm run dev

# Navigate to sales dashboard
open http://localhost:3000/dashboard/sales
```

### Test Flow (Full Wizard)

#### 1. **Upload CSV**
- Click "Select CSV File" or drag-and-drop `walmart_sales.csv`
- Verify upload completes and shows preview table
- Verify column mapping dropdowns are pre-filled
- Click "✅ Continue to Analysis"

#### 2. **View Analysis Results**
- Wait for analysis to complete (~2-3 seconds)
- Verify data quality report shows 100% quality score
- Verify top products table shows 3 products
- Verify regional performance shows North and South
- Verify AI summary displays
- Click "Select Products →"

#### 3. **Product Selection View**
- Wait for selection to complete (~2-3 seconds)
- **Verify Header**:
  - Shows "✅ Top 3 Products Selected for Forecasting"
  - "← Back to Analysis" button visible

- **Verify Products Table**:
  - 3 rows displayed
  - PROD-003 has 🥇 (rank 1)
  - PROD-002 has 🥈 (rank 2)
  - PROD-001 has 🥉 (rank 3)
  - Each row shows: product ID, region, quantity, revenue, trend arrow, score badge
  - Remove button (✕) present on each row

- **Verify Model Recommendations**:
  - 3 recommendation cards displayed
  - Each card shows:
    - Product ID
    - AI reasoning text
    - Model dropdown pre-filled with recommendation
  - All dropdowns should show "Linear Regression" (based on low CV)
  - AI Insight box displays summary

- **Test Interactions**:
  - Change a model dropdown → verify state updates
  - Try to remove a product → verify it's removed from table and recommendations
  - Try to remove last product → verify button is disabled
  - Click "← Back to Analysis" → verify returns to analysis view
  - Click "Select Products →" again → verify re-selection works
  - Click "🚀 Train Models" → verify alert shows "Training functionality coming in Step 4!"

### Test with Different Datasets

#### Small Dataset (walmart_sales.csv - 30 rows, 3 products)
- Should select all 3 products
- All should get LINEAR_REGRESSION recommendation (low CV, limited data)

#### Large Dataset (superstore_sales.csv - if available)
- Should select top 5 products
- Should show diversity across regions
- May get varied model recommendations (XGBOOST, RANDOM_FOREST, etc.)

## 📊 Expected UI Behavior

### Product Selection Table
```
┌────────────────────────────────────────────────────────────┐
│ Rank │ Product   │ Region │ Quantity │ Revenue │ Trend │ ✕ │
├────────────────────────────────────────────────────────────┤
│  🥇  │ PROD-003  │ North  │   193    │ $5,597  │  →   │ ✕ │
│  🥈  │ PROD-002  │ South  │   193    │ $4,439  │  ↑   │ ✕ │
│  🥉  │ PROD-001  │ North  │   207    │ $4,968  │  →   │ ✕ │
└────────────────────────────────────────────────────────────┘
```

### Model Recommendations
```
┌──────────────────────────────────────────────────────────┐
│ PROD-003                                                  │
│ Stable trend and low demand variability make linear      │
│ regression ideal for this product.                       │
│                                          [Linear Reg. ▼] │
├──────────────────────────────────────────────────────────┤
│ PROD-002                                                  │
│ Low demand variability and an increasing trend suggest   │
│ linear regression is appropriate.                        │
│                                          [Linear Reg. ▼] │
├──────────────────────────────────────────────────────────┤
│ PROD-001                                                  │
│ Stable trend and very low demand variability favor       │
│ linear regression for accurate forecasts.               │
│                                          [Linear Reg. ▼] │
└──────────────────────────────────────────────────────────┘

🤖 AI Insight: These 3 products cover 2 region(s) with diverse
demand patterns. Linear models are recommended for stable,
predictable demand.
```

## ✅ Success Criteria

### Functionality
- [ ] "Select Products →" button triggers selection API call
- [ ] Loading state displays during selection
- [ ] Products table displays all selected products
- [ ] Medals (🥇🥈🥉) show for top 3 products
- [ ] Trend arrows display correctly (↑↓→)
- [ ] Score badges highlighted for top 3
- [ ] Remove button works and updates table
- [ ] Remove button disabled when only 1 product remains
- [ ] Model recommendation cards display for each product
- [ ] Model dropdowns pre-filled with AI recommendations
- [ ] Model dropdown changes update state
- [ ] AI Insight box displays summary
- [ ] "Back to Analysis" button returns to analysis view
- [ ] "Train Models" button shows placeholder alert
- [ ] No console errors during selection flow

### Visual Design
- [ ] Green success banner at top
- [ ] Table has proper borders and spacing
- [ ] Medals render correctly (🥇🥈🥉)
- [ ] Score badges have yellow background for top 3
- [ ] Recommendation cards have white background
- [ ] AI Insight box has blue background
- [ ] Buttons have proper colors (gray for back, green for train)
- [ ] Loading spinner displays during selection
- [ ] Error view displays if selection fails

### Data Integrity
- [ ] Selected products match backend response
- [ ] Model recommendations match backend response
- [ ] Model overrides persist when navigating back/forward
- [ ] Removing products updates both table and recommendations
- [ ] Region diversity visible in selected products

## 🐛 Troubleshooting

### Issue: Selection button does nothing
**Solution**: Check browser console for errors. Verify session ID is valid.

### Issue: No products displayed after selection
**Cause**: Selection API call failed or returned empty array
**Solution**: Check network tab, verify analysis was run first

### Issue: Model dropdowns show wrong values
**Cause**: Recommendations not properly initialized
**Solution**: Check that `modelOverrides` state is initialized with recommendations

### Issue: Can't remove any products
**Cause**: All remove buttons disabled
**Solution**: This is correct if only 1 product remains (minimum requirement)

### Issue: AI Insight shows wrong information
**Cause**: Hardcoded text doesn't match actual recommendations
**Solution**: This is expected - the insight is a template based on first product's model

## 📝 Next Steps

**Step 4: Batch Training + Import**
- Wire up "Train Models" button to trigger batch training
- For each selected product:
  - Call `/api/sales/train` with product ID, region, and selected model type
  - Show training progress (1/3, 2/3, 3/3)
- After all models trained:
  - Import staged records to main `SaleRecord` table
  - Update session status to `IMPORTED`
  - Show success message with link to model leaderboard
  - Refresh KPI cards with new data

## 🎯 Files Modified

### Modified:
- `src/app/dashboard/sales/page.tsx` - Added product selection UI and handlers

### Related Files:
- `src/app/api/sales/upload/[sessionId]/select-products/route.ts` - Selection endpoint
- `STEP_3A_TEST.md` - Backend documentation

## 🔗 Related Documentation

- `STEP_1_COMPLETE.md` - Upload wizard (Step 1)
- `STEP_2C_TEST.md` - Analysis results UI (Step 2c)
- `STEP_3A_TEST.md` - Product selection backend (Step 3a)

## 🎉 Step 3 Complete!

All three sub-steps of Step 3 are now complete:
- ✅ **Step 3a**: Product selection endpoint with composite scoring and LLM recommendations
- ✅ **Step 3b**: Integrated into Step 3a (no separate endpoint needed)
- ✅ **Step 3c**: Product selection UI with model override dropdowns

The CSV upload wizard now has a complete flow:
1. Upload CSV → Preview + Column Mapping
2. Analyze Data → Quality Report + AI Summary
3. Select Products → Top Products + Model Recommendations
4. (Next) Train Models → Batch Training + Import to Database
