import "dotenv/config";
import prisma from "../src/lib/prisma";
import { orchestratorService } from "../src/modules/orchestrator/orchestratorService";
import { productionPlanningService } from "../src/modules/production/productionPlanningService";
import { procurementService } from "../src/modules/procurement/procurementService";
import { approvePO } from "../src/modules/finance/financeService";
import { WorkflowState, ApprovalGateType, Role } from "@prisma/client";

async function runTest() {
  console.log("🚀 Starting Plan-to-Produce Integration Test...");

  // 0. Ensure budget exists
  await prisma.budget.upsert({
    where: { costCenter: "PROCUREMENT" },
    update: { totalBudget: 1000000, spent: 0 },
    create: { costCenter: "PROCUREMENT", totalBudget: 1000000, spent: 0 }
  });

  // 1. Get a product and ensure it has a forecast (needed for MRP)
  const product = await prisma.product.findFirst({ where: { sku: "PROD-001" } });
  if (!product) throw new Error("Seed data missing PROD-001");

  // Create an approved forecast for this product
  const forecast = await prisma.forecastResult.create({
    data: {
      productId: product.id,
      modelId: "test-model-01",
      region: "North",
      horizon: 30,
      predictions: [100, 100],
      status: "APPROVED"
    }
  });

  // 2. Run MRP to get a plan
  console.log("Step 1: Running MRP...");
  const plan = await productionPlanningService.runMRP(forecast.id);

  // 3. Trigger P2P Workflow
  console.log("Step 2: Triggering P2P Workflow...");
  const run = await orchestratorService.triggerWorkflow("PLAN_TO_PRODUCE", "test-user", { planId: plan.id });
  
  // Helper to wait and refresh run
  const waitAndRefresh = async (id: string) => {
    await new Promise(r => setTimeout(r, 1000));
    return prisma.workflowRun.findUniqueOrThrow({ where: { id }, include: { approvals: true } });
  };

  let currentRun = await waitAndRefresh(run.id);
  console.log("Current State:", currentRun.state);

  // 4. Handle POCURE-MENT phase (if seeded low stock, it will go here)
  if (currentRun.state === "PENDING_PO_APPROVAL") {
    console.log("Step 3: Approving Purchase Orders...");
    const payload = currentRun.payload as any;
    for (const poId of payload.poIds) {
      await approvePO(poId, "fiona-finance");
    }
    currentRun = await waitAndRefresh(run.id);
  }

  console.log("Current State:", currentRun.state);

  // 5. Authorize Production
  if (currentRun.state === "PENDING_PRODUCTION_AUTH") {
    console.log("Step 4: Authorizing Production...");
    await productionPlanningService.authorizePlan(plan.id, "paula-planner");
    currentRun = await waitAndRefresh(run.id);
  }

  console.log("Current State:", currentRun.state);

  // 6. Execution (if POs were used, we must deliver them)
  if (currentRun.state === "EXECUTING") {
    console.log("Step 5: Delivering Purchase Orders...");
    const payload = currentRun.payload as any;
    if (payload.poIds) {
      for (const poId of payload.poIds) {
        const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
        await procurementService.confirmDelivery(poId, po.quantity);
      }
    }
    currentRun = await waitAndRefresh(run.id);
  }

  console.log("Final State:", currentRun.state);
  
  if (currentRun.state === "COMPLETED") {
    console.log("✅ Plan-to-Produce Test Passed!");
  } else {
    console.log("❌ Test Failed at state:", currentRun.state);
  }
}

runTest()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
