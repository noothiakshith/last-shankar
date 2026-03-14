/* eslint-disable */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { productionPlanningService } from './productionPlanningService';
import prisma from '@/lib/prisma';
import { ProductionPlanStatus, OrderStatus, ForecastStatus } from '@prisma/client';

vi.mock('@/lib/prisma', () => ({
  default: {
    forecastResult: {
      findUnique: vi.fn()
    },
    product: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    productionPlan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    productionOrder: {
      create: vi.fn()
    },
    bOMItem: {
      findMany: vi.fn()
    },
    material: {
      findUnique: vi.fn()
    }
  }
}));

describe('ProductionPlanningService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runMRP', () => {
    it('should throw error if forecast not found', async () => {
      vi.mocked(prisma.forecastResult.findUnique).mockResolvedValue(null);

      await expect(productionPlanningService.runMRP('forecast-1'))
        .rejects.toThrow('Forecast forecast-1 not found');
    });

    it('should throw error if forecast not approved', async () => {
      vi.mocked(prisma.forecastResult.findUnique).mockResolvedValue({
        id: 'forecast-1',
        modelId: 'model-1',
        productId: 'product-1',
        region: 'US-East',
        generatedAt: new Date(),
        horizon: 30,
        predictions: [100],
        status: ForecastStatus.DRAFT,
        approvedBy: null,
        approvedAt: null
      } as any);

      await expect(productionPlanningService.runMRP('forecast-1'))
        .rejects.toThrow('Forecast forecast-1 is not approved');
    });

    it('should create production plan and orders from approved forecast', async () => {
      const mockForecast = {
        id: 'forecast-1',
        modelId: 'model-1',
        productId: 'product-1',
        region: 'US-East',
        generatedAt: new Date(),
        horizon: 30,
        predictions: [100, 150],
        status: ForecastStatus.APPROVED,
        approvedBy: 'user-1',
        approvedAt: new Date()
      };

      const mockProduct = {
        id: 'product-1',
        sku: 'PROD-001',
        name: 'Widget A',
        bomItems: [
          {
            id: 'bom-1',
            productId: 'product-1',
            materialId: 'material-1',
            quantity: 2,
            unit: 'kg',
            material: {
              id: 'material-1',
              sku: 'MAT-001',
              name: 'Steel',
              unit: 'kg',
              onHand: 1000,
              safetyStock: 100,
              reorderPoint: 200
            }
          }
        ]
      };

      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: ProductionPlanStatus.DRAFT,
        authorizedBy: null,
        orders: []
      };

      vi.mocked(prisma.forecastResult.findUnique).mockResolvedValue(mockForecast as any);
      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.productionPlan.create).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.productionOrder.create).mockResolvedValue({
        id: 'order-1',
        planId: 'plan-1',
        productId: 'product-1',
        requiredQty: 250,
        scheduledStart: null,
        scheduledEnd: null,
        status: OrderStatus.PENDING
      });

      const result = await productionPlanningService.runMRP('forecast-1');

      expect(result).toEqual(mockPlan);
      expect(prisma.productionPlan.create).toHaveBeenCalledWith({
        data: {
          forecastId: 'forecast-1',
          status: ProductionPlanStatus.DRAFT
        }
      });
    });
  });

  describe('getBOM', () => {
    it('should return BOM items for a product', async () => {
      const mockBOMItems = [
        {
          id: 'bom-1',
          productId: 'product-1',
          materialId: 'material-1',
          quantity: 2,
          unit: 'kg',
          material: {
            id: 'material-1',
            sku: 'MAT-001',
            name: 'Steel',
            unit: 'kg',
            onHand: 1000,
            safetyStock: 100,
            reorderPoint: 200
          },
          product: {
            id: 'product-1',
            sku: 'PROD-001',
            name: 'Widget A'
          }
        }
      ];

      vi.mocked(prisma.bOMItem.findMany).mockResolvedValue(mockBOMItems as any);

      const result = await productionPlanningService.getBOM('product-1');

      expect(result).toEqual(mockBOMItems);
      expect(prisma.bOMItem.findMany).toHaveBeenCalledWith({
        where: { productId: 'product-1' },
        include: {
          material: true,
          product: true
        }
      });
    });
  });

  describe('checkProductionReadiness', () => {
    it('should throw error if plan not found', async () => {
      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(null);

      await expect(productionPlanningService.checkProductionReadiness('plan-1'))
        .rejects.toThrow('Production plan plan-1 not found');
    });

    it('should return ready status when materials are available', async () => {
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: ProductionPlanStatus.DRAFT,
        authorizedBy: null,
        orders: [
          {
            id: 'order-1',
            planId: 'plan-1',
            productId: 'product-1',
            requiredQty: 100,
            scheduledStart: null,
            scheduledEnd: null,
            status: OrderStatus.PENDING,
            plan: {
              id: 'plan-1',
              forecastId: 'forecast-1',
              createdAt: new Date(),
              status: ProductionPlanStatus.DRAFT,
              authorizedBy: null
            }
          }
        ]
      };

      const mockBOMItems = [
        {
          id: 'bom-1',
          productId: 'product-1',
          materialId: 'material-1',
          quantity: 2,
          unit: 'kg',
          material: {
            id: 'material-1',
            sku: 'MAT-001',
            name: 'Steel',
            unit: 'kg',
            onHand: 1000,
            safetyStock: 100,
            reorderPoint: 200
          }
        }
      ];

      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Steel',
        unit: 'kg',
        onHand: 1000,
        safetyStock: 100,
        reorderPoint: 200
      };

      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.bOMItem.findMany).mockResolvedValue(mockBOMItems as any);
      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial);

      const result = await productionPlanningService.checkProductionReadiness('plan-1');

      expect(result.isReady).toBe(true);
      expect(result.materials).toHaveLength(1);
      expect(result.materials[0]).toMatchObject({
        materialId: 'material-1',
        materialSku: 'MAT-001',
        materialName: 'Steel',
        required: 200, // 100 * 2
        available: 1000,
        shortage: 0,
        unit: 'kg'
      });
    });

    it('should return not ready status when materials are insufficient', async () => {
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: ProductionPlanStatus.DRAFT,
        authorizedBy: null,
        orders: [
          {
            id: 'order-1',
            planId: 'plan-1',
            productId: 'product-1',
            requiredQty: 100,
            scheduledStart: null,
            scheduledEnd: null,
            status: OrderStatus.PENDING,
            plan: {
              id: 'plan-1',
              forecastId: 'forecast-1',
              createdAt: new Date(),
              status: ProductionPlanStatus.DRAFT,
              authorizedBy: null
            }
          }
        ]
      };

      const mockBOMItems = [
        {
          id: 'bom-1',
          productId: 'product-1',
          materialId: 'material-1',
          quantity: 2,
          unit: 'kg',
          material: {
            id: 'material-1',
            sku: 'MAT-001',
            name: 'Steel',
            unit: 'kg',
            onHand: 50,
            safetyStock: 100,
            reorderPoint: 200
          }
        }
      ];

      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Steel',
        unit: 'kg',
        onHand: 50,
        safetyStock: 100,
        reorderPoint: 200
      };

      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.bOMItem.findMany).mockResolvedValue(mockBOMItems as any);
      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial);

      const result = await productionPlanningService.checkProductionReadiness('plan-1');

      expect(result.isReady).toBe(false);
      expect(result.materials[0]).toMatchObject({
        materialId: 'material-1',
        required: 200,
        available: 50,
        shortage: 150
      });
    });
  });

  describe('authorizePlan', () => {
    it('should throw error if plan not found', async () => {
      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(null);

      await expect(productionPlanningService.authorizePlan('plan-1', 'user-1'))
        .rejects.toThrow('Production plan plan-1 not found');
    });

    it('should throw error if plan not in DRAFT status', async () => {
      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue({
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: ProductionPlanStatus.AUTHORIZED,
        authorizedBy: 'user-1',
        orders: []
      } as any);

      await expect(productionPlanningService.authorizePlan('plan-1', 'user-2'))
        .rejects.toThrow('Production plan plan-1 is not in DRAFT status');
    });

    it('should authorize plan and record authorizedBy', async () => {
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: ProductionPlanStatus.DRAFT,
        authorizedBy: null,
        orders: []
      };

      const mockAuthorizedPlan = {
        ...mockPlan,
        status: ProductionPlanStatus.AUTHORIZED,
        authorizedBy: 'user-1'
      };

      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.productionPlan.update).mockResolvedValue(mockAuthorizedPlan as any);

      const result = await productionPlanningService.authorizePlan('plan-1', 'user-1');

      expect(result.status).toBe(ProductionPlanStatus.AUTHORIZED);
      expect(result.authorizedBy).toBe('user-1');
      expect(prisma.productionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          status: ProductionPlanStatus.AUTHORIZED,
          authorizedBy: 'user-1'
        }
      });
    });
  });
});
