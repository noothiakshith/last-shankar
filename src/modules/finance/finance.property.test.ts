import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { checkBudgetValidity, calculateNewCommitted, calculateNewSpent } from './financeService';

describe('Finance Property Tests', () => {

  /**
   * Property 24: Budget validation is correct at all amounts
   * Validates: Requirements 10.1, 10.2
   */
  describe('Property 24: Budget validation correctness', () => {
    it('should return true when amount is within available budget', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 1000000, noNaN: true }),
          fc.double({ min: 0, max: 500000, noNaN: true }),
          fc.double({ min: 0, max: 200000, noNaN: true }),
          fc.double({ min: 0, max: 100000, noNaN: true }),
          (totalBudget, committed, spent, amount) => {
            fc.pre(totalBudget - committed - spent >= amount);
            expect(checkBudgetValidity(amount, totalBudget, committed, spent)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return false when amount exceeds available budget', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 1000000, noNaN: true }),
          fc.double({ min: 0, max: 500000, noNaN: true }),
          fc.double({ min: 0, max: 200000, noNaN: true }),
          fc.double({ min: 500001, max: 10000000, noNaN: true }),
          (totalBudget, committed, spent, exceedAmount) => {
            const amount = totalBudget - committed - spent + exceedAmount;
            expect(checkBudgetValidity(amount, totalBudget, committed, spent)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not allow negative amounts', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 1000, max: 1000000, noNaN: true }),
          fc.double({ min: 0, max: 500000, noNaN: true }),
          fc.double({ min: 0, max: 200000, noNaN: true }),
          fc.double({ min: -10000, max: -0.01, noNaN: true }),
          (totalBudget, committed, spent, amount) => {
            expect(checkBudgetValidity(amount, totalBudget, committed, spent)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 25: PO approval increments committed balance by exact PO cost
   * Validates: Requirements 10.3
   */
  describe('Property 25: PO approval increments committed balance', () => {
    it('should add PO total cost exactly to the committed balance', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1000000, noNaN: true }),
          fc.double({ min: 0, max: 5000000, noNaN: true }),
          (poTotalCost, currentCommitted) => {
            const newCommitted = calculateNewCommitted(poTotalCost, currentCommitted);
            const tolerance = 0.0001;
            expect(Math.abs(newCommitted - (currentCommitted + poTotalCost))).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 26: Expense recording increments spent balance by exact amount
   * Validates: Requirements 10.4
   */
  describe('Property 26: Expense recording increments spent balance', () => {
    it('should add expense amount exactly to the spent balance', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0.01, max: 1000000, noNaN: true }),
          fc.double({ min: 0, max: 5000000, noNaN: true }),
          (expenseAmount, currentSpent) => {
            const newSpent = calculateNewSpent(expenseAmount, currentSpent);
            const tolerance = 0.0001;
            expect(Math.abs(newSpent - (currentSpent + expenseAmount))).toBeLessThan(tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

});
