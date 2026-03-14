import { describe, it, expect, beforeEach, vi } from 'vitest';
import { inventoryService } from './inventoryService';
import prisma from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  default: {
    material: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    stockLedger: {
      create: vi.fn()
    },
    productionPlan: {
      findUnique: vi.fn()
    },
    bOMItem: {
      findMany: vi.fn()
    },
    product: {
      findUnique: vi.fn()
    },
    finishedGood: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    }
  }
}));

describe('InventoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateStock', () => {
    it('should append a stock ledger entry and return updated stock level', async () => {
      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Test Material',
        unit: 'kg',
        onHand: 0,
        safetyStock: 50,
        reorderPoint: 100,
        stockLedger: [
          {
            id: 'ledger-1',
            materialId: 'material-1',
            delta: 100,
            reason: 'Initial stock',
            reference: null,
            occurredAt: new Date()
          }
        ]
      };

      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial as any);
      vi.mocked(prisma.stockLedger.create).mockResolvedValue(mockMaterial.stockLedger[0] as any);

      const result = await inventoryService.updateStock('material-1', 100, 'Initial stock');

      expect(result.materialId).toBe('material-1');
      expect(result.onHand).toBe(100);
      expect(prisma.stockLedger.create).toHaveBeenCalledWith({
        data: {
          materialId: 'material-1',
          delta: 100,
          reason: 'Initial stock',
          reference: undefined
        }
      });
    });

    it('should throw error for non-existent material', async () => {
      vi.mocked(prisma.material.findUnique).mockResolvedValue(null);

      await expect(
        inventoryService.updateStock('non-existent-id', 100, 'Test')
      ).rejects.toThrow('Material non-existent-id not found');
    });
  });

  describe('getStockLevel', () => {
    it('should return zero on-hand for material with no ledger entries', async () => {
      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Test Material',
        unit: 'kg',
        onHand: 0,
        safetyStock: 50,
        reorderPoint: 100,
        stockLedger: []
      };

      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial as any);

      const result = await inventoryService.getStockLevel('material-1');

      expect(result.materialId).toBe('material-1');
      expect(result.onHand).toBe(0);
      expect(result.safetyStock).toBe(50);
      expect(result.reorderPoint).toBe(100);
    });

    it('should calculate on-hand as sum of all ledger deltas', async () => {
      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Test Material',
        unit: 'kg',
        onHand: 0,
        safetyStock: 50,
        reorderPoint: 100,
        stockLedger: [
          { id: '1', materialId: 'material-1', delta: 100, reason: 'Purchase', reference: null, occurredAt: new Date() },
          { id: '2', materialId: 'material-1', delta: -20, reason: 'Consumption', reference: null, occurredAt: new Date() },
          { id: '3', materialId: 'material-1', delta: 30, reason: 'Purchase', reference: null, occurredAt: new Date() }
        ]
      };

      vi.mocked(prisma.material.findUnique).mockResolvedValue(mockMaterial as any);

      const result = await inventoryService.getStockLevel('material-1');

      expect(result.onHand).toBe(110); // 100 - 20 + 30
    });

    it('should throw error for non-existent material', async () => {
      vi.mocked(prisma.material.findUnique).mockResolvedValue(null);

      await expect(
        inventoryService.getStockLevel('non-existent-id')
      ).rejects.toThrow('Material non-existent-id not found');
    });
  });

  describe('detectShortages', () => {
    it('should detect shortage when on-hand is less than required', async () => {
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: 'DRAFT' as const,
        authorizedBy: null,
        orders: [
          {
            id: 'order-1',
            planId: 'plan-1',
            productId: 'product-1',
            requiredQty: 50,
            scheduledStart: null,
            scheduledEnd: null,
            status: 'PENDING' as const
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
            name: 'Test Material',
            unit: 'kg',
            onHand: 0,
            safetyStock: 50,
            reorderPoint: 100,
            stockLedger: [
              { id: '1', materialId: 'material-1', delta: 80, reason: 'Initial', reference: null, occurredAt: new Date() }
            ]
          }
        }
      ];

      const mockMaterial = {
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Test Material',
        unit: 'kg',
        onHand: 0,
        safetyStock: 50,
        reorderPoint: 100,
        stockLedger: [
          { id: '1', materialId: 'material-1', delta: 80, reason: 'Initial', reference: null, occurredAt: new Date() }
        ]
      };

      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.bOMItem.findMany).mockResolvedValue(mockBOMItems as any);
      vi.mocked(prisma.material.findUnique)
        .mockResolvedValueOnce(mockMaterial as any)
        .mockResolvedValueOnce(mockMaterial as any);

      const report = await inventoryService.detectShortages('plan-1');

      expect(report.planId).toBe('plan-1');
      expect(report.shortages.length).toBe(1);
      expect(report.shortages[0].materialId).toBe('material-1');
      expect(report.shortages[0].required).toBe(100); // 50 * 2
      expect(report.shortages[0].onHand).toBe(80);
      expect(report.shortages[0].deficit).toBe(20);
    });

    it('should not detect shortage when on-hand meets requirement', async () => {
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: new Date(),
        status: 'DRAFT' as const,
        authorizedBy: null,
        orders: [
          {
            id: 'order-1',
            planId: 'plan-1',
            productId: 'product-1',
            requiredQty: 50,
            scheduledStart: null,
            scheduledEnd: null,
            status: 'PENDING' as const
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
            name: 'Test Material',
            unit: 'kg',
            onHand: 0,
            safetyStock: 50,
            reorderPoint: 100,
            stockLedger: [
              { id: '1', materialId: 'material-1', delta: 100, reason: 'Initial', reference: null, occurredAt: new Date() }
            ]
          }
        }
      ];

      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(mockPlan as any);
      vi.mocked(prisma.bOMItem.findMany).mockResolvedValue(mockBOMItems as any);
      vi.mocked(prisma.material.findUnique).mockResolvedValue({
        id: 'material-1',
        sku: 'MAT-001',
        name: 'Test Material',
        unit: 'kg',
        onHand: 0,
        safetyStock: 50,
        reorderPoint: 100,
        stockLedger: [
          { id: '1', materialId: 'material-1', delta: 100, reason: 'Initial', reference: null, occurredAt: new Date() }
        ]
      } as any);

      const report = await inventoryService.detectShortages('plan-1');

      expect(report.planId).toBe('plan-1');
      expect(report.shortages.length).toBe(0);
    });

    it('should throw error for non-existent plan', async () => {
      vi.mocked(prisma.productionPlan.findUnique).mockResolvedValue(null);

      await expect(
        inventoryService.detectShortages('non-existent-plan')
      ).rejects.toThrow('Production plan non-existent-plan not found');
    });
  });

  describe('getSafetyStockAlerts', () => {
    it('should generate alert when on-hand is below safety stock', async () => {
      const mockMaterials = [
        {
          id: 'material-1',
          sku: 'MAT-001',
          name: 'Test Material',
          unit: 'kg',
          onHand: 0,
          safetyStock: 50,
          reorderPoint: 100,
          stockLedger: [
            { id: '1', materialId: 'material-1', delta: 30, reason: 'Initial', reference: null, occurredAt: new Date() }
          ]
        }
      ];

      vi.mocked(prisma.material.findMany).mockResolvedValue(mockMaterials as any);

      const alerts = await inventoryService.getSafetyStockAlerts();

      const alert = alerts.find(a => a.materialId === 'material-1');
      expect(alert).toBeDefined();
      expect(alert!.onHand).toBe(30);
      expect(alert!.safetyStock).toBe(50);
      expect(alert!.deficit).toBe(20);
    });

    it('should not generate alert when on-hand meets safety stock', async () => {
      const mockMaterials = [
        {
          id: 'material-1',
          sku: 'MAT-001',
          name: 'Test Material',
          unit: 'kg',
          onHand: 0,
          safetyStock: 50,
          reorderPoint: 100,
          stockLedger: [
            { id: '1', materialId: 'material-1', delta: 50, reason: 'Initial', reference: null, occurredAt: new Date() }
          ]
        }
      ];

      vi.mocked(prisma.material.findMany).mockResolvedValue(mockMaterials as any);

      const alerts = await inventoryService.getSafetyStockAlerts();

      const alert = alerts.find(a => a.materialId === 'material-1');
      expect(alert).toBeUndefined();
    });

    it('should not generate alert when on-hand exceeds safety stock', async () => {
      const mockMaterials = [
        {
          id: 'material-1',
          sku: 'MAT-001',
          name: 'Test Material',
          unit: 'kg',
          onHand: 0,
          safetyStock: 50,
          reorderPoint: 100,
          stockLedger: [
            { id: '1', materialId: 'material-1', delta: 100, reason: 'Initial', reference: null, occurredAt: new Date() }
          ]
        }
      ];

      vi.mocked(prisma.material.findMany).mockResolvedValue(mockMaterials as any);

      const alerts = await inventoryService.getSafetyStockAlerts();

      const alert = alerts.find(a => a.materialId === 'material-1');
      expect(alert).toBeUndefined();
    });
  });

  describe('recordFinishedGoods', () => {
    it('should create new finished goods record', async () => {
      const mockProduct = {
        id: 'product-1',
        sku: 'PROD-001',
        name: 'Test Product'
      };

      const mockFinishedGood = {
        id: 'fg-1',
        productId: 'product-1',
        quantity: 100,
        updatedAt: new Date()
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.finishedGood.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.finishedGood.create).mockResolvedValue(mockFinishedGood as any);

      await inventoryService.recordFinishedGoods('product-1', 100);

      expect(prisma.finishedGood.create).toHaveBeenCalledWith({
        data: { productId: 'product-1', quantity: 100 }
      });
    });

    it('should update existing finished goods record', async () => {
      const mockProduct = {
        id: 'product-1',
        sku: 'PROD-001',
        name: 'Test Product'
      };

      const mockExistingFinishedGood = {
        id: 'fg-1',
        productId: 'product-1',
        quantity: 100,
        updatedAt: new Date()
      };

      const mockUpdatedFinishedGood = {
        id: 'fg-1',
        productId: 'product-1',
        quantity: 150,
        updatedAt: new Date()
      };

      vi.mocked(prisma.product.findUnique).mockResolvedValue(mockProduct as any);
      vi.mocked(prisma.finishedGood.findFirst).mockResolvedValue(mockExistingFinishedGood as any);
      vi.mocked(prisma.finishedGood.update).mockResolvedValue(mockUpdatedFinishedGood as any);

      await inventoryService.recordFinishedGoods('product-1', 50);

      expect(prisma.finishedGood.update).toHaveBeenCalledWith({
        where: { id: 'fg-1' },
        data: { quantity: 150 }
      });
    });

    it('should throw error for non-existent product', async () => {
      vi.mocked(prisma.product.findUnique).mockResolvedValue(null);

      await expect(
        inventoryService.recordFinishedGoods('non-existent-product', 100)
      ).rejects.toThrow('Product non-existent-product not found');
    });
  });
});
