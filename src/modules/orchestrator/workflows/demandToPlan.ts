/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@/lib/prisma';
import { orchestratorService } from '../orchestratorService';
import { salesIntelligenceService as salesService } from '@/modules/sales/salesIntelligenceService';
import { productionPlanningService } from '@/modules/production/productionPlanningService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { procurementService } from '@/modules/procurement/procurementService';
import { validateBudget, approvePO, rejectPO } from '@/modules/finance/financeService';
import { hrService } from '@/modules/hr/hrService';
import { WorkflowState, ApprovalGateType, Role, ProductionPlanStatus } from '@prisma/client';

export async function dispatchDemandToPlan(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { approvals: true }
  });
  if (!run) throw new Error(`Workflow run ${runId} not found`);

  const payload = (run.payload as Record<string, unknown>) || {};

  try {
    switch (run.state) {
      case WorkflowState.INITIATED: {
        await orchestratorService.advanceState(run.id, 'START_FORECASTING');
        
        let modelId = payload.modelId as string | undefined;
        if (!modelId) {
          const models = await salesService.getLeaderboard();
          if (models.length > 0) {
            modelId = models[0].id;
          } else {
            const fallback = await prisma.trainedModel.findFirst();
            if (!fallback) throw new Error("No TrainedModel available to generate forecast");
            modelId = fallback.id;
          }
        }

        const horizon = (payload.horizon as number) || 30;
        const forecast = await salesService.runForecast(modelId, horizon);
        
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { payload: { ...payload, forecastId: forecast.id } }
        });

        await orchestratorService.advanceState(run.id, 'REQUEST_FORECAST_APPROVAL');
        await salesService.submitForecastForApproval(forecast.id, run.id);
        break;
      }
      
      case WorkflowState.PLANNING: {
        if (!payload.forecastId) throw new Error('Missing forecastId');
        const forecastId = payload.forecastId as string;
        
        const plan = await productionPlanningService.runMRP(forecastId);
        
        payload.planId = plan.id;
        await prisma.workflowRun.update({
          where: { id: run.id },
          data: { payload: payload as unknown as any }
        });

        const shortageReport = await inventoryService.detectShortages(plan.id);
        
        // AI Optimization: Automatically allocate the least busy production staff
        try {
          const optimalStaff = await hrService.getLeastBusyEmployee('Production');
          if (optimalStaff) {
            await hrService.allocateToWorkflow(optimalStaff.id, run.id);
            console.log(`AI Staffing: Allocated ${optimalStaff.name} to workflow ${run.id}`);
          }
        } catch (e) {
          console.error("AI Staffing failed, but continuing workflow:", e);
        }

        if (shortageReport.shortages && shortageReport.shortages.length > 0) {
          await orchestratorService.advanceState(run.id, 'START_PROCUREMENT');
        } else {
          await prisma.productionPlan.update({
            where: { id: plan.id },
            data: { status: ProductionPlanStatus.PENDING_AUTHORIZATION }
          });
          await orchestratorService.advanceState(run.id, 'REQUEST_PRODUCTION_AUTH');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PRODUCTION_AUTHORIZATION, Role.PRODUCTION_PLANNER);
        }
        break;
      }

      case WorkflowState.PROCUREMENT: {
        if (!payload.planId) throw new Error('Missing planId in PROCUREMENT');
        const planId = payload.planId as string;
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
        const budgetAllowed = await validateBudget(totalPlannedCost as number, 'PROCUREMENT');
        const poIds = (payload.poIds as string[]) || [];
        
        if (budgetAllowed) {
          for (const poId of poIds) {
            const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
            if (po && po.status === 'PENDING_APPROVAL') {
              await approvePO(poId, run.triggeredBy);
            }
          }
          await prisma.productionPlan.update({
            where: { id: payload.planId as string },
            data: { status: ProductionPlanStatus.PENDING_AUTHORIZATION }
          });
          await orchestratorService.advanceState(run.id, 'APPROVE_FINANCE');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PRODUCTION_AUTHORIZATION, Role.PRODUCTION_PLANNER);
        } else {
          for (const poId of poIds) {
            const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
            if (po && po.status === 'PENDING_APPROVAL') {
              await rejectPO(poId, run.triggeredBy);
            }
          }
          await orchestratorService.advanceState(run.id, 'REJECT_FINANCE');
        }
        break;
      }

      case WorkflowState.EXECUTING: {
        if (!payload.planId) throw new Error('Missing planId in EXECUTING');
        const planId = payload.planId as string;

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
          console.log(`Workflow ${run.id} waiting for POs to be delivered...`);
          break; // Stay in EXECUTING state until materials arrive
        }
        
        const plan = await prisma.productionPlan.findUnique({ 
          where: { id: planId }, 
          include: { orders: true } 
        });

        if (plan && 'orders' in plan && Array.isArray(plan.orders)) {
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
    console.error('CRITICAL DISPATCH ERROR:', e);
    
    // Attempt to fail the workflow but catch any secondary errors (e.g. pending gates)
    try {
      const currentRun = await prisma.workflowRun.findUnique({ where: { id: runId } });
      if (currentRun && currentRun.state !== WorkflowState.FAILED && currentRun.state !== WorkflowState.REJECTED) {
        await orchestratorService.advanceState(runId, 'FAIL', { error: e.message });
      }
    } catch (failErr) {
      console.error('Failed to set FAIL state because:', failErr);
    }
  }
}
