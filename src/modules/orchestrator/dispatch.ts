import { WorkflowState, WorkflowType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { dispatchDemandToPlan } from './workflows/demandToPlan';
import { dispatchPlanToProduce } from './workflows/planToProduce';
import { dispatchProcureToPay } from './workflows/procureToPay';

export async function dispatchWorkflow(runId: string) {
  const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
  if (!run) return;

  try {
    if (run.type === 'DEMAND_TO_PLAN') {
      await dispatchDemandToPlan(run.id);
    } else if (run.type === 'PLAN_TO_PRODUCE') {
      await dispatchPlanToProduce(run.id);
    } else if (run.type === 'PROCURE_TO_PAY') {
      await dispatchProcureToPay(run.id);
    }
  } catch (error) {
    console.error(`Error dispatching workflow ${run.id}:`, error);
  }
}
