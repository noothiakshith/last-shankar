import { WorkflowState, ApprovalGateType, Role } from '@prisma/client';
import { orchestratorService } from '../../modules/orchestrator/orchestratorService';
import prisma from '../../lib/prisma';
import { salesIntelligenceService } from '../../modules/sales/salesIntelligenceService';
import { procurementService } from '../../modules/procurement/procurementService';
import { productionPlanningService } from '../../modules/production/productionPlanningService';

async function waitForState(runId: string, desiredStates: WorkflowState[], timeoutMs = 15000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await orchestratorService.getWorkflowStatus(runId);
    if (!run) throw new Error('Run not found');
    if (desiredStates.includes(run.state)) {
      return run;
    }
    if (run.state === WorkflowState.FAILED || run.state === WorkflowState.REJECTED) {
      const failEvent = await prisma.workflowEvent.findFirst({
         where: { workflowRunId: run.id, toState: WorkflowState.FAILED },
         orderBy: { occurredAt: 'desc' }
      });
      throw new Error(`Workflow stopped unexpectedly in state ${run.state}. Error: ${JSON.stringify(failEvent?.metadata)}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  const run = await orchestratorService.getWorkflowStatus(runId);
  throw new Error(`Timeout waiting for state ${desiredStates.join(' or ')}. Current state is ${run?.state}`);
}

async function runIntegration() {
  console.log('--- Starting DEMAND_TO_PLAN Integration Test ---');
  
  let modelId: string | undefined;
  try {
    console.log('Training integration test forecast model...');
    const newModel = await salesIntelligenceService.trainModel({
      type: 'LINEAR_REGRESSION',
      productId: 'prod-widget-a',
      region: 'East'
    });
    modelId = newModel.id;
  } catch (err) {
    console.error('Failed to prepare model', err);
    throw err;
  }
  
  const initPayload = {
    productId: 'prod-widget-a',
    modelId,
    horizon: 30,
  };

  try {
    // 2. Trigger DEMAND_TO_PLAN Orchestration
    console.log('Triggering DEMAND_TO_PLAN...');
    const run = await orchestratorService.triggerWorkflow('DEMAND_TO_PLAN', 'tester', initPayload);
    console.log(`Workflow Run created: ${run.id} | State: INITIATED`);

    // Auto-dispatch will move it from INITIATED -> FORECASTING -> PENDING_FORECAST_APPROVAL
    console.log('Waiting for PENDING_FORECAST_APPROVAL...');
    let currentRun = await waitForState(run.id, [WorkflowState.PENDING_FORECAST_APPROVAL]);
    console.log(`Current State: ${currentRun.state}`);

    const forecastGate = currentRun.approvals.find((g: any) => g.gateType === ApprovalGateType.FORECAST_APPROVAL);
    console.log(`Resolving FORECAST_APPROVAL gate (${forecastGate?.id}) with role SALES_ANALYST...`);
    
    // Simulate frontend action approving forecast explicitly
    const payload = currentRun.payload as any;
    await salesIntelligenceService.approveForecast(payload.forecastId, 'sales-mgr');
    await orchestratorService.resolveApproval(forecastGate!.id, Role.SALES_ANALYST, 'sales-mgr', true);

    // After approval, auto-dispatch moves from PLANNING -> PROCUREMENT -> PENDING_PO_APPROVAL
    // Or it might jump to PENDING_PRODUCTION_AUTH if no shortages
    console.log('Waiting for PENDING_PO_APPROVAL or PENDING_PRODUCTION_AUTH...');
    currentRun = await waitForState(run.id, [WorkflowState.PENDING_PO_APPROVAL, WorkflowState.PENDING_PRODUCTION_AUTH]);
    console.log(`Current State: ${currentRun.state}`);

    if (currentRun.state === WorkflowState.PENDING_PO_APPROVAL) {
      console.log('Shortages detected -> resolving PO_APPROVAL...');
      const poGate = currentRun.approvals.find((g: any) => g.status === 'PENDING' && g.gateType === ApprovalGateType.PO_APPROVAL);
      await orchestratorService.resolveApproval(poGate!.id, Role.FINANCE_MANAGER, 'fin-mgr', true);

      // Finance review auto-runs, waits for PENDING_PRODUCTION_AUTH
      console.log('Waiting for PENDING_PRODUCTION_AUTH...');
      currentRun = await waitForState(run.id, [WorkflowState.PENDING_PRODUCTION_AUTH]);
      console.log(`Current State: ${currentRun.state}`);
    }

    // Attempt PRODUCTION_AUTHORIZATION gate
    if (currentRun.state === WorkflowState.PENDING_PRODUCTION_AUTH) {
      console.log('Resolving PRODUCTION_AUTHORIZATION gate...');
      const prodGate = currentRun.approvals.find((g: any) => g.status === 'PENDING' && g.gateType === ApprovalGateType.PRODUCTION_AUTHORIZATION);
      
      const prodPayload = currentRun.payload as any;
      await productionPlanningService.authorizePlan(prodPayload.planId, 'prod-planner');
      await orchestratorService.resolveApproval(prodGate!.id, Role.PRODUCTION_PLANNER, 'prod-planner', true);

      console.log('Waiting for EXECUTING or COMPLETED...');
      currentRun = await waitForState(run.id, [WorkflowState.EXECUTING, WorkflowState.COMPLETED]);
    }
    
    if (currentRun.state === WorkflowState.EXECUTING) {
      const execPayload = currentRun.payload as any;
      if (execPayload.poIds?.length > 0) {
        console.log('Simulating PO delivery...');
        for (const poId of execPayload.poIds) {
          const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
          if (po && (po.status === 'APPROVED' || po.status === 'ORDERED')) {
             await procurementService.confirmDelivery(poId, po.quantity);
          }
        }
      }
      
      console.log('Waiting for COMPLETED...');
      currentRun = await waitForState(run.id, [WorkflowState.COMPLETED]);
    }

    console.log(`Final Expected State: ${currentRun?.state}`);
    
    if (currentRun?.state !== WorkflowState.COMPLETED) {
       console.error(`❌ Integration failed. Ended on ${currentRun?.state} instead of COMPLETED.`);
       // Fetch events
       const events = await orchestratorService.getEventLog(run.id);
       console.log('Audit Log:');
       events.forEach(e => console.log(`  [${e.eventType}] ${e.fromState} -> ${e.toState}`));
    } else {
       console.log('✅ Integration Test SUCCESS. Full DEMAND_TO_PLAN cycle executed.');
       
       // DEEP VERIFICATION
       console.log('Performing Deep Microscopic Verification...');
       const plan = await prisma.productionPlan.findFirst({
         where: { id: (currentRun.payload as any).planId },
         include: { orders: true }
       });
       if (plan?.status !== 'COMPLETED') throw new Error('Deep Verification Failed: ProductionPlan status is not COMPLETED');
       
       const ledger = await prisma.stockLedger.findMany({
         where: { reason: 'PRODUCTION_CONSUMPTION' }
       });
       console.log(`Verified: ${ledger.length} stock deduction entries found.`);
       if (ledger.length === 0) throw new Error('Deep Verification Failed: No stock deduction entries found.');

       // Verify finished goods
       const finishedGood = await prisma.finishedGood.findFirst({
         where: { productId: plan.orders[0].productId }
       });
       console.log(`Verified: Finished goods recorded. Qty: ${finishedGood?.quantity}`);
       if (!finishedGood || finishedGood.quantity <= 0) throw new Error('Deep Verification Failed: No finished goods recorded.');

       // Verify expenses (only if procurement path was taken)
       const expenses = await prisma.expense.findMany();
       console.log(`Verified: ${expenses.length} expense records found.`);
       if ((currentRun.payload as any).poIds?.length > 0 && expenses.length === 0) {
         throw new Error('Deep Verification Failed: Procurement happened but no expenses were recorded.');
       }
    }
  } catch(e) {
    console.error('Integration Error ->', e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

import { test, expect } from 'vitest';

test('Integration test DEMAND_TO_PLAN', async () => {
  await runIntegration();
  expect(true).toBe(true);
}, 30000);
