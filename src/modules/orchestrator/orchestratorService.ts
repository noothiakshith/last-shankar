import prisma from '@/lib/prisma';
import { WorkflowState, WorkflowType, Role, ApprovalGateType, ApprovalStatus, Prisma } from '@prisma/client';
import { getNextState, WorkflowEventTrigger } from './stateMachine';

export class OrchestratorService {
  async triggerWorkflow(type: WorkflowType, triggeredBy: string, payload: Prisma.InputJsonValue) {
    const run = await prisma.workflowRun.create({
      data: {
        type,
        state: WorkflowState.INITIATED,
        payload,
        triggeredBy,
      }
    });

    await prisma.workflowEvent.create({
      data: {
        workflowRunId: run.id,
        eventType: 'TRIGGERED',
        fromState: 'NONE',
        toState: WorkflowState.INITIATED,
      }
    });

    if (typeof process !== 'undefined' && process.nextTick) {
      process.nextTick(() => {
        import('./dispatch').then(m => m.dispatchWorkflow(run.id).catch(console.error));
      });
    }

    return run;
  }

  async advanceState(runId: string, event: WorkflowEventTrigger, metadata?: Prisma.InputJsonValue) {
    try {
      const run = await prisma.workflowRun.findUniqueOrThrow({ 
        where: { id: runId }, 
        include: { approvals: true } 
      });
      
      const pendingGates = run.approvals.filter(gate => gate.status === ApprovalStatus.PENDING);
      if (pendingGates.length > 0) {
        throw new Error("Cannot advance workflow: pending approval gates.");
      }

      const nextState = getNextState(run.state, event);

      const updatedRun = await prisma.workflowRun.update({
        where: { id: runId },
        data: { state: nextState }
      });

      await prisma.workflowEvent.create({
        data: {
          workflowRunId: runId,
          eventType: event,
          fromState: run.state,
          toState: nextState,
          metadata: metadata || Prisma.JsonNull
        }
      });

      if (typeof process !== 'undefined' && process.nextTick) {
        process.nextTick(() => {
          import('./dispatch').then(m => m.dispatchWorkflow(runId).catch(console.error));
        });
      }

      return updatedRun;
    } catch (error) {
      const e = error as Error;
      const run = await prisma.workflowRun.findUnique({ where: { id: runId } });
      if (run && run.state !== WorkflowState.FAILED) {
        await prisma.workflowRun.update({
          where: { id: runId },
          data: { state: WorkflowState.FAILED }
        });
        await prisma.workflowEvent.create({
          data: {
            workflowRunId: runId,
            eventType: 'ERROR',
            fromState: run.state,
            toState: WorkflowState.FAILED,
            metadata: { error: e.message || 'Unknown error' }
          }
        });
      }
      throw error;
    }
  }

  async requestApproval(runId: string, gateType: ApprovalGateType, requiredRole: Role) {
    return prisma.approvalGate.create({
      data: {
        workflowRunId: runId,
        gateType,
        requiredRole,
        status: ApprovalStatus.PENDING
      }
    });
  }

  async resolveApproval(gateId: string, resolverRole: Role, resolverId: string, approved: boolean) {
    const gate = await prisma.approvalGate.findUniqueOrThrow({ 
      where: { id: gateId }, 
      include: { workflowRun: true } 
    });
    
    if (resolverRole !== gate.requiredRole && resolverRole !== Role.ADMIN) {
      throw new Error(`Forbidden: Role ${resolverRole} cannot resolve ${gate.requiredRole} gates`);
    }

    const status = approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;

    const updatedGate = await prisma.approvalGate.update({
      where: { id: gateId },
      data: {
        status,
        resolvedBy: resolverId,
        resolvedAt: new Date()
      }
    });

    let eventTrigger: WorkflowEventTrigger | null = null;
    
    if (gate.gateType === ApprovalGateType.FORECAST_APPROVAL) {
      eventTrigger = approved ? 'APPROVE_FORECAST' : 'REJECT_FORECAST';
    } else if (gate.gateType === ApprovalGateType.PO_APPROVAL) {
      eventTrigger = approved ? 'APPROVE_PO' : 'REJECT_PO';
    } else if (gate.gateType === ApprovalGateType.PRODUCTION_AUTHORIZATION) {
      eventTrigger = approved ? 'APPROVE_PRODUCTION' : 'REJECT_PRODUCTION';
    }

    if (eventTrigger) {
      await this.advanceState(gate.workflowRun.id, eventTrigger);
    }

    return updatedGate;
  }

  async getWorkflowStatus(runId: string) {
    return prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { approvals: true }
    });
  }

  async getEventLog(runId: string) {
    return prisma.workflowEvent.findMany({
      where: { workflowRunId: runId },
      orderBy: { occurredAt: 'asc' }
    });
  }
}

export const orchestratorService = new OrchestratorService();
