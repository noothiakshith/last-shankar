import { test, expect, vi, describe, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { dispatchDemandToPlan } from './demandToPlan';
import { orchestratorService } from '../orchestratorService';
import { inventoryService } from '@/modules/inventory/inventoryService';
import { productionPlanningService } from '@/modules/production/productionPlanningService';
import { WorkflowState, ApprovalGateType, Role } from '@prisma/client';

const mockPrismaClient = vi.hoisted(() => ({
  workflowRun: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  trainedModel: {
    findFirst: vi.fn(),
  },
  productionPlan: {
    update: vi.fn(),
  }
}));

vi.mock('@/lib/prisma', () => ({
  default: mockPrismaClient
}));

vi.mock('../orchestratorService', () => ({
  orchestratorService: {
    advanceState: vi.fn(),
    requestApproval: vi.fn(),
  }
}));

vi.mock('@/modules/production/productionPlanningService', () => ({
  productionPlanningService: {
    runMRP: vi.fn(),
  }
}));

vi.mock('@/modules/inventory/inventoryService', () => ({
  inventoryService: {
    detectShortages: vi.fn(),
    recordFinishedGoods: vi.fn(),
  }
}));

vi.mock('@/modules/sales/salesService', () => ({ salesService: { generateForecast: vi.fn() }}));
vi.mock('@/modules/procurement/procurementService', () => ({ procurementService: { findSuppliers: vi.fn(), createDraftPO: vi.fn(), addPOItem: vi.fn(), submitPOForApproval: vi.fn() }}));
vi.mock('@/modules/finance/financeService', () => ({ financeService: { validateBudget: vi.fn() }}));

describe('DemandToPlan Workflow Dispatcher Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('Property 29: No-shortage workflow skips procurement states', async () => {
    const runId = 'plan-test-123';
    
    // Fast-check property iteration for verifying structural skip logic
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }), 
        async (mockForecastId) => {
          vi.clearAllMocks();

          mockPrismaClient.workflowRun.findUnique.mockResolvedValue({
            id: runId,
            state: WorkflowState.PLANNING,
            payload: { forecastId: mockForecastId },
            type: 'DEMAND_TO_PLAN',
            triggeredBy: 'user-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            approvals: []
          });

          vi.mocked(productionPlanningService.runMRP).mockResolvedValue({ id: 'plan-xyz' } as unknown as Awaited<ReturnType<typeof productionPlanningService.runMRP>>);
          vi.mocked(inventoryService.detectShortages).mockResolvedValue({ planId: 'plan-xyz', shortages: [] } as unknown as Awaited<ReturnType<typeof inventoryService.detectShortages>>);

          await dispatchDemandToPlan(runId);

          // It should request PRODUCTION_AUTHORIZATION
          expect(orchestratorService.requestApproval).toHaveBeenCalledWith(
            runId,
            ApprovalGateType.PRODUCTION_AUTHORIZATION,
            Role.PRODUCTION_PLANNER
          );
          // It should call REQUEST_PRODUCTION_AUTH
          expect(orchestratorService.advanceState).toHaveBeenCalledWith(runId, 'REQUEST_PRODUCTION_AUTH');
          
          // It should NOT call START_PROCUREMENT or PO_APPROVAL
          expect(orchestratorService.advanceState).not.toHaveBeenCalledWith(runId, 'START_PROCUREMENT');
          expect(orchestratorService.requestApproval).not.toHaveBeenCalledWith(runId, ApprovalGateType.PO_APPROVAL, expect.anything());
        }
      ),
      { numRuns: 10 }
    );
  });
});
