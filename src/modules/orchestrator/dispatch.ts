import { WorkflowState, WorkflowType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { dispatchDemandToPlan } from './workflows/demandToPlan';
import { dispatchPlanToProduce } from './workflows/planToProduce';
import { dispatchProcureToPay } from './workflows/procureToPay';

// Mutex to prevent concurrent workflow dispatches
const workflowLocks = new Map<string, Promise<void>>();

export async function dispatchWorkflow(runId: string) {
  // Check if workflow is already being dispatched
  if (workflowLocks.has(runId)) {
    console.log(`[Dispatch] Workflow ${runId} is already being processed, skipping duplicate dispatch`);
    return workflowLocks.get(runId);
  }

  // Create a lock for this workflow
  const dispatchPromise = (async () => {
    try {
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
    } finally {
      // Release the lock
      workflowLocks.delete(runId);
    }
  })();

  workflowLocks.set(runId, dispatchPromise);
  return dispatchPromise;
}
