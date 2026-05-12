# Step 1a Testing Guide

## ✅ What Was Built

1. **Schema Models Added:**
   - `UploadSession` - Tracks each CSV upload session
   - `StagedSaleRecord` - Stores raw CSV rows before import
   - `UploadStatus` enum - Tracks upload lifecycle

2. **Migration Applied:**
   - Migration: `20260512140721_add_upload_session_models`
   - Tables created in database
   - Prisma client regenerated

3. **API Endpoint Created:**
   - `POST /api/sales/upload`
   - Accepts CSV file via multipart form data
   - Parses CSV and stores in staging tables
   - Returns preview of first 10 rows

## 🧪 How to Test

### Option 1: Using the Test Script (Recommended)

```bash
npm run dev
# In another terminal:
./test-upload.sh
```

### Option 2: Manual curl Command

First, make sure your dev server is running:
```bash
npm run dev
```

Then in another terminal, run this command:

```bash
# Get session cookie (login)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@nexiserp.com","password":"password"}'

# Upload CSV file
curl -b cookies.txt -X POST http://localhost:3000/api/sales/upload \
  -F "file=@prisma/data/walmart_sales.csv"
```

### Option 3: Using Postman/Insomnia

1. Login first to get session cookie
2. POST to `http://localhost:3000/api/sales/upload`
3. Body type: `form-data`
4. Add field: `file` (type: File)
5. Select: `prisma/data/walmart_sales.csv`

## ✅ Expected Response

```json
{
  "sessionId": "clxxx...",
  "fileName": "walmart_sales.csv",
  "totalRows": 9,
  "columns": ["date", "productId", "region", "quantity", "revenue"],
  "preview": [
    {
      "date": "2023-01-02",
      "productId": "PROD-001",
      "region": "North",
      "quantity": "20",
      "revenue": "480.00"
    },
    {
      "date": "2023-01-02",
      "productId": "PROD-002",
      "region": "South",
      "quantity": "15",
      "revenue": "345.00"
    }
    // ... up to 10 rows
  ]
}
```

## 🔍 Verify in Database

After successful upload, check the database:

```bash
npx prisma studio
```

Look for:
1. **UploadSession** table - Should have 1 new row with your upload
2. **StagedSaleRecord** table - Should have 9 rows (one per CSV data row)

## 📊 What to Verify

- ✅ Session is created with correct fileName and totalRows
- ✅ All CSV rows are stored in StagedSaleRecord
- ✅ Preview shows first 10 rows correctly
- ✅ Columns array matches CSV headers
- ✅ Raw data is stored as JSON in rawData field

## 🚀 Next Steps

Once this test passes:
- **Step 1b**: Add column auto-detection logic
- **Step 1c**: Build the frontend upload UI

## 🐛 Troubleshooting

**Error: "Unauthorized"**
- Make sure you're logged in first (use the login curl command)
- Check that cookies.txt was created

**Error: "No file provided"**
- Verify the file path is correct: `prisma/data/walmart_sales.csv`
- Make sure you're using `-F` flag (not `-d`)

**Error: "CSV file is empty"**
- Check that the CSV file has data rows (not just headers)

**Database connection error**
- Make sure PostgreSQL is running
- Check your `.env` file has correct DATABASE_URL
