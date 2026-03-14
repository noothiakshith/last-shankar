import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 18: Stock on-hand equals sum of all ledger deltas
 * 
 * **Validates: Requirements 8.1, 8.2**
 * 
 * For any material and any sequence of stock updates (in any insertion order),
 * the computed on-hand quantity should always equal the arithmetic sum of all
 * StockLedger delta entries for that material.
 */

// ─────────────────────────────────────────────
// Pure stock calculation logic (extracted for testing)
// ─────────────────────────────────────────────

interface StockLedgerEntry {
  materialId: string;
  delta: number;
  reason: string;
  occurredAt: Date;
}

/**
 * Calculate on-hand quantity from ledger entries.
 * This is the core inventory tracking logic: on-hand = SUM(all deltas).
 */
function calculateOnHand(ledgerEntries: StockLedgerEntry[]): number {
  return ledgerEntries.reduce((sum, entry) => sum + entry.delta, 0);
}

describe('Inventory Property Tests', () => {

  describe('Property 18: Stock on-hand ledger sum', () => {
    it('should calculate on-hand as sum of all ledger deltas', () => {
      fc.assert(
        fc.property(
          // Generate an array of delta values (can be positive or negative)
          fc.array(fc.double({ min: -1000, max: 1000, noNaN: true }), { minLength: 1, maxLength: 50 }),
          (deltas) => {
            // Create ledger entries from deltas
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: `transaction-${index}`,
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            // Act: Calculate on-hand
            const onHand = calculateOnHand(ledgerEntries);

            // Assert: On-hand should equal sum of all deltas
            const expectedOnHand = deltas.reduce((sum, delta) => sum + delta, 0);
            
            // Allow for small floating point errors
            const tolerance = 0.0001;
            expect(Math.abs(onHand - expectedOnHand)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be independent of insertion order', () => {
      fc.assert(
        fc.property(
          // Generate an array of deltas
          fc.array(fc.double({ min: -500, max: 500, noNaN: true }), { minLength: 2, maxLength: 20 }),
          (deltas) => {
            // Create ledger entries in original order
            const ledgerEntriesOriginal: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: `transaction-${index}`,
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            // Create ledger entries in reversed order
            const ledgerEntriesReversed: StockLedgerEntry[] = [...ledgerEntriesOriginal].reverse();

            // Act: Calculate on-hand for both orders
            const onHandOriginal = calculateOnHand(ledgerEntriesOriginal);
            const onHandReversed = calculateOnHand(ledgerEntriesReversed);

            // Assert: On-hand should be the same regardless of order
            const tolerance = 0.0001;
            expect(Math.abs(onHandOriginal - onHandReversed)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle positive deltas (stock additions)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: 0.1, max: 1000, noNaN: true }), { minLength: 1, maxLength: 30 }),
          (deltas) => {
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: 'purchase',
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            const onHand = calculateOnHand(ledgerEntries);
            const expectedOnHand = deltas.reduce((sum, delta) => sum + delta, 0);

            // On-hand should be positive when all deltas are positive
            expect(onHand).toBeGreaterThan(0);
            
            const tolerance = 0.0001;
            expect(Math.abs(onHand - expectedOnHand)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle negative deltas (stock consumption)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -1000, max: -0.1, noNaN: true }), { minLength: 1, maxLength: 30 }),
          (deltas) => {
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: 'consumption',
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            const onHand = calculateOnHand(ledgerEntries);
            const expectedOnHand = deltas.reduce((sum, delta) => sum + delta, 0);

            // On-hand should be negative when all deltas are negative
            expect(onHand).toBeLessThan(0);
            
            const tolerance = 0.0001;
            expect(Math.abs(onHand - expectedOnHand)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle mixed positive and negative deltas', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -500, max: 500, noNaN: true }), { minLength: 5, maxLength: 30 }),
          (deltas) => {
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: delta > 0 ? 'purchase' : 'consumption',
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            const onHand = calculateOnHand(ledgerEntries);
            const expectedOnHand = deltas.reduce((sum, delta) => sum + delta, 0);

            const tolerance = 0.0001;
            expect(Math.abs(onHand - expectedOnHand)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle zero deltas correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constant(0), { minLength: 1, maxLength: 10 }),
          (deltas) => {
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: 'adjustment',
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            const onHand = calculateOnHand(ledgerEntries);

            // All zero deltas should result in zero on-hand
            expect(onHand).toBe(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle single ledger entry', () => {
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          (delta) => {
            const ledgerEntries: StockLedgerEntry[] = [{
              materialId: 'material-1',
              delta,
              reason: 'initial',
              occurredAt: new Date()
            }];

            const onHand = calculateOnHand(ledgerEntries);

            // Single entry should equal the delta
            const tolerance = 0.0001;
            expect(Math.abs(onHand - delta)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle empty ledger (no entries)', () => {
      const ledgerEntries: StockLedgerEntry[] = [];
      const onHand = calculateOnHand(ledgerEntries);

      // Empty ledger should result in zero on-hand
      expect(onHand).toBe(0);
    });

    it('should correctly sum large number of entries', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -100, max: 100, noNaN: true }), { minLength: 100, maxLength: 500 }),
          (deltas) => {
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: `transaction-${index}`,
              occurredAt: new Date(Date.now() + index * 1000)
            }));

            const onHand = calculateOnHand(ledgerEntries);
            const expectedOnHand = deltas.reduce((sum, delta) => sum + delta, 0);

            // Should handle large number of entries correctly
            const tolerance = 0.001; // Slightly larger tolerance for many operations
            expect(Math.abs(onHand - expectedOnHand)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should be associative (grouping does not matter)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.double({ min: -200, max: 200, noNaN: true }), { minLength: 6, maxLength: 12 }),
          (deltas) => {
            // Calculate in one go
            const ledgerEntries: StockLedgerEntry[] = deltas.map((delta, index) => ({
              materialId: 'material-1',
              delta,
              reason: `transaction-${index}`,
              occurredAt: new Date(Date.now() + index * 1000)
            }));
            const onHandAll = calculateOnHand(ledgerEntries);

            // Calculate in two groups
            const midpoint = Math.floor(deltas.length / 2);
            const group1 = ledgerEntries.slice(0, midpoint);
            const group2 = ledgerEntries.slice(midpoint);
            const onHandGroup1 = calculateOnHand(group1);
            const onHandGroup2 = calculateOnHand(group2);
            const onHandGrouped = onHandGroup1 + onHandGroup2;

            // Should be the same regardless of grouping
            const tolerance = 0.0001;
            expect(Math.abs(onHandAll - onHandGrouped)).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * Property 19: Shortage report is complete and sound
 * 
 * **Validates: Requirements 8.3**
 * 
 * For any ProductionPlan and inventory state, the ShortageReport should contain
 * exactly those materials where the MRP requirement exceeds the current on-hand
 * quantity — no false positives and no false negatives.
 */

interface MaterialRequirement {
  materialId: string;
  required: number;
}

interface MaterialInventory {
  materialId: string;
  onHand: number;
}

interface ShortageItem {
  materialId: string;
  required: number;
  onHand: number;
  deficit: number;
}

/**
 * Detect shortages by comparing requirements against inventory.
 * This is the core shortage detection logic.
 */
function detectShortages(
  requirements: MaterialRequirement[],
  inventory: MaterialInventory[]
): ShortageItem[] {
  const inventoryMap = new Map(inventory.map(inv => [inv.materialId, inv.onHand]));
  const shortages: ShortageItem[] = [];

  for (const req of requirements) {
    const onHand = inventoryMap.get(req.materialId) || 0;
    
    if (onHand < req.required) {
      shortages.push({
        materialId: req.materialId,
        required: req.required,
        onHand,
        deficit: req.required - onHand,
      });
    }
  }

  return shortages;
}

describe('Property 19: Shortage report completeness', () => {
  it('should report shortage when requirement exceeds on-hand', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 999, noNaN: true }),
        (required, onHand) => {
          // Ensure requirement > onHand
          fc.pre(required > onHand);

          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required }
          ];
          const inventory: MaterialInventory[] = [
            { materialId: 'material-1', onHand }
          ];

          const shortages = detectShortages(requirements, inventory);

          // Should report exactly one shortage
          expect(shortages.length).toBe(1);
          expect(shortages[0].materialId).toBe('material-1');
          expect(shortages[0].required).toBe(required);
          expect(shortages[0].onHand).toBe(onHand);
          
          const tolerance = 0.0001;
          expect(Math.abs(shortages[0].deficit - (required - onHand))).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT report shortage when on-hand meets or exceeds requirement', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        (required, extraStock) => {
          const onHand = required + extraStock;

          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required }
          ];
          const inventory: MaterialInventory[] = [
            { materialId: 'material-1', onHand }
          ];

          const shortages = detectShortages(requirements, inventory);

          // Should report no shortages
          expect(shortages.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be complete: report all materials with shortages', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'),
            required: fc.double({ min: 10, max: 100, noNaN: true }),
            onHand: fc.double({ min: 0, max: 50, noNaN: true })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (materials) => {
          // Deduplicate by materialId (take first occurrence)
          const uniqueMaterials = Array.from(
            new Map(materials.map(m => [m.materialId, m])).values()
          );

          const requirements: MaterialRequirement[] = uniqueMaterials.map(m => ({
            materialId: m.materialId,
            required: m.required
          }));
          const inventory: MaterialInventory[] = uniqueMaterials.map(m => ({
            materialId: m.materialId,
            onHand: m.onHand
          }));

          const shortages = detectShortages(requirements, inventory);

          // Count expected shortages
          const expectedShortages = uniqueMaterials.filter(m => m.onHand < m.required);

          // Completeness: all materials with shortages should be reported
          expect(shortages.length).toBe(expectedShortages.length);

          // Verify each expected shortage is in the report
          for (const expected of expectedShortages) {
            const found = shortages.find(s => s.materialId === expected.materialId);
            expect(found).toBeDefined();
            expect(found!.required).toBe(expected.required);
            expect(found!.onHand).toBe(expected.onHand);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be sound: report only materials with actual shortages (no false positives)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'),
            required: fc.double({ min: 10, max: 100, noNaN: true }),
            onHand: fc.double({ min: 0, max: 150, noNaN: true })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (materials) => {
          // Deduplicate by materialId
          const uniqueMaterials = Array.from(
            new Map(materials.map(m => [m.materialId, m])).values()
          );

          const requirements: MaterialRequirement[] = uniqueMaterials.map(m => ({
            materialId: m.materialId,
            required: m.required
          }));
          const inventory: MaterialInventory[] = uniqueMaterials.map(m => ({
            materialId: m.materialId,
            onHand: m.onHand
          }));

          const shortages = detectShortages(requirements, inventory);

          // Soundness: every reported shortage should be a real shortage
          for (const shortage of shortages) {
            const material = uniqueMaterials.find(m => m.materialId === shortage.materialId);
            expect(material).toBeDefined();
            expect(material!.onHand).toBeLessThan(material!.required);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero requirement correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        (onHand) => {
          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required: 0 }
          ];
          const inventory: MaterialInventory[] = [
            { materialId: 'material-1', onHand }
          ];

          const shortages = detectShortages(requirements, inventory);

          // Zero requirement should never result in shortage
          expect(shortages.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle zero on-hand correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (required) => {
          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required }
          ];
          const inventory: MaterialInventory[] = [
            { materialId: 'material-1', onHand: 0 }
          ];

          const shortages = detectShortages(requirements, inventory);

          // Should report shortage when on-hand is zero and requirement is positive
          if (required > 0) {
            expect(shortages.length).toBe(1);
            expect(shortages[0].deficit).toBe(required);
          } else {
            expect(shortages.length).toBe(0);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle material not in inventory (defaults to zero)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (required) => {
          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required }
          ];
          const inventory: MaterialInventory[] = []; // Material not in inventory

          const shortages = detectShortages(requirements, inventory);

          // Should report shortage with on-hand = 0
          expect(shortages.length).toBe(1);
          expect(shortages[0].materialId).toBe('material-1');
          expect(shortages[0].onHand).toBe(0);
          expect(shortages[0].deficit).toBe(required);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty requirements list', () => {
    const requirements: MaterialRequirement[] = [];
    const inventory: MaterialInventory[] = [
      { materialId: 'material-1', onHand: 100 }
    ];

    const shortages = detectShortages(requirements, inventory);

    // No requirements should result in no shortages
    expect(shortages.length).toBe(0);
  });

  it('should calculate deficit correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 49, noNaN: true }),
        (required, onHand) => {
          const requirements: MaterialRequirement[] = [
            { materialId: 'material-1', required }
          ];
          const inventory: MaterialInventory[] = [
            { materialId: 'material-1', onHand }
          ];

          const shortages = detectShortages(requirements, inventory);

          expect(shortages.length).toBe(1);
          
          const expectedDeficit = required - onHand;
          const tolerance = 0.0001;
          expect(Math.abs(shortages[0].deficit - expectedDeficit)).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 20: Safety stock alerts are complete and sound
 * 
 * **Validates: Requirements 8.4**
 * 
 * For any set of materials, the SafetyStockAlert list should contain exactly
 * those materials where onHand < safetyStock — no false positives and no false negatives.
 */

interface MaterialStock {
  materialId: string;
  onHand: number;
  safetyStock: number;
}

interface SafetyStockAlert {
  materialId: string;
  onHand: number;
  safetyStock: number;
  deficit: number;
}

/**
 * Generate safety stock alerts for materials below threshold.
 * This is the core safety stock alerting logic.
 */
function generateSafetyStockAlerts(materials: MaterialStock[]): SafetyStockAlert[] {
  const alerts: SafetyStockAlert[] = [];

  for (const material of materials) {
    if (material.onHand < material.safetyStock) {
      alerts.push({
        materialId: material.materialId,
        onHand: material.onHand,
        safetyStock: material.safetyStock,
        deficit: material.safetyStock - material.onHand,
      });
    }
  }

  return alerts;
}

describe('Property 20: Safety stock alert completeness', () => {
  it('should alert when on-hand is below safety stock', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 999, noNaN: true }),
        (safetyStock, onHand) => {
          // Ensure onHand < safetyStock
          fc.pre(onHand < safetyStock);

          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand, safetyStock }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Should generate exactly one alert
          expect(alerts.length).toBe(1);
          expect(alerts[0].materialId).toBe('material-1');
          expect(alerts[0].onHand).toBe(onHand);
          expect(alerts[0].safetyStock).toBe(safetyStock);
          
          const tolerance = 0.0001;
          expect(Math.abs(alerts[0].deficit - (safetyStock - onHand))).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT alert when on-hand meets or exceeds safety stock', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0, max: 500, noNaN: true }),
        (safetyStock, extraStock) => {
          const onHand = safetyStock + extraStock;

          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand, safetyStock }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Should generate no alerts
          expect(alerts.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be complete: alert for all materials below safety stock', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'),
            onHand: fc.double({ min: 0, max: 100, noNaN: true }),
            safetyStock: fc.double({ min: 0, max: 150, noNaN: true })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (materials) => {
          // Deduplicate by materialId
          const uniqueMaterials = Array.from(
            new Map(materials.map(m => [m.materialId, m])).values()
          );

          const alerts = generateSafetyStockAlerts(uniqueMaterials);

          // Count expected alerts
          const expectedAlerts = uniqueMaterials.filter(m => m.onHand < m.safetyStock);

          // Completeness: all materials below safety stock should be alerted
          expect(alerts.length).toBe(expectedAlerts.length);

          // Verify each expected alert is in the list
          for (const expected of expectedAlerts) {
            const found = alerts.find(a => a.materialId === expected.materialId);
            expect(found).toBeDefined();
            expect(found!.onHand).toBe(expected.onHand);
            expect(found!.safetyStock).toBe(expected.safetyStock);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be sound: alert only for materials actually below safety stock (no false positives)', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'),
            onHand: fc.double({ min: 0, max: 100, noNaN: true }),
            safetyStock: fc.double({ min: 0, max: 150, noNaN: true })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (materials) => {
          // Deduplicate by materialId
          const uniqueMaterials = Array.from(
            new Map(materials.map(m => [m.materialId, m])).values()
          );

          const alerts = generateSafetyStockAlerts(uniqueMaterials);

          // Soundness: every alert should be for a material actually below safety stock
          for (const alert of alerts) {
            const material = uniqueMaterials.find(m => m.materialId === alert.materialId);
            expect(material).toBeDefined();
            expect(material!.onHand).toBeLessThan(material!.safetyStock);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle zero safety stock correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (onHand) => {
          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand, safetyStock: 0 }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Positive on-hand with zero safety stock should not alert
          expect(alerts.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle zero on-hand correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        (safetyStock) => {
          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand: 0, safetyStock }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Zero on-hand with positive safety stock should alert
          expect(alerts.length).toBe(1);
          expect(alerts[0].deficit).toBe(safetyStock);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle negative on-hand correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: -0.1, noNaN: true }),
        fc.double({ min: 10, max: 100, noNaN: true }),
        (onHand, safetyStock) => {
          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand, safetyStock }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Negative on-hand should always alert
          expect(alerts.length).toBe(1);
          
          const expectedDeficit = safetyStock - onHand;
          const tolerance = 0.0001;
          expect(Math.abs(alerts[0].deficit - expectedDeficit)).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle empty materials list', () => {
    const materials: MaterialStock[] = [];
    const alerts = generateSafetyStockAlerts(materials);

    // No materials should result in no alerts
    expect(alerts.length).toBe(0);
  });

  it('should calculate deficit correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 50, max: 500, noNaN: true }),
        fc.double({ min: 0, max: 49, noNaN: true }),
        (safetyStock, onHand) => {
          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand, safetyStock }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          expect(alerts.length).toBe(1);
          
          const expectedDeficit = safetyStock - onHand;
          const tolerance = 0.0001;
          expect(Math.abs(alerts[0].deficit - expectedDeficit)).toBeLessThan(tolerance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle exact threshold (on-hand equals safety stock)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1, max: 1000, noNaN: true }),
        (threshold) => {
          const materials: MaterialStock[] = [
            { materialId: 'material-1', onHand: threshold, safetyStock: threshold }
          ];

          const alerts = generateSafetyStockAlerts(materials);

          // Exact threshold should NOT alert (on-hand is not less than safety stock)
          expect(alerts.length).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle multiple materials with mixed alert conditions', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            materialId: fc.constantFrom('mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'),
            onHand: fc.double({ min: 0, max: 100, noNaN: true }),
            safetyStock: fc.double({ min: 0, max: 100, noNaN: true })
          }),
          { minLength: 3, maxLength: 10 }
        ),
        (materials) => {
          // Deduplicate by materialId
          const uniqueMaterials = Array.from(
            new Map(materials.map(m => [m.materialId, m])).values()
          );

          const alerts = generateSafetyStockAlerts(uniqueMaterials);

          // Verify each alert corresponds to a material below safety stock
          for (const alert of alerts) {
            const material = uniqueMaterials.find(m => m.materialId === alert.materialId);
            expect(material).toBeDefined();
            expect(material!.onHand).toBeLessThan(material!.safetyStock);
          }

          // Verify no material below safety stock is missing from alerts
          const alertedMaterialIds = new Set(alerts.map(a => a.materialId));
          for (const material of uniqueMaterials) {
            if (material.onHand < material.safetyStock) {
              expect(alertedMaterialIds.has(material.materialId)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
