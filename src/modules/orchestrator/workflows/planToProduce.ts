/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma';
import { orchestratorService } from '../orchestratorService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { procurementService } from '@/modules/procurement/procurementService';
import { validateBudget, approvePO, rejectPO } from '@/modules/finance/financeService';
import { WorkflowState, ApprovalGateType, Role, ProductionPlanStatus } from '@prisma/client';

/**
 * PLAN_TO_PRODUCE workflow: takes an existing ProductionPlan (planId in payload)
 * and runs it through shortage detection → procurement (if needed) → PO approval
 * → production authorization → execution (record finished goods).
 * Reuses the same state machine as DEMAND_TO_PLAN but skips forecasting and MRP.
 */
export async function dispatchPlanToProduce(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { approvals: true }
  });
  if (!run) throw new Error(`Workflow run ${runId} not found`);
  if (run.type !== 'PLAN_TO_PRODUCE') return;

  const payload = (run.payload as Record<string, unknown>) || {};

  try {
    switch (run.state) {
      case WorkflowState.INITIATED: {
        const planId = payload.planId as string | undefined;
        if (!planId) throw new Error('PLAN_TO_PRODUCE requires planId in payload');

        const plan = await prisma.productionPlan.findUnique({
          where: { id: planId },
          include: { orders: true }
        });
        if (!plan) throw new Error(`Production plan ${planId} not found`);
        if (plan.orders.length === 0) throw new Error(`Production plan ${planId} has no orders`);

        await orchestratorService.advanceState(run.id, 'START_PLANNING');
        break;
      }

      case WorkflowState.PLANNING: {
        const planId = payload.planId as string | undefined;
        if (!planId) throw new Error('Missing planId in PLAN_TO_PRODUCE');

        const shortageReport = await inventoryService.detectShortages(planId);

        if (shortageReport.shortages && shortageReport.shortages.length > 0) {
          await orchestratorService.advanceState(run.id, 'START_PROCUREMENT');
        } else {
          await prisma.productionPlan.update({
            where: { id: planId },
            data: { status: ProductionPlanStatus.PENDING_AUTHORIZATION }
          });
          await orchestratorService.advanceState(run.id, 'REQUEST_PRODUCTION_AUTH');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PRODUCTION_AUTHORIZATION, Role.PRODUCTION_PLANNER);
        }
        break;
      }

      case WorkflowState.PROCUREMENT: {
        const planId = payload.planId as string;
        if (!planId) throw new Error('Missing planId in PROCUREMENT');
        const shortageReport = await inventoryService.detectShortages(planId);

        let totalCost = 0;
        const poIds: string[] = [];

        for (const shortage of shortageReport.shortages) {
          const suppliers = await procurementService.findSuppliers(shortage.materialId);
          if (suppliers.length === 0) throw new Error(`No supplier found for material ${shortage.materialId}`);

          suppliers.sort((a, b) => {
            if (a.unitCost !== b.unitCost) return a.unitCost - b.unitCost;
            return a.leadTimeDays - b.leadTimeDays;
          });

          const bestSupplier = suppliers[0];
          const amount = Math.abs(shortage.deficit);

          const po = await procurementService.createPurchaseOrder({
            supplierId: bestSupplier.id,
            materialId: shortage.materialId,
            quantity: amount,
            unitCost: bestSupplier.unitCost
          });
          await procurementService.submitPOForApproval(po.id);
          poIds.push(po.id);
          totalCost += amount * bestSupplier.unitCost;
        }

        const updatedPayload = { ...payload, totalPlannedCost: totalCost, poIds };
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { payload: updatedPayload as any }
        });

        await orchestratorService.advanceState(run.id, 'REQUEST_PO_APPROVAL');
        await orchestratorService.requestApproval(run.id, ApprovalGateType.PO_APPROVAL, Role.FINANCE_MANAGER);
        break;
      }

      case WorkflowState.FINANCE_REVIEW: {
        const totalPlannedCost = (payload.totalPlannedCost as number) || 0;
        const budgetAllowed = await validateBudget(totalPlannedCost, 'PROCUREMENT');
        const poIds = (payload.poIds as string[]) || [];
        const planId = payload.planId as string;

        if (budgetAllowed) {
          for (const poId of poIds) {
            await approvePO(poId, run.triggeredBy);
          }
          await prisma.productionPlan.update({
            where: { id: planId },
            data: { status: ProductionPlanStatus.PENDING_AUTHORIZATION }
          });
          await orchestratorService.advanceState(run.id, 'APPROVE_FINANCE');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PRODUCTION_AUTHORIZATION, Role.PRODUCTION_PLANNER);
        } else {
          for (const poId of poIds) {
            await rejectPO(poId, run.triggeredBy);
          }
          await orchestratorService.advanceState(run.id, 'REJECT_FINANCE');
        }
        break;
      }

      case WorkflowState.EXECUTING: {
        const planId = payload.planId as string;
        if (!planId) throw new Error('Missing planId in EXECUTING');

        const poIds = (payload.poIds as string[]) || [];
        let allDelivered = true;
        for (const poId of poIds) {
          const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
          if (po && po.status !== 'DELIVERED') {
            allDelivered = false;
            // Only move to ORDERED if still in APPROVED to avoid overwriting concurrent DELIVERED status
            if (po.status === 'APPROVED') {
              await prisma.purchaseOrder.updateMany({
                where: { id: poId, status: 'APPROVED' },
                data: { status: 'ORDERED' }
              });
            }
          }
        }

        if (!allDelivered) {
          break;
        }

        const plan = await prisma.productionPlan.findUnique({
          where: { id: planId },
          include: { orders: true }
        });

        if (plan && Array.isArray(plan.orders)) {
          for (const order of plan.orders) {
            await inventoryService.recordFinishedGoods(order.productId, order.requiredQty);
            await prisma.productionOrder.update({
              where: { id: order.id },
              data: { status: 'COMPLETED' }
            });
          }
        }

        await prisma.productionPlan.update({
          where: { id: planId },
          data: { status: 'COMPLETED' }
        });

        const current = await prisma.workflowRun.findUnique({ where: { id: run.id } });
        if (current?.state === WorkflowState.EXECUTING) {
          await orchestratorService.advanceState(run.id, 'COMPLETE');
        }
        break;
      }

      default:
        break;
    }
  } catch (error) {
    const e = error as Error;
    console.error('PLAN_TO_PRODUCE dispatch error:', e);
    try {
      const currentRun = await prisma.workflowRun.findUnique({ where: { id: runId } });
      if (currentRun && currentRun.state !== WorkflowState.FAILED && currentRun.state !== WorkflowState.REJECTED) {
        await orchestratorService.advanceState(runId, 'FAIL', { error: e.message });
      }
    } catch (failErr) {
      console.error('Failed to set FAIL state:', failErr);
    }
  }
}
