import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterEmployeesByDepartment } from './hrService';
import { checkAuth, AuthToken } from '@/lib/auth';
import { Role } from '@prisma/client';

describe('HR Property Tests', () => {

  describe('Property 27: Employee department filter completeness and soundness', () => {
    it('returns ONLY and ALL employees that match the department (correctness)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string(),
              email: fc.emailAddress(),
              department: fc.constantFrom('HR', 'ENGINEERING', 'SALES', 'SUPPORT'),
              role: fc.string(),
              userId: fc.option(fc.uuid(), { nil: null })
            })
          ),
          fc.constantFrom('HR', 'ENGINEERING', 'SALES', 'SUPPORT'),
          (employees, targetDepartment) => {
            const filtered = filterEmployeesByDepartment(employees, targetDepartment);
            const expected = employees.filter(e => e.department === targetDepartment);
            expect(filtered).toEqual(expected);
          }
        )
      );
    });

    it('returns all employees when no department is specified', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string(),
              email: fc.emailAddress(),
              department: fc.constantFrom('HR', 'ENGINEERING', 'SALES', 'SUPPORT'),
              role: fc.string(),
              userId: fc.option(fc.uuid(), { nil: null })
            })
          ),
          (employees) => {
            const filtered = filterEmployeesByDepartment(employees, null);
            expect(filtered).toEqual(employees);
          }
        )
      );
    });
  });

  describe('Property 28: Employee PII is inaccessible to non-ADMIN roles', () => {
    it('denies access if token role is not in requiredRoles list (and not ADMIN)', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom(
              Role.SALES_ANALYST,
              Role.PRODUCTION_PLANNER,
              Role.INVENTORY_MANAGER,
              Role.PROCUREMENT_OFFICER,
              Role.FINANCE_MANAGER,
              Role.EXECUTIVE
            ),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 1000, max: Math.floor(Date.now() / 1000) + 10000 }),
            iat: fc.integer()
          }),
          (mockToken: AuthToken) => {
            const result = checkAuth(mockToken, []);
            expect(result.ok).toBe(false);
            if (!result.ok) {
               expect(result.status).toBe(403);
            }
          }
        )
      );
    });

    it('allows access if role is ADMIN regardless of explicit requiredRoles array', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constant(Role.ADMIN),
            exp: fc.integer({ min: Math.floor(Date.now() / 1000) + 1000, max: Math.floor(Date.now() / 1000) + 10000 }),
            iat: fc.integer()
          }),
          (mockToken: AuthToken) => {
            const result = checkAuth(mockToken, []);
            expect(result.ok).toBe(true);
          }
        )
      );
    });
  });
});
