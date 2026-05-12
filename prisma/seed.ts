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

  // 2. Products (Expanded product line)
  const products = [
    { id: 'prod-widget-a', sku: 'PROD-001', name: 'Widget A' },
    { id: 'prod-widget-b', sku: 'PROD-002', name: 'Widget B' },
    { id: 'prod-gadget-c', sku: 'PROD-003', name: 'Gadget C' },
    { id: 'prod-device-d', sku: 'PROD-004', name: 'Device D' },
    { id: 'prod-module-e', sku: 'PROD-005', name: 'Module E' },
    { id: 'prod-unit-f', sku: 'PROD-006', name: 'Unit F' },
  ]
  await prisma.product.createMany({ data: products })

  // 3. Materials (Expanded inventory with realistic quantities)
  const materials = [
    { id: 'mat-steel', sku: 'MAT-001', name: 'Steel Coil', unit: 'kg', onHand: 2500, safetyStock: 5000, reorderPoint: 8000 },
    { id: 'mat-plastic', sku: 'MAT-002', name: 'Plastic Resin', unit: 'kg', onHand: 8500, safetyStock: 3000, reorderPoint: 6000 },
    { id: 'mat-circuit', sku: 'MAT-003', name: 'Circuit Board', unit: 'pcs', onHand: 4200, safetyStock: 2000, reorderPoint: 4500 },
    { id: 'mat-aluminum', sku: 'MAT-004', name: 'Aluminum Sheet', unit: 'kg', onHand: 3800, safetyStock: 4000, reorderPoint: 7000 },
    { id: 'mat-copper', sku: 'MAT-005', name: 'Copper Wire', unit: 'kg', onHand: 1200, safetyStock: 1500, reorderPoint: 3000 },
    { id: 'mat-glass', sku: 'MAT-006', name: 'Tempered Glass', unit: 'pcs', onHand: 5600, safetyStock: 2500, reorderPoint: 5000 },
    { id: 'mat-battery', sku: 'MAT-007', name: 'Lithium Battery', unit: 'pcs', onHand: 3400, safetyStock: 3000, reorderPoint: 6000 },
    { id: 'mat-sensor', sku: 'MAT-008', name: 'IoT Sensor', unit: 'pcs', onHand: 2800, safetyStock: 1500, reorderPoint: 3500 },
  ]
  await prisma.material.createMany({ data: materials })

  // 4. BOM Items (Expanded with all products)
  const bomItems = [
    { productId: 'prod-widget-a', materialId: 'mat-steel', quantity: 10, unit: 'kg' },
    { productId: 'prod-widget-a', materialId: 'mat-plastic', quantity: 2, unit: 'kg' },
    { productId: 'prod-widget-a', materialId: 'mat-circuit', quantity: 2, unit: 'pcs' },
    { productId: 'prod-widget-b', materialId: 'mat-plastic', quantity: 5, unit: 'kg' },
    { productId: 'prod-widget-b', materialId: 'mat-circuit', quantity: 1, unit: 'pcs' },
    { productId: 'prod-widget-b', materialId: 'mat-battery', quantity: 1, unit: 'pcs' },
    { productId: 'prod-gadget-c', materialId: 'mat-steel', quantity: 2, unit: 'kg' },
    { productId: 'prod-gadget-c', materialId: 'mat-plastic', quantity: 1, unit: 'kg' },
    { productId: 'prod-gadget-c', materialId: 'mat-circuit', quantity: 3, unit: 'pcs' },
    { productId: 'prod-gadget-c', materialId: 'mat-sensor', quantity: 2, unit: 'pcs' },
    { productId: 'prod-device-d', materialId: 'mat-aluminum', quantity: 8, unit: 'kg' },
    { productId: 'prod-device-d', materialId: 'mat-glass', quantity: 2, unit: 'pcs' },
    { productId: 'prod-device-d', materialId: 'mat-battery', quantity: 2, unit: 'pcs' },
    { productId: 'prod-device-d', materialId: 'mat-sensor', quantity: 4, unit: 'pcs' },
    { productId: 'prod-module-e', materialId: 'mat-copper', quantity: 3, unit: 'kg' },
    { productId: 'prod-module-e', materialId: 'mat-circuit', quantity: 5, unit: 'pcs' },
    { productId: 'prod-module-e', materialId: 'mat-plastic', quantity: 1, unit: 'kg' },
    { productId: 'prod-unit-f', materialId: 'mat-steel', quantity: 15, unit: 'kg' },
    { productId: 'prod-unit-f', materialId: 'mat-aluminum', quantity: 5, unit: 'kg' },
    { productId: 'prod-unit-f', materialId: 'mat-glass', quantity: 1, unit: 'pcs' },
  ]
  await prisma.bOMItem.createMany({ data: bomItems })

  // 5. Sales Records (Realistic enterprise-scale data with ML-friendly patterns)
  console.log('📊 Generating realistic sales records with trends and seasonality...')
  const regions = ['North America', 'South America', 'Europe', 'Asia Pacific', 'Middle East', 'Africa']
  const salesRecords = []
  
  // Product-specific characteristics
  const productProfiles = [
    { id: 'prod-widget-a', baseDemand: 50, trend: 0.3, unitPrice: 180 },    // Growing product
    { id: 'prod-widget-b', baseDemand: 30, trend: 0.15, unitPrice: 220 },   // Moderate growth
    { id: 'prod-gadget-c', baseDemand: 20, trend: -0.1, unitPrice: 150 },   // Declining product
    { id: 'prod-device-d', baseDemand: 45, trend: 0.25, unitPrice: 300 },   // Strong growth
    { id: 'prod-module-e', baseDemand: 35, trend: 0.05, unitPrice: 250 },   // Stable
    { id: 'prod-unit-f', baseDemand: 25, trend: -0.05, unitPrice: 200 },    // Slight decline
  ]
  
  for (const profile of productProfiles) {
    for (const region of regions) {
      // Regional multiplier (some regions have higher demand)
      const regionMultiplier = region === 'North America' ? 1.5 : 
                              region === 'Europe' ? 1.3 :
                              region === 'Asia Pacific' ? 1.4 :
                              region === 'South America' ? 0.9 :
                              region === 'Middle East' ? 0.8 : 0.7
      
      const adjustedBaseDemand = profile.baseDemand * regionMultiplier
      
      // Generate 90 days of historical data for better ML training
      const outlierDays = new Set([
        Math.floor(Math.random() * 90),
        Math.floor(Math.random() * 90),
        Math.floor(Math.random() * 90)
      ])
      
      for (let i = 90; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        
        const dayOfWeek = date.getDay()
        const dayOfMonth = date.getDate()
        const dayIndex = 90 - i
        
        // 1. Base demand
        let quantity = adjustedBaseDemand
        
        // 2. Trend component (linear growth/decline over time)
        quantity += profile.trend * dayIndex
        
        // 3. Weekly seasonality
        const weeklyPattern: Record<number, number> = {
          0: -0.30,  // Sunday: -30%
          1: 0.15,   // Monday: +15% (start of week spike)
          2: 0.05,   // Tuesday: +5%
          3: 0.10,   // Wednesday: +10%
          4: 0.08,   // Thursday: +8%
          5: 0.02,   // Friday: +2%
          6: -0.25   // Saturday: -25%
        }
        quantity += adjustedBaseDemand * weeklyPattern[dayOfWeek]
        
        // 4. Monthly seasonality (end-of-month surge for B2B products)
        if (dayOfMonth >= 25) {
          quantity += adjustedBaseDemand * 0.20  // +20% at month end
        }
        
        // 5. Gaussian noise (10% std dev of base demand)
        const noise = (Math.random() - 0.5) * 2 * (adjustedBaseDemand * 0.10)
        quantity += noise
        
        // 6. Occasional outliers (bulk orders)
        if (outlierDays.has(dayIndex)) {
          quantity += adjustedBaseDemand * (1.5 + Math.random() * 1.0)  // 150-250% spike
        }
        
        // Ensure non-negative and round
        quantity = Math.max(1, Math.round(quantity))
        
        // 7. Revenue with realistic pricing variation
        const priceVariation = 0.9 + Math.random() * 0.2  // ±10% price variation
        const revenue = quantity * profile.unitPrice * priceVariation
        
        salesRecords.push({
          date,
          productId: profile.id,
          region,
          quantity,
          revenue,
          source: 'System'
        })
      }
    }
  }
  
  console.log(`📊 Generated ${salesRecords.length} sales records with realistic patterns`)
  await prisma.salesRecord.createMany({ data: salesRecords })

  // 6. Suppliers & Pricing (Expanded supplier network)
  const suppliers = [
    { id: 'sup-global', name: 'Global Materials Inc', leadTimeDays: 7 },
    { id: 'sup-local', name: 'Local Supply Co', leadTimeDays: 2 },
    { id: 'sup-asia', name: 'Asia Manufacturing Ltd', leadTimeDays: 14 },
    { id: 'sup-euro', name: 'European Components GmbH', leadTimeDays: 10 },
    { id: 'sup-tech', name: 'TechParts Solutions', leadTimeDays: 5 },
  ]
  await prisma.supplier.createMany({ data: suppliers })

  await prisma.supplierMaterial.createMany({
    data: [
      { supplierId: 'sup-global', materialId: 'mat-steel', unitCost: 2.5 },
      { supplierId: 'sup-global', materialId: 'mat-plastic', unitCost: 1.8 },
      { supplierId: 'sup-global', materialId: 'mat-aluminum', unitCost: 3.2 },
      { supplierId: 'sup-local', materialId: 'mat-steel', unitCost: 2.8 },
      { supplierId: 'sup-local', materialId: 'mat-circuit', unitCost: 18.5 },
      { supplierId: 'sup-local', materialId: 'mat-plastic', unitCost: 2.1 },
      { supplierId: 'sup-asia', materialId: 'mat-circuit', unitCost: 15.0 },
      { supplierId: 'sup-asia', materialId: 'mat-battery', unitCost: 22.0 },
      { supplierId: 'sup-asia', materialId: 'mat-sensor', unitCost: 35.0 },
      { supplierId: 'sup-euro', materialId: 'mat-glass', unitCost: 12.5 },
      { supplierId: 'sup-euro', materialId: 'mat-aluminum', unitCost: 3.0 },
      { supplierId: 'sup-euro', materialId: 'mat-copper', unitCost: 8.5 },
      { supplierId: 'sup-tech', materialId: 'mat-sensor', unitCost: 38.0 },
      { supplierId: 'sup-tech', materialId: 'mat-circuit', unitCost: 16.5 },
      { supplierId: 'sup-tech', materialId: 'mat-battery', unitCost: 24.0 },
    ]
  })

  // 7. Budgets (Enterprise-scale budgets)
  await prisma.budget.createMany({
    data: [
      { costCenter: 'PROCUREMENT', totalBudget: 5000000, spent: 1250000, committed: 850000 },
      { costCenter: 'PRODUCTION', totalBudget: 3500000, spent: 875000, committed: 420000 },
      { costCenter: 'OPERATIONS', totalBudget: 2000000, spent: 450000, committed: 280000 },
      { costCenter: 'LOGISTICS', totalBudget: 1500000, spent: 320000, committed: 180000 },
    ]
  })

  // 8. Historical Workflows (Simplified for now - can be expanded later)
  console.log('🔄 Creating historical workflows...')
  
  for (let i = 0; i < 10; i++) {
    const runDate = new Date()
    runDate.setDate(runDate.getDate() - (i * 3))
    
    const runId = `run-${Date.now() - i * 86400000}`
    const product = products[i % products.length]
    const workflowType = i % 3 === 0 ? 'DEMAND_TO_PLAN' : i % 3 === 1 ? 'PLAN_TO_PRODUCE' : 'PROCURE_TO_PAY'
    
    await prisma.workflowRun.create({
      data: {
        id: runId,
        type: workflowType,
        state: 'COMPLETED',
        payload: {
          productId: product.id,
          targetQuantity: 800 + Math.floor(Math.random() * 400),
          region: regions[i % regions.length]
        },
        triggeredBy: users[1].id,
        createdAt: runDate,
        updatedAt: new Date(runDate.getTime() + 86400000)
      }
    })
  }

  // 8.5. Create seed trained model for forecast results
  console.log('🤖 Creating seed trained model...')
  await prisma.trainedModel.create({
    data: {
      id: 'model-seed',
      modelType: 'LINEAR_REGRESSION',
      productId: products[0].id,
      region: regions[0],
      mae: 5.2,
      rmse: 8.1,
      r2Score: 0.85,
      artifactPath: '/tmp/artifacts/model-seed.joblib',
      isActive: true
    }
  });

  // 9. Historical Purchase Orders
  console.log('📦 Creating historical purchase orders...')
  
  for (let i = 0; i < 20; i++) {
    const poDate = new Date()
    poDate.setDate(poDate.getDate() - (i * 2))
    
    const material = materials[i % materials.length]
    const supplier = suppliers[i % suppliers.length]
    const quantity = 500 + Math.floor(Math.random() * 1500)
    const unitCost = 5 + Math.random() * 20
    
    // Use proper POStatus enum values
    const statusOptions: Array<'DELIVERED' | 'ORDERED' | 'APPROVED' | 'PENDING_APPROVAL'> = 
      ['DELIVERED', 'DELIVERED', 'DELIVERED', 'ORDERED', 'PENDING_APPROVAL']
    
    await prisma.purchaseOrder.create({
      data: {
        id: `PO-${2025000 + i}`,
        materialId: material.id,
        supplierId: supplier.id,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        status: statusOptions[Math.min(i, 4)],
        createdAt: poDate,
        approvedBy: i < 4 ? users[5].id : undefined, // Fiona Finance
        approvedAt: i < 4 ? new Date(poDate.getTime() + 3600000) : undefined,
        deliveredAt: i < 3 ? new Date(poDate.getTime() + 86400000 * 7) : undefined
      }
    })
  }

  // 10. Production Plans and Orders
  console.log('🏭 Creating production history...')
  
  // First create some forecast results to link to
  const forecastResults = []
  for (let i = 0; i < 12; i++) {
    const forecastDate = new Date()
    forecastDate.setDate(forecastDate.getDate() - (i * 4))
    const product = products[i % products.length]
    
    const forecast = await prisma.forecastResult.create({
      data: {
        id: `forecast-${Date.now() - i * 86400000}`,
        modelId: 'model-seed',
        productId: product.id,
        region: regions[i % regions.length],
        horizon: 30,
        predictions: [800 + Math.floor(Math.random() * 400)],
        status: 'APPROVED',
        generatedAt: forecastDate,
        approvedBy: users[1].id,
        approvedAt: forecastDate
      }
    })
    forecastResults.push(forecast)
  }
  
  for (let i = 0; i < 12; i++) {
    const planDate = new Date()
    planDate.setDate(planDate.getDate() - (i * 4))
    
    const plan = await prisma.productionPlan.create({
      data: {
        id: `PLAN-${2025000 + i}`,
        forecastId: forecastResults[i].id,
        status: i < 8 ? 'COMPLETED' : 'IN_PROGRESS',
        createdAt: planDate,
        authorizedBy: i < 8 ? users[2].id : undefined // Paula Planner
      }
    })

    if (i < 8) {
      const product = products[i % products.length]
      const targetQty = 600 + Math.floor(Math.random() * 600)
      
      await prisma.productionOrder.create({
        data: {
          id: `ORDER-${2025000 + i}`,
          planId: plan.id,
          productId: product.id,
          requiredQty: targetQty,
          status: 'COMPLETED',
          scheduledStart: planDate,
          scheduledEnd: new Date(planDate.getTime() + 86400000 * 3)
        }
      })

      // Add finished goods
      await prisma.finishedGood.create({
        data: {
          productId: product.id,
          quantity: targetQty,
          updatedAt: new Date(planDate.getTime() + 86400000 * 3)
        }
      })
    }
  }

  // 11. Stock Ledger Entries
  console.log('📊 Creating stock ledger history...')
  for (const material of materials) {
    for (let i = 0; i < 30; i++) {
      const ledgerDate = new Date()
      ledgerDate.setDate(ledgerDate.getDate() - i)
      
      const isReceipt = i % 3 === 0
      const delta = isReceipt ? 
        200 + Math.floor(Math.random() * 500) : 
        -(50 + Math.floor(Math.random() * 200))
      
      await prisma.stockLedger.create({
        data: {
          materialId: material.id,
          delta,
          reason: isReceipt ? 'RECEIPT' : 'CONSUMPTION',
          reference: isReceipt ? `PO-${2025000 + i}` : `ORDER-${2025000 + i}`,
          occurredAt: ledgerDate
        }
      })
    }
  }

  console.log('✅ Seeding complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
