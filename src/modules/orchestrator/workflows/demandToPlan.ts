import prisma from '@/lib/prisma';
import { orchestratorService } from '../orchestratorService';
import { salesIntelligenceService as salesService } from '@/modules/sales/salesIntelligenceService';
import { productionPlanningService } from '@/modules/production/productionPlanningService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { procurementService } from '@/modules/procurement/procurementService';
import { validateBudget } from '@/modules/finance/financeService';
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

        if (shortageReport.shortages && shortageReport.shortages.length > 0) {
          await orchestratorService.advanceState(run.id, 'START_PROCUREMENT');
          
          let totalCost = 0;

          for (const shortage of shortageReport.shortages) {
            const suppliers = await procurementService.findSuppliers(shortage.materialId);
            if (suppliers.length === 0) throw new Error(`No supplier found for material ${shortage.materialId}`);
            
            const bestSupplier = suppliers[0];
            const amount = Math.abs(shortage.deficit);
            
            const po = await procurementService.createPurchaseOrder({
              supplierId: bestSupplier.id,
              materialId: shortage.materialId,
              quantity: amount,
              unitCost: bestSupplier.unitCost
            });
            await procurementService.submitPOForApproval(po.id);

            totalCost += amount * bestSupplier.unitCost;
          }

          payload.totalPlannedCost = totalCost;
          await prisma.workflowRun.update({
            where: { id: run.id },
            data: { payload: payload as unknown as any }
          });

          await orchestratorService.advanceState(run.id, 'REQUEST_PO_APPROVAL');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PO_APPROVAL, Role.FINANCE_MANAGER);
          
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

      case WorkflowState.FINANCE_REVIEW: {
        const totalPlannedCost = (payload.totalPlannedCost as number) || 0;
        const budgetAllowed = await validateBudget(totalPlannedCost as number, 'PROCUREMENT');
        
        if (budgetAllowed) {
          await prisma.productionPlan.update({
            where: { id: payload.planId as string },
            data: { status: ProductionPlanStatus.PENDING_AUTHORIZATION }
          });
          await orchestratorService.advanceState(run.id, 'APPROVE_FINANCE');
          await orchestratorService.requestApproval(run.id, ApprovalGateType.PRODUCTION_AUTHORIZATION, Role.PRODUCTION_PLANNER);
        } else {
          await orchestratorService.advanceState(run.id, 'REJECT_FINANCE');
        }
        break;
      }

      case WorkflowState.EXECUTING: {
        if (!payload.planId) throw new Error('Missing planId in EXECUTING');
        const planId = payload.planId as string;
        
        const plan = await prisma.productionPlan.findUnique({ 
          where: { id: planId }, 
          include: { orders: true } 
        });

        if (plan && 'orders' in plan && Array.isArray(plan.orders)) {
          for (const order of plan.orders) {
            await inventoryService.recordFinishedGoods(order.productId, order.requiredQty);
          }
        }
        
        await orchestratorService.advanceState(run.id, 'COMPLETE');
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
      await orchestratorService.advanceState(runId, 'FAIL', { error: e.message });
    } catch (failErr) {
      console.error('Failed to set FAIL state because:', failErr);
    }
  }
}
