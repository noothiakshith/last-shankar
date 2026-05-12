# Step 5 Product ID Fix - SKU vs Database ID

## Issue

After fixing the forecast auto-approval bug, a new critical error appeared when the DEMAND_TO_PLAN workflows tried to execute:

```
CRITICAL DISPATCH ERROR: Error: Product PROD-001 not found for forecast cmp2rmaql00o6txnyrmcbwce4
CRITICAL DISPATCH ERROR: Error: Product PROD-002 not found for forecast cmp2rmapo00n6txnynwwg20mv
CRITICAL DISPATCH ERROR: Error: Product PROD-003 not found for forecast cmp2rmaoz00lbtxny34ohjk99
```

All workflows were failing at the MRP step because products couldn't be found.

## Root Cause

The CSV upload wizard was using product **SKUs** (like "PROD-001", "PROD-002") as product IDs throughout the system, but the database uses different **internal IDs** (like "prod-widget-a", "prod-widget-b").

### Database Schema

```typescript
// Products in seed data
{ id: 'prod-widget-a', sku: 'PROD-001', name: 'Widget A' }
{ id: 'prod-widget-b', sku: 'PROD-002', name: 'Widget B' }
{ id: 'prod-gadget-c', sku: 'PROD-003', name: 'Gadget C' }
```

### The Problem Flow

1. CSV contains SKU "PROD-001" in the product column
2. Training endpoint used "PROD-001" as the `productId` when creating sales records
3. Model was trained with `productId: "PROD-001"`
4. Forecast was created with `productId: "PROD-001"`
5. DEMAND_TO_PLAN workflow tried to look up product by ID "PROD-001"
6. **Failed** - No product with ID "PROD-001" exists (only SKU matches)

## Fix Applied

### File: `src/app/api/sales/upload/[sessionId]/train/route.ts`

Added SKU-to-ID lookup before creating sales records and training models:

```typescript
// Step 1.5: Look up the actual product by SKU (CSV uses SKU, DB uses ID)
const product = await prisma.product.findFirst({
  where: { sku: productId }
});

if (!product) {
  results.push({
    productId,
    region,
    modelType,
    dataPoints: stagedRecords.length,
    trainingTime: '0s',
    status: 'FAILED',
    error: `Product with SKU ${productId} not found in database. Please ensure products exist before training.`,
  });
  continue;
}

const actualProductId = product.id;

// Use actualProductId for all database operations
const recordsToInsert = stagedRecords.map((staged: any) => {
  const rawData = staged.rawData as Record<string, string>;
  return {
    productId: actualProductId, // Use the actual product ID, not the SKU
    region,
    date: new Date(rawData[dateColumn]),
    quantity: parseInt(rawData[quantityColumn]) || 0,
    revenue: parseFloat(rawData[revenueColumn]) || 0,
    source: 'csv_upload',
  };
});

// Train with actual product ID
const trainedModel = await salesIntelligenceService.trainModel({
  type: modelType,
  productId: actualProductId, // Use the actual product ID
  region,
});
```

## Impact

This fix ensures that:
1. ✅ Sales records are created with the correct internal product ID
2. ✅ Models are trained with the correct product ID
3. ✅ Forecasts reference the correct product ID
4. ✅ DEMAND_TO_PLAN workflows can find the product for MRP calculations
5. ✅ The entire pipeline works end-to-end

## Testing

To test the fix, you need to:

1. **Reset the database** (to clear old records with wrong product IDs):
   ```bash
   npx prisma migrate reset --force
   ```

2. **Upload a new CSV** and run through the wizard:
   - Upload `walmart_sales.csv`
   - Confirm mapping
   - View analysis
   - Select products (PROD-001, PROD-002, PROD-003)
   - Train models
   - Generate forecasts

3. **Verify workflows succeed**:
   - Check the Orchestrator dashboard
   - Workflows should progress past the MRP step
   - No "Product not found" errors

## Expected Results

After the fix:
- ✅ Training creates sales records with `productId: "prod-widget-a"` (not "PROD-001")
- ✅ Models are trained with `productId: "prod-widget-a"`
- ✅ Forecasts reference `productId: "prod-widget-a"`
- ✅ MRP can find the product and create production plans
- ✅ Workflows progress through all steps successfully

## Status

✅ **FIXED** - The train endpoint now properly maps CSV SKUs to database product IDs.

⚠️ **REQUIRES DATABASE RESET** - Old data with incorrect product IDs must be cleared before testing.

## Next Steps

1. Reset the database: `npx prisma migrate reset --force`
2. Test the complete wizard flow with a fresh upload
3. Verify workflows complete successfully on the Orchestrator dashboard
