import { WorkflowState, ApprovalGateType, Role } from '@prisma/client';
import { orchestratorService } from '../../modules/orchestrator/orchestratorService';
import prisma from '../../lib/prisma';

async function runIntegration() {
  console.log('--- Starting DEMAND_TO_PLAN Integration Test ---');
  
  // 1. Ensure minimal seeded data exists for testing
  const { salesIntelligenceService } = await import('../../modules/sales/salesIntelligenceService');

  let modelId: string | undefined;
  
  try {
    const models = await salesIntelligenceService.getLeaderboard();
    if (models.length > 0) {
      modelId = models[0].id;
    } else {
      console.log('Training integration test forecast model...');
      const newModel = await salesIntelligenceService.trainModel({
        type: 'LINEAR_REGRESSION',
        productId: 'prod-widget-a',
        region: 'East'
      });
      modelId = newModel.id;
    }
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

    // Advance to Forecasting -> Request forecast approval
    // Note: dispatchDemandToPlan is technically what drives the logic loop inside API endpoints, but for testing,
    // wait we need to explicitly invoke the event transitions simulating system crons/events.
    console.log('Invoking dispatch module logic (Simulating chron/webhook)...');
    const { dispatchDemandToPlan } = await import('../../modules/orchestrator/workflows/demandToPlan');
    await dispatchDemandToPlan(run.id);
    
    // Validate State is now PENDING_FORECAST_APPROVAL
    let currentRun = await orchestratorService.getWorkflowStatus(run.id);
    console.log(`Current State: ${currentRun?.state}`);
    
    if (currentRun?.state !== WorkflowState.PENDING_FORECAST_APPROVAL) {
      const failEvent = await prisma.workflowEvent.findFirst({
         where: { workflowRunId: run.id, toState: WorkflowState.FAILED },
         orderBy: { occurredAt: 'desc' }
      });
      throw new Error(`Expected State PENDING_FORECAST_APPROVAL but got ${currentRun?.state}. Error: ${JSON.stringify(failEvent?.metadata)}`);
    }

    const forecastGate = currentRun.approvals.find(g => g.gateType === ApprovalGateType.FORECAST_APPROVAL);
    console.log(`Resolving FORECAST_APPROVAL gate (${forecastGate?.id}) with role SALES_ANALYST...`);
    
    // Simulate frontend action approving forecast explicitly
    const payload = currentRun.payload as any;
    const { salesIntelligenceService } = await import('../../modules/sales/salesIntelligenceService');
    await salesIntelligenceService.approveForecast(payload.forecastId, 'sales-mgr');
    await orchestratorService.resolveApproval(forecastGate!.id, Role.SALES_ANALYST, 'sales-mgr', true);

    currentRun = await orchestratorService.getWorkflowStatus(run.id);
    console.log(`Current State post-approval: ${currentRun?.state}`);

    // Call dispatch mapped to PLANNING state
    console.log('Invoking dispatch logic for PLANNING phase (MRP)...');
    await dispatchDemandToPlan(run.id);

    currentRun = await orchestratorService.getWorkflowStatus(run.id);
    console.log(`Current State post-MRP: ${currentRun?.state}`);
    
    if (currentRun?.state === WorkflowState.FAILED) {
      const failEvent = await prisma.workflowEvent.findFirst({
         where: { workflowRunId: run.id, toState: WorkflowState.FAILED },
         orderBy: { occurredAt: 'desc' }
      });
      console.log(`Failed during PLANNING: ${JSON.stringify(failEvent?.metadata)}`);
    }

    if (currentRun?.state === WorkflowState.PENDING_PO_APPROVAL) {
      console.log('Shortages detected -> resolving PO_APPROVAL...');
      const poGate = currentRun.approvals.find(g => g.gateType === ApprovalGateType.PO_APPROVAL);
      await orchestratorService.resolveApproval(poGate!.id, Role.FINANCE_MANAGER, 'fin-mgr', true);

      // Now it hits FINANCE_REVIEW. Call dispatch to run automated budget validation.
      console.log('Invoking dispatch logic for FINANCE review process...');
      await dispatchDemandToPlan(run.id);
      currentRun = await orchestratorService.getWorkflowStatus(run.id);
      
      console.log(`Current State post-Finance: ${currentRun?.state}`);
    } else {
      console.log('No shortages detected, jumped straight to PENDING_PRODUCTION_AUTH.');
    }

    // Attempt PRODUCTION_AUTHORIZATION gate
    if (currentRun?.state === WorkflowState.PENDING_PRODUCTION_AUTH) {
      console.log('Resolving PRODUCTION_AUTHORIZATION gate...');
      const prodGate = currentRun.approvals.find(g => g.status === 'PENDING' && g.gateType === ApprovalGateType.PRODUCTION_AUTHORIZATION);
      
      const payload = currentRun.payload as any;
      const { productionPlanningService } = await import('../../modules/production/productionPlanningService');
      await productionPlanningService.authorizePlan(payload.planId, 'prod-planner');
      
      await orchestratorService.resolveApproval(prodGate!.id, Role.PRODUCTION_PLANNER, 'prod-planner', true);

      // It hits EXECUTING. Call dispatch resolving the last step
      console.log('Invoking final EXECUTING dispatch logic...');
      await dispatchDemandToPlan(run.id);
    }
    
    currentRun = await orchestratorService.getWorkflowStatus(run.id);
    console.log(`Final Expected State: ${currentRun?.state}`);
    
    if (currentRun?.state !== WorkflowState.COMPLETED) {
       console.error(`❌ Integration failed. Ended on ${currentRun?.state} instead of COMPLETED.`);
       // Fetch events
       const events = await orchestratorService.getEventLog(run.id);
       console.log('Audit Log:');
       events.forEach(e => console.log(`  [${e.eventType}] ${e.fromState} -> ${e.toState}`));
    } else {
       console.log('✅ Integration Test SUCCESS. Full DEMAND_TO_PLAN cycle executed.');
    }
    
  } catch(e) {
    console.error('Integration Error ->', e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

runIntegration();
