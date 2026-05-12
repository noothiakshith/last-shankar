# Step 2a Testing Guide

## ✅ What Was Built

### Schema Updates
- Added `profileData` JSON field to `UploadSession`
- Added `llmSummary` String field to `UploadSession`
- Added `llmRecommendations` JSON field to `UploadSession`
- Added `ANALYZING` and `ANALYZED` statuses to `UploadStatus` enum

### API Endpoints Created

#### 1. POST /api/sales/upload/:sessionId/analyze
Analyzes staged data and computes:
- Data quality metrics (missing values, duplicates, outliers)
- Per-product statistics (volume, revenue, trends, variability)
- Per-region statistics (volume, revenue, product count)
- Top products ranked by composite score
- Quality score (0-1)

#### 2. POST /api/sales/upload/:sessionId/llm-summary
Generates AI summary using Mistral:
- Takes profile data from analysis
- Sends to Mistral AI for natural language summary
- Falls back to template if LLM unavailable
- Returns 3-5 sentence professional summary

## 🧪 How to Test

### Step 1: Upload a CSV (if you haven't already)

```bash
curl -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv" \
  | jq '.sessionId'
```

Save the `sessionId` from the response (e.g., `cmp2pleyn0000wonyonnwf0r4`)

### Step 2: Run Data Analysis

Replace `SESSION_ID` with your actual session ID:

```bash
curl -X POST http://localhost:3000/api/sales/upload/SESSION_ID/analyze \
  | jq '.'
```

Expected response structure:
```json
{
  "sessionId": "cmp2...",
  "status": "ANALYZED",
  "dataQuality": {
    "totalRows": 30,
    "dateRange": {
      "from": "2023-01-02",
      "to": "2023-01-31"
    },
    "uniqueProducts": 3,
    "uniqueRegions": 2,
    "missingDates": 0,
    "missingQuantities": 0,
    "missingProducts": 0,
    "missingRegions": 0,
    "duplicates": 0,
    "outliers": 0,
    "qualityScore": 1.0
  },
  "productStats": [...],
  "regionStats": [...],
  "topProducts": [
    {
      "rank": 1,
      "productId": "PROD-001",
      "score": 0.45,
      "totalQuantity": 567,
      "totalRevenue": 13608
    }
  ]
}
```

### Step 3: Generate LLM Summary

```bash
curl -X POST http://localhost:3000/api/sales/upload/SESSION_ID/llm-summary \
  | jq '.'
```

Expected response:
```json
{
  "sessionId": "cmp2...",
  "summary": "This dataset contains 30 sales records spanning from 2023-01-02 to 2023-01-31 across 2 regions and 3 products. Data quality is excellent with a 100.0% quality score. The top products by operational impact are led by PROD-001 which shows strong performance. North leads in volume with 567 units sold. I recommend focusing forecasting efforts on the top 5 products as they represent the highest operational impact and revenue potential."
}
```

## 📊 What to Verify

### Analysis Endpoint
- ✅ `dataQuality` object has all metrics
- ✅ `qualityScore` is between 0 and 1
- ✅ `productStats` array contains product analysis
- ✅ `regionStats` array contains region breakdown
- ✅ `topProducts` array has top 10 ranked products
- ✅ Session status updated to `ANALYZED`

### LLM Summary Endpoint
- ✅ Returns a coherent summary (3-5 sentences)
- ✅ Mentions dataset size and date range
- ✅ Comments on data quality
- ✅ Identifies top products
- ✅ Provides recommendations
- ✅ Falls back to template if Mistral unavailable

## 🔍 Database Verification

Check the updated session:
```bash
npx prisma studio
```

Look at the `UploadSession` table:
1. `status` should be `ANALYZED`
2. `profileData` should contain the analysis JSON
3. `llmSummary` should contain the AI-generated text

## 🐛 Troubleshooting

**Error: "Session not found"**
- Verify the session ID is correct
- Check that the upload completed successfully

**Error: "Profile data not found"**
- Run the `/analyze` endpoint first
- Check that analysis completed without errors

**LLM returns template fallback**
- Check that `MISTRAL_API_KEY` is set in `.env`
- Verify the API key is valid
- Check server logs for Mistral API errors

**Analysis takes too long**
- Normal for large datasets (>10k rows)
- Consider adding a loading indicator in the UI
- Check server logs for performance issues

## 📈 Performance Notes

- Analysis endpoint: ~100-500ms for small datasets (<1000 rows)
- Analysis endpoint: ~1-3s for medium datasets (1000-10000 rows)
- LLM summary: ~2-5s (depends on Mistral API response time)
- Total time for both: ~3-8s

## 🚀 Next: Step 2b

Once both endpoints work:
- Step 2b will add the UI to display these results
- Show data quality report
- Display top products table
- Show region breakdown
- Display AI summary
- Add "Continue" button to proceed to product selection
