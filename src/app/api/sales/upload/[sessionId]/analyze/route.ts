import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

interface ProductStats {
  productId: string;
  totalQuantity: number;
  totalRevenue: number;
  uniqueDays: number;
  avgDailyQty: number;
  stdDailyQty: number;
  cv: number;
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  firstSale: string;
  lastSale: string;
  compositeScore: number;
}

interface RegionStats {
  region: string;
  totalQuantity: number;
  totalRevenue: number;
  uniqueProducts: number;
  uniqueDays: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Get the upload session
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      include: { stagedRecords: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Update status to ANALYZING
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: { status: 'ANALYZING' },
    });

    // Parse staged records
    const records = session.stagedRecords.map(r => r.rawData as Record<string, string>);

    // Get column mapping from session (or use defaults)
    const mapping = session.columnMapping as any || {};
    const dateCol = mapping.date || 'date';
    const qtyCol = mapping.quantity || 'quantity';
    const revCol = mapping.revenue || 'revenue';
    const prodCol = mapping.product || 'productId';
    const regionCol = mapping.region || 'region';

    // Data quality metrics
    let missingDates = 0;
    let missingQuantities = 0;
    let missingProducts = 0;
    let missingRegions = 0;
    const dates: Date[] = [];
    const products = new Set<string>();
    const regions = new Set<string>();
    const duplicateKeys = new Set<string>();
    const duplicates: string[] = [];

    // Parse all records
    const parsedRecords = records.map((row, idx) => {
      const date = row[dateCol];
      const qty = parseFloat(row[qtyCol] || '0');
      const rev = parseFloat(row[revCol] || '0');
      const prod = row[prodCol];
      const region = row[regionCol];

      if (!date || date.trim() === '') missingDates++;
      if (!qty || qty === 0) missingQuantities++;
      if (!prod || prod.trim() === '') missingProducts++;
      if (!region || region.trim() === '') missingRegions++;

      if (date) dates.push(new Date(date));
      if (prod) products.add(prod);
      if (region) regions.add(region);

      // Check for duplicates
      const key = `${date}-${prod}-${region}`;
      if (duplicateKeys.has(key)) {
        duplicates.push(key);
      }
      duplicateKeys.add(key);

      return { date, qty, rev, prod, region, idx };
    });

    // Calculate date range
    const validDates = dates.filter(d => !isNaN(d.getTime()));
    const minDate = validDates.length > 0 ? new Date(Math.min(...validDates.map(d => d.getTime()))) : null;
    const maxDate = validDates.length > 0 ? new Date(Math.max(...validDates.map(d => d.getTime()))) : null;

    // Calculate outliers (quantities beyond 3 standard deviations)
    const quantities = parsedRecords.map(r => r.qty).filter(q => q > 0);
    const meanQty = quantities.reduce((a, b) => a + b, 0) / quantities.length;
    const stdQty = Math.sqrt(
      quantities.reduce((sum, q) => sum + Math.pow(q - meanQty, 2), 0) / quantities.length
    );
    const outliers = parsedRecords.filter(r => Math.abs(r.qty - meanQty) > 3 * stdQty);

    // Product statistics
    const productMap = new Map<string, { dates: string[], quantities: number[], revenues: number[] }>();
    parsedRecords.forEach(r => {
      if (!r.prod) return;
      if (!productMap.has(r.prod)) {
        productMap.set(r.prod, { dates: [], quantities: [], revenues: [] });
      }
      const p = productMap.get(r.prod)!;
      if (r.date) p.dates.push(r.date);
      p.quantities.push(r.qty);
      p.revenues.push(r.rev);
    });

    const productStats: ProductStats[] = Array.from(productMap.entries()).map(([productId, data]) => {
      const totalQuantity = data.quantities.reduce((a, b) => a + b, 0);
      const totalRevenue = data.revenues.reduce((a, b) => a + b, 0);
      const uniqueDays = new Set(data.dates).size;
      const avgDailyQty = totalQuantity / (uniqueDays || 1);
      
      const mean = data.quantities.reduce((a, b) => a + b, 0) / data.quantities.length;
      const variance = data.quantities.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / data.quantities.length;
      const stdDailyQty = Math.sqrt(variance);
      const cv = mean > 0 ? stdDailyQty / mean : 0;

      // Trend: compare first half vs second half
      const mid = Math.floor(data.quantities.length / 2);
      const firstHalf = data.quantities.slice(0, mid);
      const secondHalf = data.quantities.slice(mid);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const trendRatio = firstAvg > 0 ? secondAvg / firstAvg : 1;
      const trend = trendRatio > 1.1 ? 'INCREASING' : trendRatio < 0.9 ? 'DECREASING' : 'STABLE';

      const sortedDates = data.dates.sort();
      const firstSale = sortedDates[0] || '';
      const lastSale = sortedDates[sortedDates.length - 1] || '';

      // Composite score: volume + revenue + variability + data sufficiency
      const volumeScore = Math.min(totalQuantity / 10000, 1); // Normalize to 0-1
      const revenueScore = Math.min(totalRevenue / 100000, 1);
      const variabilityScore = Math.min(cv, 1); // Higher variability = more important to forecast
      const sufficiencyScore = Math.min(uniqueDays / 365, 1); // More days = better
      const compositeScore = 0.3 * volumeScore + 0.3 * revenueScore + 0.25 * variabilityScore + 0.15 * sufficiencyScore;

      return {
        productId,
        totalQuantity,
        totalRevenue,
        uniqueDays,
        avgDailyQty,
        stdDailyQty,
        cv,
        trend,
        firstSale,
        lastSale,
        compositeScore,
      };
    });

    // Sort by composite score
    productStats.sort((a, b) => b.compositeScore - a.compositeScore);

    // Region statistics
    const regionMap = new Map<string, { quantities: number[], revenues: number[], products: Set<string>, dates: Set<string> }>();
    parsedRecords.forEach(r => {
      if (!r.region) return;
      if (!regionMap.has(r.region)) {
        regionMap.set(r.region, { quantities: [], revenues: [], products: new Set(), dates: new Set() });
      }
      const reg = regionMap.get(r.region)!;
      reg.quantities.push(r.qty);
      reg.revenues.push(r.rev);
      if (r.prod) reg.products.add(r.prod);
      if (r.date) reg.dates.add(r.date);
    });

    const regionStats: RegionStats[] = Array.from(regionMap.entries()).map(([region, data]) => ({
      region,
      totalQuantity: data.quantities.reduce((a, b) => a + b, 0),
      totalRevenue: data.revenues.reduce((a, b) => a + b, 0),
      uniqueProducts: data.products.size,
      uniqueDays: data.dates.size,
    }));

    // Sort by total quantity
    regionStats.sort((a, b) => b.totalQuantity - a.totalQuantity);

    // Quality score (0-1)
    const qualityScore = 1 - (
      (missingDates / records.length) * 0.3 +
      (missingQuantities / records.length) * 0.3 +
      (missingProducts / records.length) * 0.2 +
      (duplicates.length / records.length) * 0.1 +
      (outliers.length / records.length) * 0.1
    );

    const profileData = {
      dataQuality: {
        totalRows: records.length,
        dateRange: {
          from: minDate?.toISOString().split('T')[0] || null,
          to: maxDate?.toISOString().split('T')[0] || null,
        },
        uniqueProducts: products.size,
        uniqueRegions: regions.size,
        missingDates,
        missingQuantities,
        missingProducts,
        missingRegions,
        duplicates: duplicates.length,
        outliers: outliers.length,
        qualityScore: Math.round(qualityScore * 100) / 100,
      },
      productStats: productStats.slice(0, 50), // Top 50 products
      regionStats,
      topProducts: productStats.slice(0, 10).map((p, idx) => ({
        rank: idx + 1,
        productId: p.productId,
        score: Math.round(p.compositeScore * 100) / 100,
        totalQuantity: p.totalQuantity,
        totalRevenue: p.totalRevenue,
      })),
    };

    // Update session with profile data
    await prisma.uploadSession.update({
      where: { id: sessionId },
      data: {
        status: 'ANALYZED',
        profileData,
      },
    });

    return NextResponse.json({
      sessionId,
      status: 'ANALYZED',
      ...profileData,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze data',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
