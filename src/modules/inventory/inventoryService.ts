import prisma from '@/lib/prisma';

export interface StockLevel {
  materialId: string;
  onHand: number;
  safetyStock: number;
  reorderPoint: number;
}

export interface ShortageReport {
  planId: string;
  shortages: Array<{
    materialId: string;
    materialName: string;
    required: number;
    onHand: number;
    deficit: number;
  }>;
}

export interface SafetyStockAlert {
  materialId: string;
  materialName: string;
  onHand: number;
  safetyStock: number;
  deficit: number;
}

export class InventoryService {
  /**
   * Update stock by appending a StockLedger entry.
   * Never overwrites on-hand directly - maintains append-only ledger.
   * 
   * Requirements: 8.1, 8.2
   */
  async updateStock(itemId: string, delta: number, reason: string, reference?: string): Promise<StockLevel> {
    // Verify material exists
    const material = await prisma.material.findUnique({
      where: { id: itemId }
    });

    if (!material) {
      throw new Error(`Material ${itemId} not found`);
    }

    // Append StockLedger entry
    await prisma.stockLedger.create({
      data: {
        materialId: itemId,
        delta,
        reason,
        reference,
      }
    });

    // Return current stock level (derived from ledger)
    return this.getStockLevel(itemId);
  }

  /**
   * Get current stock level by deriving on-hand as SUM(delta) from StockLedger.
   * 
   * Requirements: 8.1, 8.2
   */
  async getStockLevel(itemId: string): Promise<StockLevel> {
    const material = await prisma.material.findUnique({
      where: { id: itemId },
      include: {
        stockLedger: true
      }
    });

    if (!material) {
      throw new Error(`Material ${itemId} not found`);
    }

    // Derive on-hand as sum of all ledger deltas
    const onHand = material.stockLedger.reduce((sum, entry) => sum + entry.delta, 0);

    return {
      materialId: material.id,
      onHand,
      safetyStock: material.safetyStock,
      reorderPoint: material.reorderPoint,
    };
  }

  /**
   * Detect shortages by comparing MRP requirements against on-hand quantities.
   * Returns all materials with insufficient stock.
   * 
   * Requirements: 8.3
   */
  async detectShortages(planId: string): Promise<ShortageReport> {
    // Get the production plan
    const plan = await prisma.productionPlan.findUnique({
      where: { id: planId },
      include: {
        orders: true
      }
    });

    if (!plan) {
      throw new Error(`Production plan ${planId} not found`);
    }

    // Calculate material requirements from all orders in the plan
    const materialRequirements = new Map<string, number>();

    for (const order of plan.orders) {
      // Get BOM for this product
      const bomItems = await prisma.bOMItem.findMany({
        where: { productId: order.productId },
        include: { material: true }
      });

      // Accumulate material requirements
      for (const bomItem of bomItems) {
        const required = bomItem.quantity * order.requiredQty;
        const current = materialRequirements.get(bomItem.materialId) || 0;
        materialRequirements.set(bomItem.materialId, current + required);
      }
    }

    // Compare requirements against on-hand
    const shortages: ShortageReport['shortages'] = [];

    for (const [materialId, required] of materialRequirements.entries()) {
      const stockLevel = await this.getStockLevel(materialId);
      
      if (stockLevel.onHand < required) {
        const material = await prisma.material.findUnique({
          where: { id: materialId }
        });

        shortages.push({
          materialId,
          materialName: material?.name || 'Unknown',
          required,
          onHand: stockLevel.onHand,
          deficit: required - stockLevel.onHand,
        });
      }
    }

    return {
      planId,
      shortages,
    };
  }

  /**
   * Get all materials where on-hand is below safety stock threshold.
   * 
   * Requirements: 8.4
   */
  async getSafetyStockAlerts(): Promise<SafetyStockAlert[]> {
    const materials = await prisma.material.findMany({
      include: {
        stockLedger: true
      }
    });

    const alerts: SafetyStockAlert[] = [];

    for (const material of materials) {
      // Derive on-hand from ledger
      const onHand = material.stockLedger.reduce((sum, entry) => sum + entry.delta, 0);

      if (onHand < material.safetyStock) {
        alerts.push({
          materialId: material.id,
          materialName: material.name,
          onHand,
          safetyStock: material.safetyStock,
          deficit: material.safetyStock - onHand,
        });
      }
    }

    return alerts;
  }

  /**
   * Record finished goods quantity after production completion.
   * 
   * Requirements: 8.5
   */
  async recordFinishedGoods(productId: string, quantity: number): Promise<void> {
    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { bomItems: true }
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Deduct consumed raw materials
    for (const bomItem of product.bomItems) {
      const consumedQty = bomItem.quantity * quantity;
      await this.updateStock(
        bomItem.materialId,
        -consumedQty,
        'PRODUCTION_CONSUMPTION',
        productId
      );
    }

    // Upsert FinishedGood record
    const existing = await prisma.finishedGood.findFirst({
      where: { productId }
    });

    if (existing) {
      await prisma.finishedGood.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity }
      });
    } else {
      await prisma.finishedGood.create({
        data: { productId, quantity }
      });
    }
  }
}

export const inventoryService = new InventoryService();
