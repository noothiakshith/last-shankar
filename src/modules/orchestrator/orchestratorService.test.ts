import { test, expect, vi, describe, beforeEach } from 'vitest';
import { WorkflowState, WorkflowType, Role, ApprovalGateType, ApprovalStatus } from '@prisma/client';
import { OrchestratorService } from './orchestratorService';

const mPrismaClient = vi.hoisted(() => ({
  workflowRun: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  workflowEvent: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  approvalGate: {
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  }
}));

vi.mock('@prisma/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@prisma/client')>();
  return {
    ...actual,
    PrismaClient: function() { return mPrismaClient; }
  };
});

describe('OrchestratorService Property Tests', () => {
  let service: OrchestratorService;
  let prisma: typeof mPrismaClient;

  beforeEach(() => {
    service = new OrchestratorService();
    prisma = mPrismaClient;
    vi.clearAllMocks();
  });

  test('Property 6: Workflow always starts in INITIATED state', async () => {
    prisma.workflowRun.create.mockResolvedValue({ id: 'run-1', state: WorkflowState.INITIATED });
    const run = await service.triggerWorkflow(WorkflowType.DEMAND_TO_PLAN, 'user', {});
    expect(prisma.workflowRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ state: WorkflowState.INITIATED })
    }));
    expect(run.state).toBe(WorkflowState.INITIATED);
  });

  test('Property 7: Every state transition produces a WorkflowEvent', async () => {
    prisma.workflowRun.findUniqueOrThrow.mockResolvedValue({
      id: 'run-1', state: WorkflowState.INITIATED, approvals: []
    });
    prisma.workflowRun.update.mockResolvedValue({});
    
    await service.advanceState('run-1', 'START_FORECASTING');
    
    expect(prisma.workflowEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        eventType: 'START_FORECASTING',
        fromState: WorkflowState.INITIATED,
        toState: WorkflowState.FORECASTING
      })
    }));
  });

  test('Property 9: Module errors always produce FAILED state', async () => {
    prisma.workflowRun.findUniqueOrThrow.mockRejectedValue(new Error('DB Error'));
    prisma.workflowRun.findUnique.mockResolvedValue({ id: 'run-1', state: WorkflowState.INITIATED });
    
    await expect(service.advanceState('run-1', 'START_FORECASTING')).rejects.toThrow('DB Error');
    
    expect(prisma.workflowRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { state: WorkflowState.FAILED }
    }));
  });

  test('Property 10: Pending approval gates block workflow advancement', async () => {
    prisma.workflowRun.findUniqueOrThrow.mockResolvedValue({
      id: 'run-1', state: WorkflowState.FORECASTING, approvals: [{ status: ApprovalStatus.PENDING }]
    });

    await expect(service.advanceState('run-1', 'REQUEST_FORECAST_APPROVAL'))
      .rejects.toThrow('Cannot advance workflow: pending approval gates.');
  });

  test('Property 11: Gate resolution records audit fields', async () => {
    prisma.approvalGate.findUniqueOrThrow.mockResolvedValue({
      id: 'gate-1',
      requiredRole: Role.ADMIN,
      gateType: ApprovalGateType.FORECAST_APPROVAL,
      workflowRun: { id: 'run-1', state: WorkflowState.PENDING_FORECAST_APPROVAL }
    });
    prisma.workflowRun.findUniqueOrThrow.mockResolvedValue({
      id: 'run-1', state: WorkflowState.PENDING_FORECAST_APPROVAL, approvals: []
    });
    
    await service.resolveApproval('gate-1', Role.ADMIN, 'user-123', true);
    
    expect(prisma.approvalGate.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        resolvedBy: 'user-123',
        resolvedAt: expect.any(Date),
        status: ApprovalStatus.APPROVED
      })
    }));
  });

  test('Property 12: Role mismatch blocks gate resolution', async () => {
    prisma.approvalGate.findUniqueOrThrow.mockResolvedValue({
      id: 'gate-1', requiredRole: Role.ADMIN
    });

    await expect(service.resolveApproval('gate-1', Role.SALES_ANALYST, 'user-123', true))
      .rejects.toThrow('Forbidden: Role SALES_ANALYST cannot resolve ADMIN gates');
  });
});
