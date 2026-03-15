import { WorkflowState } from '@prisma/client';
import prisma from '../../lib/prisma';
import { orchestratorService } from '../../modules/orchestrator/orchestratorService';

const verbose = Boolean(process.env.INTEGRATION_VERBOSE);

export function log(msg: string): void {
  if (verbose) console.log(msg);
}

export async function waitForState(
  runId: string,
  desiredStates: WorkflowState[],
  timeoutMs = 15000
): Promise<{ id: string; state: WorkflowState; payload: unknown; approvals: unknown[] }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await orchestratorService.getWorkflowStatus(runId);
    if (!run) throw new Error('Run not found');
    if (desiredStates.includes(run.state)) {
      return run as { id: string; state: WorkflowState; payload: unknown; approvals: unknown[] };
    }
    if (run.state === WorkflowState.FAILED || run.state === WorkflowState.REJECTED) {
      const failEvent = await prisma.workflowEvent.findFirst({
        where: { workflowRunId: run.id, toState: WorkflowState.FAILED },
        orderBy: { occurredAt: 'desc' },
      });
      throw new Error(
        `Workflow stopped in ${run.state}. Error: ${JSON.stringify(failEvent?.metadata)}`
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const run = await orchestratorService.getWorkflowStatus(runId);
  throw new Error(
    `Timeout waiting for ${desiredStates.join(' or ')}. Current state: ${run?.state}`
  );
}

/**
 * Deletes all workflow runs, events, and approval gates so integration tests
 * start with a clean slate. Call before integration tests when using real DB.
 */
export async function cleanWorkflowDb(): Promise<void> {
  await prisma.approvalGate.deleteMany({});
  await prisma.workflowEvent.deleteMany({});
  await prisma.workflowRun.deleteMany({});
}
