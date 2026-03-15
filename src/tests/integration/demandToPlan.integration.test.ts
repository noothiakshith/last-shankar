import { WorkflowState, ApprovalGateType, Role } from '@prisma/client';
import { orchestratorService } from '../../modules/orchestrator/orchestratorService';
import prisma from '../../lib/prisma';
import { salesIntelligenceService } from '../../modules/sales/salesIntelligenceService';
import { procurementService } from '../../modules/procurement/procurementService';
import { productionPlanningService } from '../../modules/production/productionPlanningService';
import { log, waitForState, cleanWorkflowDb } from './helpers';
import { dispatchWorkflow } from '../../modules/orchestrator/dispatch';

async function runDemandToPlanIntegration() {
  log('--- Starting DEMAND_TO_PLAN Integration Test ---');

  let modelId: string | undefined;
  try {
    log('Training integration test forecast model...');
    const newModel = await salesIntelligenceService.trainModel({
      type: 'LINEAR_REGRESSION',
      productId: 'prod-widget-a',
      region: 'East',
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
    log('Triggering DEMAND_TO_PLAN...');
    const run = await orchestratorService.triggerWorkflow('DEMAND_TO_PLAN', 'tester', initPayload);
    log(`Workflow Run created: ${run.id} | State: INITIATED`);

    log('Waiting for PENDING_FORECAST_APPROVAL...');
    let currentRun = await waitForState(run.id, [WorkflowState.PENDING_FORECAST_APPROVAL]);
    log(`Current State: ${currentRun.state}`);

    const forecastGate = (currentRun.approvals as any[]).find(
      (g: { gateType: string }) => g.gateType === ApprovalGateType.FORECAST_APPROVAL
    );
    log(`Resolving FORECAST_APPROVAL gate (${(forecastGate as { id: string })?.id})...`);

    const payload = currentRun.payload as { forecastId: string };
    await salesIntelligenceService.approveForecast(payload.forecastId, 'sales-mgr');
    await orchestratorService.resolveApproval(
      (forecastGate as { id: string }).id,
      Role.SALES_ANALYST,
      'sales-mgr',
      true
    );

    log('Waiting for PENDING_PO_APPROVAL or PENDING_PRODUCTION_AUTH...');
    currentRun = await waitForState(run.id, [
      WorkflowState.PENDING_PO_APPROVAL,
      WorkflowState.PENDING_PRODUCTION_AUTH,
    ]);
    log(`Current State: ${currentRun.state}`);

    if (currentRun.state === WorkflowState.PENDING_PO_APPROVAL) {
      log('Shortages detected -> resolving PO_APPROVAL...');
      const poGate = (currentRun.approvals as any[]).find(
        (g: { status: string; gateType: string }) =>
          g.status === 'PENDING' && g.gateType === ApprovalGateType.PO_APPROVAL
      );
      await orchestratorService.resolveApproval(
        (poGate as { id: string }).id,
        Role.FINANCE_MANAGER,
        'fin-mgr',
        true
      );
      log('Waiting for PENDING_PRODUCTION_AUTH...');
      currentRun = await waitForState(run.id, [WorkflowState.PENDING_PRODUCTION_AUTH]);
      log(`Current State: ${currentRun.state}`);
    }

    if (currentRun.state === WorkflowState.PENDING_PRODUCTION_AUTH) {
      log('Resolving PRODUCTION_AUTHORIZATION gate...');
      const prodGate = (currentRun.approvals as any[]).find(
        (g: { status: string; gateType: string }) =>
          g.status === 'PENDING' && g.gateType === ApprovalGateType.PRODUCTION_AUTHORIZATION
      );
      const prodPayload = currentRun.payload as { planId: string };
      await productionPlanningService.authorizePlan(prodPayload.planId, 'prod-planner');
      await orchestratorService.resolveApproval(
        (prodGate as { id: string }).id,
        Role.PRODUCTION_PLANNER,
        'prod-planner',
        true
      );
      log('Waiting for EXECUTING or COMPLETED...');
      currentRun = await waitForState(run.id, [WorkflowState.EXECUTING, WorkflowState.COMPLETED]);
    }

    if (currentRun.state === WorkflowState.EXECUTING) {
      const execPayload = currentRun.payload as { poIds?: string[] };
      if (execPayload.poIds?.length) {
        log('Simulating PO delivery...');
        for (const poId of execPayload.poIds) {
          const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
          if (po && (po.status === 'APPROVED' || po.status === 'ORDERED')) {
            await procurementService.confirmDelivery(poId, po.quantity);
          }
        }
      }
      await dispatchWorkflow(run.id);
      log('Waiting for COMPLETED...');
      currentRun = await waitForState(run.id, [WorkflowState.COMPLETED]);
    }

    if (currentRun.state !== WorkflowState.COMPLETED) {
      console.error(`❌ DEMAND_TO_PLAN failed. Ended on ${currentRun.state}`);
      const events = await orchestratorService.getEventLog(run.id);
      events.forEach((e: { eventType: string; fromState: string; toState: string }) =>
        log(`  [${e.eventType}] ${e.fromState} -> ${e.toState}`)
      );
      throw new Error(`Expected COMPLETED, got ${currentRun.state}`);
    }

    log('✅ DEMAND_TO_PLAN SUCCESS.');

    const plan = await prisma.productionPlan.findFirst({
      where: { id: (currentRun.payload as { planId: string }).planId },
      include: { orders: true },
    });
    if (plan?.status !== 'COMPLETED')
      throw new Error('Deep Verification: ProductionPlan status is not COMPLETED');

    const ledger = await prisma.stockLedger.count({
      where: { reason: 'PRODUCTION_CONSUMPTION' },
    });
    if (ledger === 0) throw new Error('Deep Verification: No stock deduction entries.');

    const finishedGood = await prisma.finishedGood.findFirst({
      where: { productId: plan!.orders[0].productId },
    });
    if (!finishedGood || finishedGood.quantity <= 0)
      throw new Error('Deep Verification: No finished goods recorded.');

    const execPayload = currentRun.payload as { poIds?: string[] };
    if (execPayload.poIds?.length) {
      const expenses = await prisma.expense.count();
      if (expenses === 0)
        throw new Error('Deep Verification: Procurement path but no expenses.');
    }
  } catch (e) {
    console.error('Integration Error ->', e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

async function runPlanToProduceIntegration() {
  log('--- Starting PLAN_TO_PRODUCE Integration Test ---');

  let modelId: string | undefined;
  try {
    log('Training model for forecast...');
    const newModel = await salesIntelligenceService.trainModel({
      type: 'LINEAR_REGRESSION',
      productId: 'prod-widget-a',
      region: 'East',
    });
    modelId = newModel.id;
  } catch (err) {
    console.error('Failed to prepare model', err);
    throw err;
  }

  const forecast = await salesIntelligenceService.runForecast(modelId!, 30);
  await prisma.forecastResult.update({
    where: { id: forecast.id },
    data: { status: 'PENDING_APPROVAL' },
  });
  await salesIntelligenceService.approveForecast(forecast.id, 'sales-mgr');
  const plan = await productionPlanningService.runMRP(forecast.id);
  const planId = plan.id;

  try {
    log(`Triggering PLAN_TO_PRODUCE with planId: ${planId}`);
    const run = await orchestratorService.triggerWorkflow('PLAN_TO_PRODUCE', 'tester', {
      planId,
    });
    log(`Workflow Run created: ${run.id} | State: INITIATED`);

    log('Waiting for PENDING_PO_APPROVAL or PENDING_PRODUCTION_AUTH...');
    let currentRun = await waitForState(run.id, [
      WorkflowState.PENDING_PO_APPROVAL,
      WorkflowState.PENDING_PRODUCTION_AUTH,
    ]);
    log(`Current State: ${currentRun.state}`);

    if (currentRun.state === WorkflowState.PENDING_PO_APPROVAL) {
      log('Resolving PO_APPROVAL...');
      const poGate = (currentRun.approvals as any[]).find(
        (g: { status: string; gateType: string }) =>
          g.status === 'PENDING' && g.gateType === ApprovalGateType.PO_APPROVAL
      );
      await orchestratorService.resolveApproval(
        (poGate as { id: string }).id,
        Role.FINANCE_MANAGER,
        'fin-mgr',
        true
      );
      log('Waiting for PENDING_PRODUCTION_AUTH...');
      currentRun = await waitForState(run.id, [WorkflowState.PENDING_PRODUCTION_AUTH]);
    }

    if (currentRun.state === WorkflowState.PENDING_PRODUCTION_AUTH) {
      log('Resolving PRODUCTION_AUTHORIZATION...');
      const prodGate = (currentRun.approvals as any[]).find(
        (g: { status: string; gateType: string }) =>
          g.status === 'PENDING' && g.gateType === ApprovalGateType.PRODUCTION_AUTHORIZATION
      );
      const prodPayload = currentRun.payload as { planId: string };
      await productionPlanningService.authorizePlan(prodPayload.planId, 'prod-planner');
      await orchestratorService.resolveApproval(
        (prodGate as { id: string }).id,
        Role.PRODUCTION_PLANNER,
        'prod-planner',
        true
      );
      currentRun = await waitForState(run.id, [WorkflowState.EXECUTING, WorkflowState.COMPLETED]);
    }

    if (currentRun.state === WorkflowState.EXECUTING) {
      const execPayload = currentRun.payload as { poIds?: string[] };
      if (execPayload.poIds?.length) {
        log('Simulating PO delivery...');
        for (const poId of execPayload.poIds) {
          const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
          if (po && (po.status === 'APPROVED' || po.status === 'ORDERED')) {
            await procurementService.confirmDelivery(poId, po.quantity);
          }
        }
      }
      await dispatchWorkflow(run.id);
      log('Waiting for COMPLETED...');
      currentRun = await waitForState(run.id, [WorkflowState.COMPLETED]);
    }

    if (currentRun.state !== WorkflowState.COMPLETED) {
      console.error(`❌ PLAN_TO_PRODUCE failed. Ended on ${currentRun.state}`);
      throw new Error(`Expected COMPLETED, got ${currentRun.state}`);
    }

    log('✅ PLAN_TO_PRODUCE SUCCESS.');

    const planRecord = await prisma.productionPlan.findUnique({
      where: { id: planId },
      include: { orders: true },
    });
    if (planRecord?.status !== 'COMPLETED')
      throw new Error('Verification: ProductionPlan status is not COMPLETED');
  } catch (e) {
    console.error('PLAN_TO_PRODUCE Integration Error ->', e);
    throw e;
  } finally {
    await prisma.$disconnect();
  }
}

import { test, expect, beforeAll, beforeEach, describe } from 'vitest';

const hasDatabase = Boolean(
  process.env.DATABASE_URL &&
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.includes('postgres')
);

describe.skipIf(!hasDatabase)('Workflow Integration Tests', () => {
  beforeEach(async () => {
    await cleanWorkflowDb();
  });

  test('Integration test DEMAND_TO_PLAN', async () => {
    await runDemandToPlanIntegration();
    expect(true).toBe(true);
  }, 30000);

  test('Integration test PLAN_TO_PRODUCE', async () => {
    await runPlanToProduceIntegration();
    expect(true).toBe(true);
  }, 30000);
});
