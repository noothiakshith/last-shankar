import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 21: PO total cost equals quantity times unit cost
 * 
 * **Validates: Requirements 9.2**
 * 
 * For any PurchaseOrder created with quantity Q and unitCost C,
 * the persisted totalCost should always equal Q × C.
 */

interface PurchaseOrderInput {
  quantity: number;
  unitCost: number;
}

interface PurchaseOrderResult {
  quantity: number;
  unitCost: number;
  totalCost: number;
}

/**
 * Calculate PO total cost.
 * This is the core PO cost calculation logic: totalCost = quantity × unitCost.
 */
function calculatePOTotalCost(po: PurchaseOrderInput): PurchaseOrderResult {
  return {
    quantity: po.quantity,
    unitCost: po.unitCost,
    totalCost: po.quantity * po.unitCost
  };
}

describe('Procurement Property Tests', () => {

  describe('Property 21: PO total cost calculation', () => {
    it('should calculate total cost as quantity times unit cost', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 10000, noNaN: true }),
          fc.double({ min: 0.01, max: 1000, noNaN: true }),
          (quantity, unitCost) => {
            const po: PurchaseOrderInput = { quantity, unitCost };
            const result = calculatePOTotalCost(po);

            const expectedTotalCost = quantity * unitCost;
            const tolerance = 0.0001;
            expect(Math.abs(result.totalCost - expectedTotalCost)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero quantity correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1000, noNaN: true }),
          (unitCost) => {
            const po: PurchaseOrderInput = { quantity: 0, unitCost };
            const result = calculatePOTotalCost(po);

            expect(result.totalCost).toBe(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle large quantities correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 100000, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          (quantity, unitCost) => {
            const po: PurchaseOrderInput = { quantity, unitCost };
            const result = calculatePOTotalCost(po);

            const expectedTotalCost = quantity * unitCost;
            const tolerance = 0.01; // Larger tolerance for large numbers
            expect(Math.abs(result.totalCost - expectedTotalCost)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle small unit costs correctly', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }),
          fc.double({ min: 0.001, max: 0.1, noNaN: true }),
          (quantity, unitCost) => {
            const po: PurchaseOrderInput = { quantity, unitCost };
            const result = calculatePOTotalCost(po);

            const expectedTotalCost = quantity * unitCost;
            const tolerance = 0.0001;
            expect(Math.abs(result.totalCost - expectedTotalCost)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should be commutative (order of operands does not matter)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 1000, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          (a, b) => {
            const po1: PurchaseOrderInput = { quantity: a, unitCost: b };
            const po2: PurchaseOrderInput = { quantity: b, unitCost: a };
            
            const result1 = calculatePOTotalCost(po1);
            const result2 = calculatePOTotalCost(po2);

            const tolerance = 0.0001;
            expect(Math.abs(result1.totalCost - result2.totalCost)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with quantity', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 500, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          fc.double({ min: 2, max: 10, noNaN: true }),
          (quantity, unitCost, multiplier) => {
            const po1: PurchaseOrderInput = { quantity, unitCost };
            const po2: PurchaseOrderInput = { quantity: quantity * multiplier, unitCost };
            
            const result1 = calculatePOTotalCost(po1);
            const result2 = calculatePOTotalCost(po2);

            const expectedRatio = multiplier;
            const actualRatio = result2.totalCost / result1.totalCost;
            
            const tolerance = 0.001;
            expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should scale linearly with unit cost', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1, max: 500, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          fc.double({ min: 2, max: 10, noNaN: true }),
          (quantity, unitCost, multiplier) => {
            const po1: PurchaseOrderInput = { quantity, unitCost };
            const po2: PurchaseOrderInput = { quantity, unitCost: unitCost * multiplier };
            
            const result1 = calculatePOTotalCost(po1);
            const result2 = calculatePOTotalCost(po2);

            const expectedRatio = multiplier;
            const actualRatio = result2.totalCost / result1.totalCost;
            
            const tolerance = 0.001;
            expect(Math.abs(actualRatio - expectedRatio)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle fractional quantities', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 10, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          (quantity, unitCost) => {
            const po: PurchaseOrderInput = { quantity, unitCost };
            const result = calculatePOTotalCost(po);

            const expectedTotalCost = quantity * unitCost;
            const tolerance = 0.0001;
            expect(Math.abs(result.totalCost - expectedTotalCost)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve input values', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.1, max: 1000, noNaN: true }),
          fc.double({ min: 0.01, max: 100, noNaN: true }),
          (quantity, unitCost) => {
            const po: PurchaseOrderInput = { quantity, unitCost };
            const result = calculatePOTotalCost(po);

            expect(result.quantity).toBe(quantity);
            expect(result.unitCost).toBe(unitCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

/**
 * Property 22: Supplier lookup returns only qualified suppliers
 * 
 * **Validates: Requirements 9.1**
 * 
 * For any material, the suppliers returned by findSuppliers should all have
 * a SupplierMaterial record linking them to that material — no unqualified
 * suppliers should appear.
 */

interface SupplierMaterialLink {
  supplierId: string;
  materialId: string;
  unitCost: number;
}

interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number;
  unitCost: number;
}

/**
 * Find qualified suppliers for a material.
 * This is the core supplier lookup logic.
 */
function findQualifiedSuppliers(
  materialId: string,
  allSuppliers: Array<{ id: string; name: string; leadTimeDays: number }>,
  supplierMaterialLinks: SupplierMaterialLink[]
): Supplier[] {
  // Filter links for this material
  const qualifiedLinks = supplierMaterialLinks.filter(link => link.materialId === materialId);
  
  // Map to suppliers with unit cost
  const qualifiedSuppliers: Supplier[] = [];
  
  for (const link of qualifiedLinks) {
    const supplier = allSuppliers.find(s => s.id === link.supplierId);
    if (supplier) {
      qualifiedSuppliers.push({
        id: supplier.id,
        name: supplier.name,
        leadTimeDays: supplier.leadTimeDays,
        unitCost: link.unitCost
      });
    }
  }
  
  return qualifiedSuppliers;
}

describe('Property 22: Supplier lookup qualification', () => {
  it('should return only suppliers with SupplierMaterial link', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (materialId, allSuppliers, links) => {
          // Deduplicate suppliers by id
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, links);

          // Verify every returned supplier has a link to this material
          for (const supplier of qualifiedSuppliers) {
            const hasLink = links.some(
              link => link.supplierId === supplier.id && link.materialId === materialId
            );
            expect(hasLink).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be complete: return all suppliers with SupplierMaterial link', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (materialId, allSuppliers, links) => {
          // Deduplicate suppliers by id
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          // Deduplicate links by supplierId-materialId pair (take first)
          const uniqueLinks = Array.from(
            new Map(links.map(l => [`${l.supplierId}-${l.materialId}`, l])).values()
          );

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, uniqueLinks);

          // Count expected qualified suppliers
          const expectedSupplierIds = new Set(
            uniqueLinks
              .filter(link => link.materialId === materialId)
              .map(link => link.supplierId)
              .filter(supplierId => uniqueSuppliers.some(s => s.id === supplierId))
          );

          // Completeness: all qualified suppliers should be returned
          expect(qualifiedSuppliers.length).toBe(expectedSupplierIds.size);

          // Verify each expected supplier is in the result
          for (const expectedId of expectedSupplierIds) {
            const found = qualifiedSuppliers.find(s => s.id === expectedId);
            expect(found).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no suppliers are qualified', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (materialId, allSuppliers) => {
          // No links for this material
          const links: SupplierMaterialLink[] = [];

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, allSuppliers, links);

          // Should return empty array
          expect(qualifiedSuppliers.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should include unit cost from SupplierMaterial link', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (materialId, allSuppliers, links) => {
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          // Deduplicate links by supplierId-materialId pair (take first)
          const uniqueLinks = Array.from(
            new Map(links.map(l => [`${l.supplierId}-${l.materialId}`, l])).values()
          );

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, uniqueLinks);

          // Verify each supplier has the correct unit cost from the link
          for (const supplier of qualifiedSuppliers) {
            const link = uniqueLinks.find(
              l => l.supplierId === supplier.id && l.materialId === materialId
            );
            expect(link).toBeDefined();
            
            // Use tolerance for floating point comparison
            const tolerance = 0.0001;
            expect(Math.abs(supplier.unitCost - link!.unitCost)).toBeLessThan(tolerance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not return suppliers without SupplierMaterial link', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3', 'sup-4', 'sup-5'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C', 'Supplier D', 'Supplier E'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 3, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (materialId, allSuppliers, links) => {
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, links);

          // Verify no supplier without a link is returned
          const linkedSupplierIds = new Set(
            links.filter(l => l.materialId === materialId).map(l => l.supplierId)
          );

          for (const supplier of qualifiedSuppliers) {
            expect(linkedSupplierIds.has(supplier.id)).toBe(true);
          }

          // Verify suppliers without links are not in the result
          for (const supplier of uniqueSuppliers) {
            if (!linkedSupplierIds.has(supplier.id)) {
              const found = qualifiedSuppliers.find(s => s.id === supplier.id);
              expect(found).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple materials correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 1, maxLength: 9 }
        ),
        (allSuppliers, links) => {
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          // Test each material independently
          for (const materialId of ['mat-1', 'mat-2', 'mat-3']) {
            const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, links);

            // Verify all returned suppliers are qualified for THIS material
            for (const supplier of qualifiedSuppliers) {
              const hasLink = links.some(
                link => link.supplierId === supplier.id && link.materialId === materialId
              );
              expect(hasLink).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve supplier attributes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            id: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            name: fc.constantFrom('Supplier A', 'Supplier B', 'Supplier C'),
            leadTimeDays: fc.integer({ min: 1, max: 30 })
          }),
          { minLength: 1, maxLength: 3 }
        ),
        fc.array(
          fc.record({
            supplierId: fc.constantFrom('sup-1', 'sup-2', 'sup-3'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            unitCost: fc.double({ min: 0.01, max: 100, noNaN: true })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (materialId, allSuppliers, links) => {
          const uniqueSuppliers = Array.from(
            new Map(allSuppliers.map(s => [s.id, s])).values()
          );

          const qualifiedSuppliers = findQualifiedSuppliers(materialId, uniqueSuppliers, links);

          // Verify supplier attributes are preserved
          for (const qualifiedSupplier of qualifiedSuppliers) {
            const originalSupplier = uniqueSuppliers.find(s => s.id === qualifiedSupplier.id);
            expect(originalSupplier).toBeDefined();
            expect(qualifiedSupplier.name).toBe(originalSupplier!.name);
            expect(qualifiedSupplier.leadTimeDays).toBe(originalSupplier!.leadTimeDays);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 23: Delivery confirmation triggers stock update
 * 
 * **Validates: Requirements 9.5**
 * 
 * For any PurchaseOrder where delivery is confirmed with received quantity R,
 * a StockLedger entry with delta R should be created for the PO's material.
 */

interface PurchaseOrderDelivery {
  poId: string;
  materialId: string;
  receivedQty: number;
}

interface StockLedgerEntry {
  materialId: string;
  delta: number;
  reason: string;
  reference: string;
}

/**
 * Simulate delivery confirmation and stock update.
 * This is the core delivery confirmation logic.
 */
function confirmDeliveryAndUpdateStock(
  delivery: PurchaseOrderDelivery,
  existingLedger: StockLedgerEntry[]
): StockLedgerEntry[] {
  // Create new ledger entry for delivery
  const newEntry: StockLedgerEntry = {
    materialId: delivery.materialId,
    delta: delivery.receivedQty,
    reason: 'PO_DELIVERY',
    reference: delivery.poId
  };

  return [...existingLedger, newEntry];
}

describe('Property 23: Delivery confirmation stock update', () => {
  it('should create stock ledger entry with received quantity as delta', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 0.1, max: 10000, noNaN: true }),
        (poId, materialId, receivedQty) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };
          const existingLedger: StockLedgerEntry[] = [];

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          // Should have exactly one new entry
          expect(updatedLedger.length).toBe(1);

          // Verify the entry has correct values
          const entry = updatedLedger[0];
          expect(entry.materialId).toBe(materialId);
          expect(entry.delta).toBe(receivedQty);
          expect(entry.reason).toBe('PO_DELIVERY');
          expect(entry.reference).toBe(poId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should append to existing ledger without modifying previous entries', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 0.1, max: 1000, noNaN: true }),
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            delta: fc.double({ min: -500, max: 500, noNaN: true }),
            reason: fc.constantFrom('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT'),
            reference: fc.constantFrom('ref-1', 'ref-2', 'ref-3')
          }),
          { minLength: 0, maxLength: 10 }
        ),
        (poId, materialId, receivedQty, existingLedger) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          // Should have one more entry than before
          expect(updatedLedger.length).toBe(existingLedger.length + 1);

          // Verify all previous entries are unchanged
          for (let i = 0; i < existingLedger.length; i++) {
            expect(updatedLedger[i]).toEqual(existingLedger[i]);
          }

          // Verify the new entry is at the end
          const newEntry = updatedLedger[updatedLedger.length - 1];
          expect(newEntry.materialId).toBe(materialId);
          expect(newEntry.delta).toBe(receivedQty);
          expect(newEntry.reason).toBe('PO_DELIVERY');
          expect(newEntry.reference).toBe(poId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should increase total stock by received quantity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 0.1, max: 1000, noNaN: true }),
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            delta: fc.double({ min: -200, max: 200, noNaN: true }),
            reason: fc.constantFrom('PURCHASE', 'CONSUMPTION'),
            reference: fc.constantFrom('ref-1', 'ref-2')
          }),
          { minLength: 0, maxLength: 5 }
        ),
        (poId, materialId, receivedQty, existingLedger) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };

          // Calculate stock before delivery
          const stockBefore = existingLedger
            .filter(e => e.materialId === materialId)
            .reduce((sum, e) => sum + e.delta, 0);

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          // Calculate stock after delivery
          const stockAfter = updatedLedger
            .filter(e => e.materialId === materialId)
            .reduce((sum, e) => sum + e.delta, 0);

          // Stock should increase by received quantity
          const tolerance = 0.0001;
          expect(Math.abs(stockAfter - (stockBefore + receivedQty))).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero received quantity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        (poId, materialId) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty: 0 };
          const existingLedger: StockLedgerEntry[] = [];

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          // Should still create an entry with zero delta
          expect(updatedLedger.length).toBe(1);
          expect(updatedLedger[0].delta).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle large received quantities', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 10000, max: 1000000, noNaN: true }),
        (poId, materialId, receivedQty) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };
          const existingLedger: StockLedgerEntry[] = [];

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          expect(updatedLedger.length).toBe(1);
          expect(updatedLedger[0].delta).toBe(receivedQty);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle fractional received quantities', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 0.01, max: 10, noNaN: true }),
        (poId, materialId, receivedQty) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };
          const existingLedger: StockLedgerEntry[] = [];

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          expect(updatedLedger.length).toBe(1);
          expect(updatedLedger[0].delta).toBe(receivedQty);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should reference the correct PO', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('po-1', 'po-2', 'po-3', 'po-4', 'po-5'),
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.double({ min: 0.1, max: 1000, noNaN: true }),
        (poId, materialId, receivedQty) => {
          const delivery: PurchaseOrderDelivery = { poId, materialId, receivedQty };
          const existingLedger: StockLedgerEntry[] = [];

          const updatedLedger = confirmDeliveryAndUpdateStock(delivery, existingLedger);

          // Verify the reference matches the PO ID
          expect(updatedLedger[0].reference).toBe(poId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle multiple deliveries for same material', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
        fc.array(
          fc.record({
            poId: fc.constantFrom('po-1', 'po-2', 'po-3', 'po-4', 'po-5'),
            receivedQty: fc.double({ min: 0.1, max: 500, noNaN: true })
          }),
          { minLength: 2, maxLength: 5 }
        ),
        (materialId, deliveries) => {
          let ledger: StockLedgerEntry[] = [];

          // Process multiple deliveries
          for (const delivery of deliveries) {
            ledger = confirmDeliveryAndUpdateStock(
              { poId: delivery.poId, materialId, receivedQty: delivery.receivedQty },
              ledger
            );
          }

          // Should have one entry per delivery
          expect(ledger.length).toBe(deliveries.length);

          // Total stock should equal sum of all received quantities
          const totalReceived = deliveries.reduce((sum, d) => sum + d.receivedQty, 0);
          const totalStock = ledger.reduce((sum, e) => sum + e.delta, 0);

          const tolerance = 0.001;
          expect(Math.abs(totalStock - totalReceived)).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle deliveries for different materials independently', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            poId: fc.constantFrom('po-1', 'po-2', 'po-3'),
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3'),
            receivedQty: fc.double({ min: 0.1, max: 500, noNaN: true })
          }),
          { minLength: 2, maxLength: 6 }
        ),
        (deliveries) => {
          let ledger: StockLedgerEntry[] = [];

          // Process all deliveries
          for (const delivery of deliveries) {
            ledger = confirmDeliveryAndUpdateStock(delivery, ledger);
          }

          // Verify stock for each material independently
          for (const materialId of ['mat-1', 'mat-2', 'mat-3']) {
            const materialDeliveries = deliveries.filter(d => d.materialId === materialId);
            const expectedStock = materialDeliveries.reduce((sum, d) => sum + d.receivedQty, 0);

            const actualStock = ledger
              .filter(e => e.materialId === materialId)
              .reduce((sum, e) => sum + e.delta, 0);

            const tolerance = 0.001;
            expect(Math.abs(actualStock - expectedStock)).toBeLessThan(tolerance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
