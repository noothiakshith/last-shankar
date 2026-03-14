import { test, expect } from 'vitest';
import fc from 'fast-check';
import { WorkflowState } from '@prisma/client';
import { StateTransitions, WorkflowEventTrigger, getNextState } from './stateMachine';

test('Property 8: State machine never makes invalid transitions', () => {
  const allStates = Object.values(WorkflowState) as WorkflowState[];
  const allEvents = [
    'START_FORECASTING',
    'REQUEST_FORECAST_APPROVAL',
    'APPROVE_FORECAST',
    'REJECT_FORECAST',
    'START_PLANNING',
    'START_PROCUREMENT',
    'REQUEST_PO_APPROVAL',
    'APPROVE_PO',
    'REJECT_PO',
    'START_FINANCE_REVIEW',
    'APPROVE_FINANCE',
    'REJECT_FINANCE',
    'REQUEST_PRODUCTION_AUTH',
    'APPROVE_PRODUCTION',
    'REJECT_PRODUCTION',
    'START_EXECUTION',
    'COMPLETE',
    'FAIL'
  ] as WorkflowEventTrigger[];

  fc.assert(
    fc.property(fc.constantFrom(...allStates), fc.constantFrom(...allEvents), (state, event) => {
      const validTransitions = StateTransitions[state];
      if (validTransitions && validTransitions[event]) {
        expect(() => getNextState(state, event)).not.toThrow();
        expect(getNextState(state, event)).toBe(validTransitions[event]);
      } else {
        expect(() => getNextState(state, event)).toThrow('Invalid state transition');
      }
    })
  );
});
