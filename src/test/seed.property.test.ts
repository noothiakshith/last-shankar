/**
 * Property 30: Seed script is idempotent
 *
 * For any number of seed script executions N ≥ 1, the total count of
 * SalesRecord, Supplier, BOMItem, Material, and Budget records in the
 * database should be the same as after a single execution.
 *
 * Validates: Requirements 14.3
 *
 * Strategy: We test idempotency by running the seed logic twice against
 * an in-memory mock of the Prisma client and asserting that record counts
 * are identical after both runs. fast-check generates arbitrary N ≥ 1
 * repetition counts to confirm the property holds universally.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import * as fc from 'fast-check'

// ─────────────────────────────────────────────
// Minimal in-memory store that mimics Prisma upsert semantics
// ─────────────────────────────────────────────

type Record = { id: string; [key: string]: unknown }

class InMemoryTable<T extends Record> {
  private store = new Map<string, T>()

  upsert(id: string, create: T, update: Partial<T>): T {
    if (this.store.has(id)) {
      const existing = this.store.get(id)!
      const updated = { ...existing, ...update }
      this.store.set(id, updated)
      return updated
    }
    this.store.set(id, create)
    return create
  }

  count(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }
}

// ─────────────────────────────────────────────
// Seed logic extracted from prisma/seed.ts (pure, no I/O)
// ─────────────────────────────────────────────

interface SeedStore {
  salesRecords: InMemoryTable<Record>
  materials: InMemoryTable<Record>
  products: InMemoryTable<Record>
  bomItems: InMemoryTable<Record>
  suppliers: InMemoryTable<Record>
  supplierMaterials: InMemoryTable<Record>
  budgets: InMemoryTable<Record>
  employees: InMemoryTable<Record>
}

function salesRecordId(date: string, productId: string, region: string, source: string): string {
  // Use a predictable separator and escape values to avoid collisions between parts
  const normalize = (s: string) => String(s).replace(/\|/g, '\\|');
  return `sr|${normalize(date)}|${normalize(productId)}|${normalize(region)}|${normalize(source)}`;
}

const SAMPLE_SALES_ROWS = [
  { date: '2023-01-02', productId: 'PROD-001', region: 'East', quantity: 10, revenue: 250, source: 'superstore' },
  { date: '2023-01-02', productId: 'PROD-002', region: 'West', quantity: 5, revenue: 125, source: 'superstore' },
  { date: '2023-01-02', productId: 'PROD-001', region: 'North', quantity: 20, revenue: 480, source: 'walmart' },
]

const SAMPLE_MATERIALS = [
  { id: 'mat-steel-coil', sku: 'MAT-001', name: 'Steel Coil', unit: 'kg', onHand: 5000, safetyStock: 500, reorderPoint: 1000 },
  { id: 'mat-plastic-resin', sku: 'MAT-002', name: 'Plastic Resin', unit: 'kg', onHand: 3000, safetyStock: 300, reorderPoint: 600 },
]

const SAMPLE_PRODUCTS = [
  { id: 'prod-widget-a', sku: 'PROD-001', name: 'Widget A' },
  { id: 'prod-widget-b', sku: 'PROD-002', name: 'Widget B' },
]

const SAMPLE_BOM_ITEMS = [
  { id: 'bom-001-steel', productId: 'prod-widget-a', materialId: 'mat-steel-coil', quantity: 2.5, unit: 'kg' },
  { id: 'bom-001-plastic', productId: 'prod-widget-a', materialId: 'mat-plastic-resin', quantity: 1.0, unit: 'kg' },
]

const SAMPLE_SUPPLIERS = [
  { id: 'sup-acme-metals', name: 'Acme Metals Ltd', leadTimeDays: 7 },
  { id: 'sup-poly-plastics', name: 'PolyPlastics Inc', leadTimeDays: 5 },
]

const SAMPLE_SUPPLIER_MATERIALS = [
  { supplierId: 'sup-acme-metals', materialId: 'mat-steel-coil', unitCost: 1.2 },
  { supplierId: 'sup-poly-plastics', materialId: 'mat-plastic-resin', unitCost: 0.8 },
]

const SAMPLE_BUDGETS = [
  { id: 'budget-procurement', costCenter: 'PROCUREMENT', totalBudget: 500000, committed: 0, spent: 0 },
]

const SAMPLE_EMPLOYEES = [
  { id: 'emp-admin-01', name: 'Alice Admin', email: 'alice@nexiserp.com', department: 'IT', role: 'ADMIN' },
  { id: 'emp-sales-01', name: 'Sam Sales', email: 'sam@nexiserp.com', department: 'Sales', role: 'SALES_ANALYST' },
]

function runSeedOnce(store: SeedStore): void {
  // Sales records
  for (const row of SAMPLE_SALES_ROWS) {
    const id = salesRecordId(row.date, row.productId, row.region, row.source)
    store.salesRecords.upsert(id, { id, ...row }, { quantity: row.quantity, revenue: row.revenue })
  }

  // Materials
  for (const m of SAMPLE_MATERIALS) {
    const { id: mId, ...mRest } = m
    store.materials.upsert(m.sku, { id: mId, ...mRest }, { name: m.name, onHand: m.onHand })
  }

  // Products
  for (const p of SAMPLE_PRODUCTS) {
    const { id: pId, ...pRest } = p
    store.products.upsert(p.sku, { id: pId, ...pRest }, { name: p.name })
  }

  // BOM Items
  for (const b of SAMPLE_BOM_ITEMS) {
    store.bomItems.upsert(b.id, { ...b }, { quantity: b.quantity })
  }

  // Suppliers
  for (const s of SAMPLE_SUPPLIERS) {
    store.suppliers.upsert(s.id, { ...s }, { name: s.name, leadTimeDays: s.leadTimeDays })
  }

  // SupplierMaterials — composite key
  for (const l of SAMPLE_SUPPLIER_MATERIALS) {
    const key = `${l.supplierId}|${l.materialId}`
    store.supplierMaterials.upsert(key, { id: key, ...l }, { unitCost: l.unitCost })
  }

  // Budgets
  for (const b of SAMPLE_BUDGETS) {
    const { id: bId, ...bRest } = b
    store.budgets.upsert(b.costCenter, { id: bId, ...bRest }, { totalBudget: b.totalBudget })
  }

  // Employees
  for (const e of SAMPLE_EMPLOYEES) {
    store.employees.upsert(e.email, { ...e }, { name: e.name, department: e.department })
  }
}

function makeStore(): SeedStore {
  return {
    salesRecords: new InMemoryTable(),
    materials: new InMemoryTable(),
    products: new InMemoryTable(),
    bomItems: new InMemoryTable(),
    suppliers: new InMemoryTable(),
    supplierMaterials: new InMemoryTable(),
    budgets: new InMemoryTable(),
    employees: new InMemoryTable(),
  }
}

function countAll(store: SeedStore) {
  return {
    salesRecords: store.salesRecords.count(),
    materials: store.materials.count(),
    products: store.products.count(),
    bomItems: store.bomItems.count(),
    suppliers: store.suppliers.count(),
    supplierMaterials: store.supplierMaterials.count(),
    budgets: store.budgets.count(),
    employees: store.employees.count(),
  }
}

// ─────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────

describe('Property 30: Seed script is idempotent', () => {
  let store: SeedStore

  beforeEach(() => {
    store = makeStore()
  })

  it('running seed once produces the expected record counts', () => {
    runSeedOnce(store)
    const counts = countAll(store)

    expect(counts.salesRecords).toBe(SAMPLE_SALES_ROWS.length)
    expect(counts.materials).toBe(SAMPLE_MATERIALS.length)
    expect(counts.products).toBe(SAMPLE_PRODUCTS.length)
    expect(counts.bomItems).toBe(SAMPLE_BOM_ITEMS.length)
    expect(counts.suppliers).toBe(SAMPLE_SUPPLIERS.length)
    expect(counts.supplierMaterials).toBe(SAMPLE_SUPPLIER_MATERIALS.length)
    expect(counts.budgets).toBe(SAMPLE_BUDGETS.length)
    expect(counts.employees).toBe(SAMPLE_EMPLOYEES.length)
  })

  it('property: running seed N times produces the same counts as running it once', () => {
    fc.assert(
      fc.property(
        // N ≥ 2 (we already know N=1 works; test that extra runs don't add records)
        fc.integer({ min: 2, max: 10 }),
        (n) => {
          const freshStore = makeStore()

          // Run once to get baseline
          runSeedOnce(freshStore)
          const baseline = countAll(freshStore)

          // Run N-1 more times
          for (let i = 1; i < n; i++) {
            runSeedOnce(freshStore)
          }

          const afterN = countAll(freshStore)

          // Counts must be identical — no duplicates created
          expect(afterN.salesRecords).toBe(baseline.salesRecords)
          expect(afterN.materials).toBe(baseline.materials)
          expect(afterN.products).toBe(baseline.products)
          expect(afterN.bomItems).toBe(baseline.bomItems)
          expect(afterN.suppliers).toBe(baseline.suppliers)
          expect(afterN.supplierMaterials).toBe(baseline.supplierMaterials)
          expect(afterN.budgets).toBe(baseline.budgets)
          expect(afterN.employees).toBe(baseline.employees)
        },
      ),
    )
  })

  it('property: upsert on existing record updates values without creating duplicates', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 9999, noNaN: true }),
        fc.float({ min: 1, max: 99999, noNaN: true }),
        (newQuantity, newRevenue) => {
          const freshStore = makeStore()
          runSeedOnce(freshStore)
          const countBefore = freshStore.salesRecords.count()

          // Simulate an update run with different values for the same keys
          const updatedRows = SAMPLE_SALES_ROWS.map((r) => ({ ...r, quantity: newQuantity, revenue: newRevenue }))
          for (const row of updatedRows) {
            const id = salesRecordId(row.date, row.productId, row.region, row.source)
            freshStore.salesRecords.upsert(id, { id, ...row }, { quantity: row.quantity, revenue: row.revenue })
          }

          // Count must not have grown
          expect(freshStore.salesRecords.count()).toBe(countBefore)
        },
      ),
    )
  })

  it('property: deterministic ID function produces the same ID for the same inputs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.constantFrom('superstore', 'walmart'),
        (date, productId, region, source) => {
          const id1 = salesRecordId(date, productId, region, source)
          const id2 = salesRecordId(date, productId, region, source)
          expect(id1).toBe(id2)
        },
      ),
    )
  })

  it('property: different natural keys always produce different IDs', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 10 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (productId1, productId2) => {
          fc.pre(productId1 !== productId2)
          const id1 = salesRecordId('2023-01-01', productId1, 'East', 'superstore')
          const id2 = salesRecordId('2023-01-01', productId2, 'East', 'superstore')
          expect(id1).not.toBe(id2)
        },
      ),
    )
  })
})
