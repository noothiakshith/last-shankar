/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Role, ProductionPlanStatus } from '@prisma/client';

// Mock the auth middleware BEFORE imports
vi.mock('@/lib/auth', () => ({
  withAuth: (handler: (...arg: unknown[]) => unknown) => {
    return async (req: NextRequest, ...args: unknown[]) => {
      // Mock token for testing
      const mockToken = {
        id: 'user-1',
        email: 'planner@test.com',
        role: 'PRODUCTION_PLANNER'
      };
      return handler(req, mockToken, ...args);
    };
  },
  Role: {
    ADMIN: 'ADMIN',
    PRODUCTION_PLANNER: 'PRODUCTION_PLANNER',
    SALES_ANALYST: 'SALES_ANALYST',
    INVENTORY_MANAGER: 'INVENTORY_MANAGER',
    PROCUREMENT_OFFICER: 'PROCUREMENT_OFFICER',
    FINANCE_MANAGER: 'FINANCE_MANAGER',
    EXECUTIVE: 'EXECUTIVE'
  }
}));

// Mock the production planning service BEFORE imports
vi.mock('@/modules/production/productionPlanningService', () => ({
  productionPlanningService: {
    runMRP: vi.fn(),
    checkProductionReadiness: vi.fn(),
    authorizePlan: vi.fn()
  }
}));

// Import after mocks
import { POST as mrpPost } from './mrp/route';
import { GET as readinessGet } from './plan/[id]/readiness/route';
import { POST as authorizePost } from './plan/[id]/authorize/route';
import { productionPlanningService } from '@/modules/production/productionPlanningService';

describe('Production Planning API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/production/mrp', () => {
    it('should run MRP and return production plan', async () => {
      const mockDate = new Date();
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: mockDate,
        status: ProductionPlanStatus.DRAFT,
        authorizedBy: null
      };

      vi.mocked(productionPlanningService.runMRP).mockResolvedValue(mockPlan as unknown as any);

      const req = new NextRequest('http://localhost:3000/api/production/mrp', {
        method: 'POST',
        body: JSON.stringify({ forecastId: 'forecast-1' })
      });

      const response = await mrpPost(req);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe('plan-1');
      expect(data.forecastId).toBe('forecast-1');
      expect(data.status).toBe(ProductionPlanStatus.DRAFT);
      expect(productionPlanningService.runMRP).toHaveBeenCalledWith('forecast-1');
    });

    it('should return 400 if forecastId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/production/mrp', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await mrpPost(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing forecastId');
    });

    it('should return 500 if service throws error', async () => {
      vi.mocked(productionPlanningService.runMRP).mockRejectedValue(
        new Error('Forecast not found')
      );

      const req = new NextRequest('http://localhost:3000/api/production/mrp', {
        method: 'POST',
        body: JSON.stringify({ forecastId: 'invalid' })
      });

      const response = await mrpPost(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Forecast not found');
    });
  });

  describe('GET /api/production/plan/[id]/readiness', () => {
    it('should return readiness report', async () => {
      const mockReport = {
        planId: 'plan-1',
        isReady: true,
        materials: [
          {
            materialId: 'material-1',
            materialSku: 'MAT-001',
            materialName: 'Steel',
            required: 200,
            available: 1000,
            shortage: 0,
            unit: 'kg'
          }
        ]
      };

      vi.mocked(productionPlanningService.checkProductionReadiness).mockResolvedValue(mockReport);

      const req = new NextRequest('http://localhost:3000/api/production/plan/plan-1/readiness', {
        method: 'GET'
      });

      const response = await readinessGet(req, { params: Promise.resolve({ id: 'plan-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockReport);
      expect(productionPlanningService.checkProductionReadiness).toHaveBeenCalledWith('plan-1');
    });

    it('should return 500 if plan not found', async () => {
      vi.mocked(productionPlanningService.checkProductionReadiness).mockRejectedValue(
        new Error('Production plan plan-1 not found')
      );

      const req = new NextRequest('http://localhost:3000/api/production/plan/plan-1/readiness', {
        method: 'GET'
      });

      const response = await readinessGet(req, { params: Promise.resolve({ id: 'plan-1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Production plan plan-1 not found');
    });
  });

  describe('POST /api/production/plan/[id]/authorize', () => {
    it('should authorize plan and return updated plan', async () => {
      const mockDate = new Date();
      const mockPlan = {
        id: 'plan-1',
        forecastId: 'forecast-1',
        createdAt: mockDate,
        status: ProductionPlanStatus.AUTHORIZED,
        authorizedBy: 'user-1'
      };

      vi.mocked(productionPlanningService.authorizePlan).mockResolvedValue(mockPlan as unknown as any);

      const req = new NextRequest('http://localhost:3000/api/production/plan/plan-1/authorize', {
        method: 'POST'
      });

      const response = await authorizePost(req, { params: Promise.resolve({ id: 'plan-1' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('plan-1');
      expect(data.status).toBe(ProductionPlanStatus.AUTHORIZED);
      expect(data.authorizedBy).toBe('user-1');
      expect(productionPlanningService.authorizePlan).toHaveBeenCalledWith('plan-1', 'user-1');
    });

    it('should return 500 if plan not in DRAFT status', async () => {
      vi.mocked(productionPlanningService.authorizePlan).mockRejectedValue(
        new Error('Production plan plan-1 is not in DRAFT status')
      );

      const req = new NextRequest('http://localhost:3000/api/production/plan/plan-1/authorize', {
        method: 'POST'
      });

      const response = await authorizePost(req, { params: Promise.resolve({ id: 'plan-1' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Production plan plan-1 is not in DRAFT status');
    });
  });
});
