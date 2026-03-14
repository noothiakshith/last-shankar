import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 17: MRP material requirement equals forecast quantity times BOM quantity
 * 
 * **Validates: Requirements 7.1, 7.2**
 * 
 * For any product with a forecast quantity Q and a BOM entry requiring N units of a material,
 * running MRP should always produce a material requirement of exactly Q × N for that material.
 */

// ─────────────────────────────────────────────
// Pure MRP calculation logic (extracted for testing)
// ─────────────────────────────────────────────

interface BOMEntry {
  materialId: string;
  quantityPerUnit: number;
}

interface ProductionOrder {
  productId: string;
  forecastQuantity: number;
  bom: BOMEntry[];
}

interface MaterialRequirement {
  materialId: string;
  totalRequired: number;
}

/**
 * Calculate material requirements from production orders.
 * This is the core MRP logic: for each product, multiply forecast quantity by BOM quantity.
 */
function calculateMaterialRequirements(orders: ProductionOrder[]): Map<string, MaterialRequirement> {
  const requirements = new Map<string, MaterialRequirement>();

  for (const order of orders) {
    for (const bomEntry of order.bom) {
      // Core MRP formula: requirement = forecast quantity × BOM quantity per unit
      const required = order.forecastQuantity * bomEntry.quantityPerUnit;

      if (requirements.has(bomEntry.materialId)) {
        // Aggregate requirements for the same material across multiple products
        const existing = requirements.get(bomEntry.materialId)!;
        existing.totalRequired += required;
      } else {
        requirements.set(bomEntry.materialId, {
          materialId: bomEntry.materialId,
          totalRequired: required
        });
      }
    }
  }

  return requirements;
}

describe('Production Planning Property Tests', () => {

  describe('Property 17: MRP material requirement calculation', () => {
    it('should calculate material requirements as forecast quantity × BOM quantity', () => {
      fc.assert(
        fc.property(
          // Generate forecast quantity (positive number between 1 and 1000)
          fc.integer({ min: 1, max: 1000 }),
          // Generate BOM quantity per unit (positive number between 0.1 and 100)
          fc.double({ min: 0.1, max: 100, noNaN: true }),
          (forecastQuantity, bomQuantityPerUnit) => {
            // Create a single production order with one material in BOM
            const orders: ProductionOrder[] = [
              {
                productId: 'product-1',
                forecastQuantity,
                bom: [
                  {
                    materialId: 'material-1',
                    quantityPerUnit: bomQuantityPerUnit
                  }
                ]
              }
            ];

            // Act: Calculate material requirements
            const requirements = calculateMaterialRequirements(orders);

            // Assert: Material requirement should equal forecast quantity × BOM quantity
            const expectedRequirement = forecastQuantity * bomQuantityPerUnit;
            
            expect(requirements.size).toBe(1);
            expect(requirements.has('material-1')).toBe(true);
            
            const materialRequirement = requirements.get('material-1')!;
            
            // Allow for small floating point errors
            const tolerance = 0.0001;
            expect(Math.abs(materialRequirement.totalRequired - expectedRequirement)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should correctly aggregate requirements for multiple products using same material', () => {
      fc.assert(
        fc.property(
          // Generate two forecast quantities
          fc.integer({ min: 1, max: 500 }),
          fc.integer({ min: 1, max: 500 }),
          // Generate two BOM quantities
          fc.double({ min: 0.1, max: 50, noNaN: true }),
          fc.double({ min: 0.1, max: 50, noNaN: true }),
          (forecastQty1, forecastQty2, bomQty1, bomQty2) => {
            // Create two production orders that both use the same material
            const orders: ProductionOrder[] = [
              {
                productId: 'product-1',
                forecastQuantity: forecastQty1,
                bom: [
                  {
                    materialId: 'shared-material',
                    quantityPerUnit: bomQty1
                  }
                ]
              },
              {
                productId: 'product-2',
                forecastQuantity: forecastQty2,
                bom: [
                  {
                    materialId: 'shared-material',
                    quantityPerUnit: bomQty2
                  }
                ]
              }
            ];

            // Act: Calculate material requirements
            const requirements = calculateMaterialRequirements(orders);

            // Assert: Total requirement should be sum of (Q1 × N1) + (Q2 × N2)
            const expectedRequirement = (forecastQty1 * bomQty1) + (forecastQty2 * bomQty2);
            
            expect(requirements.size).toBe(1);
            expect(requirements.has('shared-material')).toBe(true);
            
            const materialRequirement = requirements.get('shared-material')!;
            
            const tolerance = 0.0001;
            expect(Math.abs(materialRequirement.totalRequired - expectedRequirement)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 } // Run 100 random test cases
      );
    });

    it('should handle multiple materials per product correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          (forecastQty, bomQty1, bomQty2, bomQty3) => {
            // Create a production order with multiple materials in BOM
            const orders: ProductionOrder[] = [
              {
                productId: 'product-1',
                forecastQuantity: forecastQty,
                bom: [
                  { materialId: 'material-1', quantityPerUnit: bomQty1 },
                  { materialId: 'material-2', quantityPerUnit: bomQty2 },
                  { materialId: 'material-3', quantityPerUnit: bomQty3 }
                ]
              }
            ];

            // Act
            const requirements = calculateMaterialRequirements(orders);

            // Assert: Each material should have correct requirement
            expect(requirements.size).toBe(3);
            
            const tolerance = 0.0001;
            expect(Math.abs(requirements.get('material-1')!.totalRequired - (forecastQty * bomQty1))).toBeLessThan(tolerance);
            expect(Math.abs(requirements.get('material-2')!.totalRequired - (forecastQty * bomQty2))).toBeLessThan(tolerance);
            expect(Math.abs(requirements.get('material-3')!.totalRequired - (forecastQty * bomQty3))).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle zero forecast quantity correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 100, noNaN: true }),
          (bomQuantityPerUnit) => {
            const orders: ProductionOrder[] = [
              {
                productId: 'product-1',
                forecastQuantity: 0,
                bom: [
                  { materialId: 'material-1', quantityPerUnit: bomQuantityPerUnit }
                ]
              }
            ];

            const requirements = calculateMaterialRequirements(orders);

            // Zero forecast should result in zero requirement
            expect(requirements.size).toBe(1);
            expect(requirements.get('material-1')!.totalRequired).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle empty BOM correctly', () => {
      const orders: ProductionOrder[] = [
        {
          productId: 'product-1',
          forecastQuantity: 100,
          bom: [] // No materials required
        }
      ];

      const requirements = calculateMaterialRequirements(orders);

      // Empty BOM should result in no requirements
      expect(requirements.size).toBe(0);
    });

    it('should handle empty orders list correctly', () => {
      const orders: ProductionOrder[] = [];

      const requirements = calculateMaterialRequirements(orders);

      // No orders should result in no requirements
      expect(requirements.size).toBe(0);
    });
  });
});
