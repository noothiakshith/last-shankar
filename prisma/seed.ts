import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────
// CSV Loader
// ─────────────────────────────────────────────

interface CsvSalesRow {
  date: string
  productId: string
  region: string
  quantity: string
  revenue: string
}

function parseCsv(filePath: string): CsvSalesRow[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim())

  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    return headers.reduce(
      (obj, header, i) => {
        obj[header as keyof CsvSalesRow] = values[i]
        return obj
      },
      {} as CsvSalesRow,
    )
  })
}

/**
 * Deterministic ID derived from the natural key: date + productId + region + source.
 * This allows upsert by @id without a separate unique index on the composite key.
 */
function salesRecordId(date: string, productId: string, region: string, source: string): string {
  // Use a predictable separator and escape values to avoid collisions between parts
  const normalize = (s: string) => String(s).replace(/\|/g, '\\|');
  return `sr|${normalize(date)}|${normalize(productId)}|${normalize(region)}|${normalize(source)}`;
}

async function seedSalesRecords(): Promise<number> {
  const dataDir = path.join(__dirname, 'data')
  const sources: Array<{ file: string; source: string }> = [
    { file: 'superstore_sales.csv', source: 'superstore' },
    { file: 'walmart_sales.csv', source: 'walmart' },
  ]

  let total = 0

  for (const { file, source } of sources) {
    const filePath = path.join(dataDir, file)
    if (!fs.existsSync(filePath)) {
      console.warn(`  CSV not found, skipping: ${filePath}`)
      continue
    }

    const rows = parseCsv(filePath)

    for (const row of rows) {
      const id = salesRecordId(row.date, row.productId, row.region, source)
      await prisma.salesRecord.upsert({
        where: { id },
        update: {
          quantity: parseFloat(row.quantity),
          revenue: parseFloat(row.revenue),
        },
        create: {
          id,
          date: new Date(row.date),
          productId: row.productId,
          region: row.region,
          quantity: parseFloat(row.quantity),
          revenue: parseFloat(row.revenue),
          source,
        },
      })
      total++
    }

    console.log(`  ✓ ${rows.length} SalesRecord rows from ${file}`)
  }

  return total
}

// ─────────────────────────────────────────────
// Reference Data Seeding (Task 3.2)
// ─────────────────────────────────────────────

async function seedMaterials() {
  const materials = [
    { id: 'mat-steel-coil', sku: 'MAT-001', name: 'Steel Coil', unit: 'kg', onHand: 5000, safetyStock: 500, reorderPoint: 1000 },
    { id: 'mat-plastic-resin', sku: 'MAT-002', name: 'Plastic Resin', unit: 'kg', onHand: 3000, safetyStock: 300, reorderPoint: 600 },
    { id: 'mat-circuit-board', sku: 'MAT-003', name: 'Circuit Board', unit: 'pcs', onHand: 2000, safetyStock: 200, reorderPoint: 400 },
    { id: 'mat-aluminum-sheet', sku: 'MAT-004', name: 'Aluminum Sheet', unit: 'kg', onHand: 4000, safetyStock: 400, reorderPoint: 800 },
    { id: 'mat-rubber-seal', sku: 'MAT-005', name: 'Rubber Seal', unit: 'pcs', onHand: 10000, safetyStock: 1000, reorderPoint: 2000 },
  ]

  for (const m of materials) {
    await prisma.material.upsert({
      where: { sku: m.sku },
      update: { name: m.name, unit: m.unit, onHand: m.onHand, safetyStock: m.safetyStock, reorderPoint: m.reorderPoint },
      create: m,
    })
  }
  console.log(`  ✓ ${materials.length} Material records`)
  return materials
}

async function seedProducts() {
  const products = [
    { id: 'prod-widget-a', sku: 'PROD-001', name: 'Widget A' },
    { id: 'prod-widget-b', sku: 'PROD-002', name: 'Widget B' },
    { id: 'prod-gadget-c', sku: 'PROD-003', name: 'Gadget C' },
  ]

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: { name: p.name },
      create: p,
    })
  }
  console.log(`  ✓ ${products.length} Product records`)
  return products
}

async function seedBOMItems() {
  const bomItems = [
    // Widget A (PROD-001): needs Steel Coil + Plastic Resin + Rubber Seal
    { id: 'bom-001-steel', productId: 'prod-widget-a', materialId: 'mat-steel-coil', quantity: 2.5, unit: 'kg' },
    { id: 'bom-001-plastic', productId: 'prod-widget-a', materialId: 'mat-plastic-resin', quantity: 1.0, unit: 'kg' },
    { id: 'bom-001-rubber', productId: 'prod-widget-a', materialId: 'mat-rubber-seal', quantity: 4, unit: 'pcs' },
    // Widget B (PROD-002): needs Aluminum Sheet + Circuit Board
    { id: 'bom-002-aluminum', productId: 'prod-widget-b', materialId: 'mat-aluminum-sheet', quantity: 1.5, unit: 'kg' },
    { id: 'bom-002-circuit', productId: 'prod-widget-b', materialId: 'mat-circuit-board', quantity: 2, unit: 'pcs' },
    // Gadget C (PROD-003): needs all five materials
    { id: 'bom-003-steel', productId: 'prod-gadget-c', materialId: 'mat-steel-coil', quantity: 1.0, unit: 'kg' },
    { id: 'bom-003-plastic', productId: 'prod-gadget-c', materialId: 'mat-plastic-resin', quantity: 0.5, unit: 'kg' },
    { id: 'bom-003-circuit', productId: 'prod-gadget-c', materialId: 'mat-circuit-board', quantity: 1, unit: 'pcs' },
    { id: 'bom-003-aluminum', productId: 'prod-gadget-c', materialId: 'mat-aluminum-sheet', quantity: 0.8, unit: 'kg' },
    { id: 'bom-003-rubber', productId: 'prod-gadget-c', materialId: 'mat-rubber-seal', quantity: 2, unit: 'pcs' },
  ]

  for (const b of bomItems) {
    await prisma.bOMItem.upsert({
      where: { id: b.id },
      update: { quantity: b.quantity, unit: b.unit },
      create: b,
    })
  }
  console.log(`  ✓ ${bomItems.length} BOMItem records`)
}

async function seedSuppliers() {
  const suppliers = [
    { id: 'sup-acme-metals', name: 'Acme Metals Ltd', leadTimeDays: 7 },
    { id: 'sup-poly-plastics', name: 'PolyPlastics Inc', leadTimeDays: 5 },
    { id: 'sup-techparts', name: 'TechParts Global', leadTimeDays: 10 },
    { id: 'sup-alloy-works', name: 'Alloy Works Co', leadTimeDays: 6 },
  ]

  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name, leadTimeDays: s.leadTimeDays },
      create: s,
    })
  }
  console.log(`  ✓ ${suppliers.length} Supplier records`)
  return suppliers
}

async function seedSupplierMaterials() {
  const links = [
    // Acme Metals: Steel Coil + Aluminum Sheet
    { supplierId: 'sup-acme-metals', materialId: 'mat-steel-coil', unitCost: 1.2 },
    { supplierId: 'sup-acme-metals', materialId: 'mat-aluminum-sheet', unitCost: 2.5 },
    // PolyPlastics: Plastic Resin + Rubber Seal
    { supplierId: 'sup-poly-plastics', materialId: 'mat-plastic-resin', unitCost: 0.8 },
    { supplierId: 'sup-poly-plastics', materialId: 'mat-rubber-seal', unitCost: 0.15 },
    // TechParts: Circuit Board
    { supplierId: 'sup-techparts', materialId: 'mat-circuit-board', unitCost: 12.0 },
    // Alloy Works: Steel Coil (alternative supplier) + Aluminum Sheet
    { supplierId: 'sup-alloy-works', materialId: 'mat-steel-coil', unitCost: 1.35 },
    { supplierId: 'sup-alloy-works', materialId: 'mat-aluminum-sheet', unitCost: 2.3 },
  ]

  for (const l of links) {
    await prisma.supplierMaterial.upsert({
      where: { supplierId_materialId: { supplierId: l.supplierId, materialId: l.materialId } },
      update: { unitCost: l.unitCost },
      create: l,
    })
  }
  console.log(`  ✓ ${links.length} SupplierMaterial records`)
}

async function seedBudgets() {
  const budgets = [
    { id: 'budget-procurement', costCenter: 'PROCUREMENT', totalBudget: 500000, committed: 0, spent: 0 },
    { id: 'budget-production', costCenter: 'PRODUCTION', totalBudget: 300000, committed: 0, spent: 0 },
    { id: 'budget-operations', costCenter: 'OPERATIONS', totalBudget: 200000, committed: 0, spent: 0 },
  ]

  for (const b of budgets) {
    await prisma.budget.upsert({
      where: { costCenter: b.costCenter },
      update: { totalBudget: b.totalBudget },
      create: b,
    })
  }
  console.log(`  ✓ ${budgets.length} Budget records`)
}

async function seedEmployees() {
  const employees = [
    { id: 'emp-admin-01', name: 'Alice Admin', email: 'alice@nexiserp.com', department: 'IT', role: 'ADMIN' },
    { id: 'emp-sales-01', name: 'Sam Sales', email: 'sam@nexiserp.com', department: 'Sales', role: 'SALES_ANALYST' },
    { id: 'emp-prod-01', name: 'Paula Planner', email: 'paula@nexiserp.com', department: 'Production', role: 'PRODUCTION_PLANNER' },
    { id: 'emp-inv-01', name: 'Ivan Inventory', email: 'ivan@nexiserp.com', department: 'Warehouse', role: 'INVENTORY_MANAGER' },
    { id: 'emp-proc-01', name: 'Oscar Procurement', email: 'oscar@nexiserp.com', department: 'Procurement', role: 'PROCUREMENT_OFFICER' },
    { id: 'emp-fin-01', name: 'Fiona Finance', email: 'fiona@nexiserp.com', department: 'Finance', role: 'FINANCE_MANAGER' },
    { id: 'emp-exec-01', name: 'Eve Executive', email: 'eve@nexiserp.com', department: 'Executive', role: 'EXECUTIVE' },
  ]

  for (const e of employees) {
    await prisma.employee.upsert({
      where: { email: e.email },
      update: { name: e.name, department: e.department, role: e.role },
      create: e,
    })
  }
  console.log(`  ✓ ${employees.length} Employee records`)
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding NexisERP database...\n')

  console.log('📊 Sales Records (CSV):')
  await seedSalesRecords()

  console.log('\n🏭 Reference Data:')
  await seedMaterials()
  await seedProducts()
  await seedBOMItems()
  await seedSuppliers()
  await seedSupplierMaterials()
  await seedBudgets()
  await seedEmployees()

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
