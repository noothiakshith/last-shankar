import prisma from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('🗑️  Cleaning database...')
  // Order matters due to foreign keys
  await prisma.workflowEvent.deleteMany()
  await prisma.approvalGate.deleteMany()
  await prisma.workflowRun.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.supplierMaterial.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.bOMItem.deleteMany()
  await prisma.productionOrder.deleteMany()
  await prisma.productionPlan.deleteMany()
  await prisma.finishedGood.deleteMany()
  await prisma.stockLedger.deleteMany()
  await prisma.material.deleteMany()
  await prisma.product.deleteMany()
  await prisma.salesRecord.deleteMany()
  await prisma.trainedModel.deleteMany()
  await prisma.forecastResult.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.budget.deleteMany()
  await prisma.employee.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log('🌱 Seeding reference data...')

  // 1. Users & Employees
  const password = await bcrypt.hash('password', 10)
  const users = [
    { id: 'user-admin', email: 'admin@nexiserp.com', name: 'Admin', role: 'ADMIN' as const, department: 'IT' },
    { id: 'user-sales', email: 'sales@nexiserp.com', name: 'Sam Sales', role: 'SALES_ANALYST' as const, department: 'Sales' },
    { id: 'user-prod', email: 'paula@nexiserp.com', name: 'Paula Planner', role: 'PRODUCTION_PLANNER' as const, department: 'Production' },
    { id: 'user-inv', email: 'ivan@nexiserp.com', name: 'Ivan Inventory', role: 'INVENTORY_MANAGER' as const, department: 'Warehouse' },
    { id: 'user-proc', email: 'oscar@nexiserp.com', name: 'Oscar Procurement', role: 'PROCUREMENT_OFFICER' as const, department: 'Procurement' },
    { id: 'user-fin', email: 'fiona@nexiserp.com', name: 'Fiona Finance', role: 'FINANCE_MANAGER' as const, department: 'Finance' },
    { id: 'user-exec', email: 'eve@nexiserp.com', name: 'Eve Executive', role: 'EXECUTIVE' as const, department: 'Executive' },
    { id: 'user-pete', email: 'pete@nexiserp.com', name: 'Pete Production', role: 'PRODUCTION_PLANNER' as const, department: 'Production' },
    { id: 'user-sara', email: 'sara@nexiserp.com', name: 'Sara Staff', role: 'PRODUCTION_PLANNER' as const, department: 'Production' },
  ]

  for (const u of users) {
    await prisma.user.create({ data: { ...u, passwordHash: password } })
    await prisma.employee.create({ 
      data: { 
        id: `emp-${u.id.split('-')[1]}`, 
        name: u.name, 
        email: u.email, 
        department: u.department!, 
        role: u.role, 
        userId: u.id 
      } 
    })
  }

  // 2. Products
  const products = [
    { id: 'prod-widget-a', sku: 'PROD-001', name: 'Widget A' },
    { id: 'prod-widget-b', sku: 'PROD-002', name: 'Widget B' },
    { id: 'prod-gadget-c', sku: 'PROD-003', name: 'Gadget C' },
  ]
  await prisma.product.createMany({ data: products })

  // 3. Materials
  const materials = [
    { id: 'mat-steel', sku: 'MAT-001', name: 'Steel Coil', unit: 'kg', onHand: 50, safetyStock: 200, reorderPoint: 400 }, // Intentionally low for procurement demo
    { id: 'mat-plastic', sku: 'MAT-002', name: 'Plastic Resin', unit: 'kg', onHand: 500, safetyStock: 100, reorderPoint: 200 },
    { id: 'mat-circuit', sku: 'MAT-003', name: 'Circuit Board', unit: 'pcs', onHand: 300, safetyStock: 50, reorderPoint: 100 },
  ]
  await prisma.material.createMany({ data: materials })

  // 4. BOM Items
  const bomItems = [
    { productId: 'prod-widget-a', materialId: 'mat-steel', quantity: 10, unit: 'kg' },
    { productId: 'prod-widget-a', materialId: 'mat-plastic', quantity: 2, unit: 'kg' },
    { productId: 'prod-widget-b', materialId: 'mat-plastic', quantity: 5, unit: 'kg' },
    { productId: 'prod-widget-b', materialId: 'mat-circuit', quantity: 1, unit: 'pcs' },
    { productId: 'prod-gadget-c', materialId: 'mat-steel', quantity: 2, unit: 'kg' },
    { productId: 'prod-gadget-c', materialId: 'mat-plastic', quantity: 1, unit: 'kg' },
    { productId: 'prod-gadget-c', materialId: 'mat-circuit', quantity: 3, unit: 'pcs' },
  ]
  await prisma.bOMItem.createMany({ data: bomItems })

  // 5. Sales Records (Synthetic data for ML)
  console.log('📊 Generating sales records...')
  const regions = ['North', 'South', 'East', 'West']
  const salesRecords = []
  
  for (const product of products) {
    for (const region of regions) {
      // 30 days of data per product/region to ensure ML works
      for (let i = 30; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        
        salesRecords.push({
          date,
          productId: product.id,
          region,
          quantity: 10 + Math.random() * 20 + (i % 7), // Add some trend/seasonality
          revenue: (10 + Math.random() * 20) * 100,
          source: 'System'
        })
      }
    }
  }
  await prisma.salesRecord.createMany({ data: salesRecords })

  // 6. Suppliers & Pricing
  const suppliers = [
    { id: 'sup-global', name: 'Global Materials Inc', leadTimeDays: 5 },
    { id: 'sup-local', name: 'Local Supply Co', leadTimeDays: 2 },
  ]
  await prisma.supplier.createMany({ data: suppliers })

  await prisma.supplierMaterial.createMany({
    data: [
      { supplierId: 'sup-global', materialId: 'mat-steel', unitCost: 1.5 },
      { supplierId: 'sup-global', materialId: 'mat-plastic', unitCost: 0.8 },
      { supplierId: 'sup-local', materialId: 'mat-steel', unitCost: 1.8 },
      { supplierId: 'sup-local', materialId: 'mat-circuit', unitCost: 12.0 },
    ]
  })

  // 7. Budgets
  await prisma.budget.createMany({
    data: [
      { costCenter: 'PROCUREMENT', totalBudget: 100000 },
      { costCenter: 'PRODUCTION', totalBudget: 50000 },
    ]
  })

  console.log('✅ Seeding complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
