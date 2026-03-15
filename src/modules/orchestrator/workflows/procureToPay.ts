import prisma from '@/lib/prisma';
import { orchestratorService } from '../orchestratorService';
import { WorkflowState } from '@prisma/client';

export async function dispatchProcureToPay(runId: string) {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { approvals: true }
  });
  if (!run) throw new Error(`Workflow run ${runId} not found`);

  try {
    switch (run.state) {
      case WorkflowState.INITIATED: {
        // Stub for further implementation
        break;
      }
      default:
        break;
    }
  } catch (error) {
    const e = error as Error;
    await orchestratorService.advanceState(runId, 'FAIL', { error: e.message });
  }
}
