import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ColumnMapping {
  dateColumn: string | null;
  quantityColumn: string | null;
  revenueColumn: string | null;
  productColumn: string | null;
  regionColumn: string | null;
  categoryColumn: string | null;
}

function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    dateColumn: null,
    quantityColumn: null,
    revenueColumn: null,
    productColumn: null,
    regionColumn: null,
    categoryColumn: null,
  };

  // Keywords for each column type (case-insensitive)
  const dateKeywords = ['date', 'time', 'day', 'month', 'year', 'period', 'timestamp'];
  const quantityKeywords = ['quantity', 'qty', 'units', 'count', 'volume', 'amount', 'sold'];
  const revenueKeywords = ['revenue', 'sales', 'price', 'total', 'amount', 'value', 'income'];
  const productKeywords = ['product', 'item', 'sku', 'productid', 'product_id', 'itemid', 'item_id', 'productname', 'product_name'];
  const regionKeywords = ['region', 'location', 'area', 'territory', 'zone', 'market', 'geography', 'geo'];
  const categoryKeywords = ['category', 'type', 'class', 'segment', 'group', 'department'];

  for (const header of headers) {
    const lowerHeader = header.toLowerCase().replace(/[_\s-]/g, '');

    // Date column
    if (!mapping.dateColumn && dateKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.dateColumn = header;
    }

    // Quantity column (but not if it contains revenue keywords)
    if (!mapping.quantityColumn && 
        quantityKeywords.some(kw => lowerHeader.includes(kw)) &&
        !revenueKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.quantityColumn = header;
    }

    // Revenue column
    if (!mapping.revenueColumn && revenueKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.revenueColumn = header;
    }

    // Product column
    if (!mapping.productColumn && productKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.productColumn = header;
    }

    // Region column
    if (!mapping.regionColumn && regionKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.regionColumn = header;
    }

    // Category column
    if (!mapping.categoryColumn && categoryKeywords.some(kw => lowerHeader.includes(kw))) {
      mapping.categoryColumn = header;
    }
  }

  return mapping;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 });
    }

    // Read file content
    const text = await file.text();
    const lines = text.trim().split('\n');

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 });
    }

    // Parse CSV
    const headers = lines[0].split(',').map(h => h.trim());
    const dataRows = lines.slice(1);

    // Parse rows into objects
    const parsedRows = dataRows.map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return { rowIndex: index, data: row };
    });

    // Create upload session
    const uploadSession = await prisma.uploadSession.create({
      data: {
        fileName: file.name,
        totalRows: parsedRows.length,
        uploadedBy: 'system', // No auth required
        status: 'STAGED',
      },
    });

    // Store staged records
    await prisma.stagedSaleRecord.createMany({
      data: parsedRows.map(row => ({
        sessionId: uploadSession.id,
        rowIndex: row.rowIndex,
        rawData: row.data,
      })),
    });

    // Auto-detect column mapping
    const detectedMapping = detectColumnMapping(headers);

    // Get preview (first 10 rows)
    const preview = parsedRows.slice(0, 10).map(r => r.data);

    return NextResponse.json({
      sessionId: uploadSession.id,
      fileName: file.name,
      totalRows: parsedRows.length,
      columns: headers,
      detectedMapping,
      preview,
    });
  } catch (error) {
    console.error('Upload error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { 
        error: 'Failed to process upload',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
