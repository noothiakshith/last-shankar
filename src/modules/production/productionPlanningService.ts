import prisma from '@/lib/prisma';
import { ProductionPlanStatus, OrderStatus, ForecastStatus } from '@prisma/client';
import { inventoryService } from '@/modules/inventory/inventoryService';

export interface MaterialRequirement {
  materialId: string;
  materialSku: string;
  materialName: string;
  requiredQuantity: number;
  unit: string;
}

export interface ReadinessReport {
  planId: string;
  isReady: boolean;
  materials: Array<{
    materialId: string;
    materialSku: string;
    materialName: string;
    required: number;
    available: number;
    shortage: number;
    unit: string;
  }>;
}

export class ProductionPlanningService {
  /**
   * Run MRP (Material Requirements Planning) from an approved forecast.
   * Explodes BOM for each forecasted product to derive raw material requirements.
   * 
   * Requirements: 7.1, 7.2, 7.3
   */
  async runMRP(forecastId: string) {
    // Load approved ForecastResult
    const forecast = await prisma.forecastResult.findUnique({
      where: { id: forecastId }
    });

    if (!forecast) {
      throw new Error(`Forecast ${forecastId} not found`);
    }

    if (forecast.status !== ForecastStatus.APPROVED) {
      throw new Error(`Forecast ${forecastId} is not approved`);
    }

    const predictions = forecast.predictions;
    
    // Load the specific product associated with this forecast
    const product = await prisma.product.findUnique({
      where: { id: forecast.productId },
      include: {
        bomItems: {
          include: {
            material: true
          }
        }
      }
    });
 
    if (!product) {
      throw new Error(`Product ${forecast.productId} not found for forecast ${forecastId}`);
    }
 
    // Create ProductionPlan
    const plan = await prisma.productionPlan.create({
      data: {
        forecastId,
        status: ProductionPlanStatus.DRAFT
      }
    });
 
    // Calculate total requirement from predictions
    const forecastQuantity = Array.isArray(predictions) 
      ? (predictions as Array<number | { quantity: number }>).reduce((sum: number, val) => {
          if (typeof val === 'number') return sum + val;
          return sum + (val.quantity || 0);
        }, 0)
      : 0;
 
    if (forecastQuantity > 0) {
      // Create ProductionOrder for the specific product
      await prisma.productionOrder.create({
        data: {
          planId: plan.id,
          productId: product.id,
          requiredQty: forecastQuantity,
          status: OrderStatus.PENDING
        }
      });
    } else {
      throw new Error(`Invalid forecast quantity (${forecastQuantity}) for forecast ${forecastId}`);
    }
 
    return plan;
  }

  /**
   * Get BOM (Bill of Materials) for a product.
   * Returns the list of materials and quantities required to produce one unit.
   */
  async getBOM(productId: string) {
    const bomItems = await prisma.bOMItem.findMany({
      where: { productId },
      include: {
        material: true,
        product: true
      }
    });

    return bomItems;
  }

  /**
   * Check production readiness by comparing material requirements against inventory.
   * Returns a report indicating whether all required materials are available.
   * 
   * Requirements: 7.4, 7.5
   */
  async checkProductionReadiness(planId: string): Promise<ReadinessReport> {
    // Get production plan with orders
    const plan = await prisma.productionPlan.findUnique({
      where: { id: planId },
      include: {
        orders: {
          include: {
            plan: true
          }
        }
      }
    });

    if (!plan) {
      throw new Error(`Production plan ${planId} not found`);
    }

    // Calculate total material requirements across all orders
    const materialRequirements = new Map<string, MaterialRequirement>();

    for (const order of plan.orders) {
      // Get BOM for this product
      const bomItems = await prisma.bOMItem.findMany({
        where: { productId: order.productId },
        include: {
          material: true
        }
      });

      // Multiply forecast quantity × BOM quantity per unit
      for (const bomItem of bomItems) {
        const required = order.requiredQty * bomItem.quantity;
        
        if (materialRequirements.has(bomItem.materialId)) {
          const existing = materialRequirements.get(bomItem.materialId)!;
          existing.requiredQuantity += required;
        } else {
          materialRequirements.set(bomItem.materialId, {
            materialId: bomItem.materialId,
            materialSku: bomItem.material.sku,
            materialName: bomItem.material.name,
            requiredQuantity: required,
            unit: bomItem.unit
          });
        }
      }
    }

    // Check inventory availability for each material
    const materials = [];
    let isReady = true;

    for (const req of materialRequirements.values()) {
      const stockLevel = await inventoryService.getStockLevel(req.materialId);

      const shortage = Math.max(0, req.requiredQuantity - stockLevel.onHand);
      
      if (shortage > 0) {
        isReady = false;
      }

      materials.push({
        materialId: req.materialId,
        materialSku: req.materialSku,
        materialName: req.materialName,
        required: req.requiredQuantity,
        available: stockLevel.onHand,
        shortage,
        unit: req.unit
      });
    }

    return {
      planId,
      isReady,
      materials
    };
  }

  /**
   * Authorize a production plan.
   * Sets status to AUTHORIZED and records who authorized it.
   * 
   * Requirements: 7.4, 7.5
   */
  async authorizePlan(planId: string, authorizedBy: string) {
    const plan = await prisma.productionPlan.findUnique({
      where: { id: planId }
    });

    if (!plan) {
      throw new Error(`Production plan ${planId} not found`);
    }

    if (plan.status !== ProductionPlanStatus.DRAFT && plan.status !== ProductionPlanStatus.PENDING_AUTHORIZATION) {
      throw new Error(`Production plan ${planId} is not in DRAFT or PENDING_AUTHORIZATION status. Current status: ${plan.status}`);
    }

    return prisma.productionPlan.update({
      where: { id: planId },
      data: {
        status: ProductionPlanStatus.AUTHORIZED,
        authorizedBy
      }
    });
  }
}

export const productionPlanningService = new ProductionPlanningService();
