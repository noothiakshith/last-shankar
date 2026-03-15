import { test, expect, vi, describe, beforeEach } from 'vitest';
import { dispatchPlanToProduce } from './planToProduce';
import { orchestratorService } from '../orchestratorService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { procurementService } from '@/modules/procurement/procurementService';
import * as financeService from '@/modules/finance/financeService';
import { WorkflowState, ApprovalGateType, Role } from '@prisma/client';

const mockPrisma = vi.hoisted(() => ({
  workflowRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  productionPlan: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  purchaseOrder: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  productionOrder: {
    update: vi.fn(),
  },
}));

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}));

vi.mock('../orchestratorService', () => ({
  orchestratorService: {
    advanceState: vi.fn().mockResolvedValue(undefined),
    requestApproval: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/inventory/inventoryService', () => ({
  inventoryService: {
    detectShortages: vi.fn(),
    recordFinishedGoods: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/modules/procurement/procurementService', () => ({
  procurementService: {
    findSuppliers: vi.fn(),
    createPurchaseOrder: vi.fn(),
    submitPOForApproval: vi.fn(),
  },
}));

vi.mock('@/modules/finance/financeService', () => ({
  validateBudget: vi.fn(),
  approvePO: vi.fn().mockResolvedValue(undefined),
  rejectPO: vi.fn().mockResolvedValue(undefined),
}));

describe('PlanToProduce Workflow Dispatcher', () => {
  const runId = 'run-ptp-1';
  const planId = 'plan-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('INITIATED', () => {
    test('advances to START_PLANNING when planId is valid and plan has orders', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.INITIATED,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });
      mockPrisma.productionPlan.findUnique.mockResolvedValue({
        id: planId,
        orders: [{ id: 'ord-1', productId: 'prod-1', requiredQty: 10 }],
      });

      await dispatchPlanToProduce(runId);

      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'START_PLANNING');
      expect(mockPrisma.productionPlan.findUnique).toHaveBeenCalledWith({
        where: { id: planId },
        include: { orders: true },
      });
    });

    test('when planId is missing: advances to FAIL with error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.INITIATED,
        payload: {},
        triggeredBy: 'user-1',
        approvals: [],
      });

      await dispatchPlanToProduce(runId);
      consoleSpy.mockRestore();

      expect(orchestratorService.advanceState).not.toHaveBeenCalledWith(runId, 'START_PLANNING');
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(
        runId,
        'FAIL',
        expect.objectContaining({ error: 'PLAN_TO_PRODUCE requires planId in payload' })
      );
    });

    test('when plan does not exist: advances to FAIL with error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.INITIATED,
        payload: { planId: 'nonexistent' },
        triggeredBy: 'user-1',
        approvals: [],
      });
      mockPrisma.productionPlan.findUnique.mockResolvedValue(null);

      await dispatchPlanToProduce(runId);
      consoleSpy.mockRestore();

      expect(orchestratorService.advanceState).toHaveBeenCalledWith(
        runId,
        'FAIL',
        expect.objectContaining({ error: 'Production plan nonexistent not found' })
      );
    });

    test('when plan has no orders: advances to FAIL with error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.INITIATED,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });
      mockPrisma.productionPlan.findUnique.mockResolvedValue({
        id: planId,
        orders: [],
      });

      await dispatchPlanToProduce(runId);
      consoleSpy.mockRestore();

      expect(orchestratorService.advanceState).toHaveBeenCalledWith(
        runId,
        'FAIL',
        expect.objectContaining({ error: expect.stringContaining('has no orders') })
      );
    });

    test('returns early when workflow type is not PLAN_TO_PRODUCE', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'DEMAND_TO_PLAN',
        state: WorkflowState.INITIATED,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });

      await dispatchPlanToProduce(runId);

      expect(orchestratorService.advanceState).not.toHaveBeenCalled();
    });
  });

  describe('PLANNING', () => {
    test('with no shortages: updates plan, advances REQUEST_PRODUCTION_AUTH, requests PRODUCTION_AUTHORIZATION', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.PLANNING,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });
      vi.mocked(inventoryService.detectShortages).mockResolvedValue({
        planId,
        shortages: [],
      } as Awaited<ReturnType<typeof inventoryService.detectShortages>>);
      mockPrisma.productionPlan.update.mockResolvedValue({});

      await dispatchPlanToProduce(runId);

      expect(mockPrisma.productionPlan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: 'PENDING_AUTHORIZATION' },
      });
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'REQUEST_PRODUCTION_AUTH');
      expect(orchestratorService.requestApproval).toHaveBeenCalledWith(
        runId,
        ApprovalGateType.PRODUCTION_AUTHORIZATION,
        Role.PRODUCTION_PLANNER
      );
      expect(orchestratorService.advanceState).not.toHaveBeenCalledWith(runId, 'START_PROCUREMENT');
    });

    test('with shortages: advances START_PROCUREMENT only', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.PLANNING,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });
      vi.mocked(inventoryService.detectShortages).mockResolvedValue({
        planId,
        shortages: [{ materialId: 'mat-1', deficit: -50 }],
      } as Awaited<ReturnType<typeof inventoryService.detectShortages>>);

      await dispatchPlanToProduce(runId);

      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'START_PROCUREMENT');
      expect(orchestratorService.requestApproval).not.toHaveBeenCalledWith(
        runId,
        ApprovalGateType.PRODUCTION_AUTHORIZATION,
        expect.anything()
      );
    });
  });

  describe('PROCUREMENT', () => {
    test('creates POs for shortages, updates payload, requests PO_APPROVAL', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.PROCUREMENT,
        payload: { planId },
        triggeredBy: 'user-1',
        approvals: [],
      });
      vi.mocked(inventoryService.detectShortages).mockResolvedValue({
        planId,
        shortages: [{ materialId: 'mat-1', deficit: -30 }],
      } as Awaited<ReturnType<typeof inventoryService.detectShortages>>);
      vi.mocked(procurementService.findSuppliers).mockResolvedValue([
        { id: 'sup-1', name: 'S1', leadTimeDays: 5, unitCost: 10 },
      ]);
      vi.mocked(procurementService.createPurchaseOrder).mockResolvedValue({
        id: 'po-1',
        totalCost: 300,
      } as Awaited<ReturnType<typeof procurementService.createPurchaseOrder>>);
      vi.mocked(procurementService.submitPOForApproval).mockResolvedValue({} as never);
      mockPrisma.workflowRun.update.mockResolvedValue({});

      await dispatchPlanToProduce(runId);

      expect(procurementService.createPurchaseOrder).toHaveBeenCalledWith({
        supplierId: 'sup-1',
        materialId: 'mat-1',
        quantity: 30,
        unitCost: 10,
      });
      expect(mockPrisma.workflowRun.update).toHaveBeenCalledWith({
        where: { id: runId },
        data: expect.objectContaining({
          payload: expect.objectContaining({
            planId,
            poIds: ['po-1'],
            totalPlannedCost: 300,
          }),
        }),
      });
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'REQUEST_PO_APPROVAL');
      expect(orchestratorService.requestApproval).toHaveBeenCalledWith(
        runId,
        ApprovalGateType.PO_APPROVAL,
        Role.FINANCE_MANAGER
      );
    });
  });

  describe('FINANCE_REVIEW', () => {
    test('when budget allowed: approves POs, advances APPROVE_FINANCE, requests PRODUCTION_AUTHORIZATION', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.FINANCE_REVIEW,
        payload: { planId, poIds: ['po-1'], totalPlannedCost: 100 },
        triggeredBy: 'user-1',
        approvals: [],
      });
      vi.mocked(financeService.validateBudget).mockResolvedValue(true);
      mockPrisma.productionPlan.update.mockResolvedValue({});

      await dispatchPlanToProduce(runId);

      expect(financeService.approvePO).toHaveBeenCalledWith('po-1', 'user-1');
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'APPROVE_FINANCE');
      expect(orchestratorService.requestApproval).toHaveBeenCalledWith(
        runId,
        ApprovalGateType.PRODUCTION_AUTHORIZATION,
        Role.PRODUCTION_PLANNER
      );
    });

    test('when budget not allowed: rejects POs, advances REJECT_FINANCE', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.FINANCE_REVIEW,
        payload: { planId, poIds: ['po-1'], totalPlannedCost: 99999 },
        triggeredBy: 'user-1',
        approvals: [],
      });
      vi.mocked(financeService.validateBudget).mockResolvedValue(false);

      await dispatchPlanToProduce(runId);

      expect(financeService.rejectPO).toHaveBeenCalledWith('po-1', 'user-1');
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'REJECT_FINANCE');
      expect(orchestratorService.requestApproval).not.toHaveBeenCalled();
    });
  });

  describe('EXECUTING', () => {
    test('when all POs delivered: records finished goods, completes plan, advances COMPLETE', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.EXECUTING,
        payload: { planId, poIds: ['po-1'] },
        triggeredBy: 'user-1',
        approvals: [],
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'DELIVERED',
      });
      mockPrisma.productionPlan.findUnique.mockResolvedValue({
        id: planId,
        orders: [
          { id: 'ord-1', productId: 'prod-1', requiredQty: 20 },
        ],
      });
      mockPrisma.productionOrder.update.mockResolvedValue({});
      mockPrisma.productionPlan.update.mockResolvedValue({});

      await dispatchPlanToProduce(runId);

      expect(inventoryService.recordFinishedGoods).toHaveBeenCalledWith('prod-1', 20);
      expect(mockPrisma.productionOrder.update).toHaveBeenCalledWith({
        where: { id: 'ord-1' },
        data: { status: 'COMPLETED' },
      });
      expect(mockPrisma.productionPlan.update).toHaveBeenCalledWith({
        where: { id: planId },
        data: { status: 'COMPLETED' },
      });
      expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'COMPLETE');
    });

    test('when POs not all delivered: does not advance (stays in EXECUTING)', async () => {
      mockPrisma.workflowRun.findUnique.mockResolvedValue({
        id: runId,
        type: 'PLAN_TO_PRODUCE',
        state: WorkflowState.EXECUTING,
        payload: { planId, poIds: ['po-1'] },
        triggeredBy: 'user-1',
        approvals: [],
      });
      mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
        id: 'po-1',
        status: 'APPROVED',
      });

      await dispatchPlanToProduce(runId);

      expect(orchestratorService.advanceState).not.toHaveBeenCalledWith(runId, 'COMPLETE');
      expect(inventoryService.recordFinishedGoods).not.toHaveBeenCalled();
    });
  });
});
