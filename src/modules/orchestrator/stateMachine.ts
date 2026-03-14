import { WorkflowState } from '@prisma/client';

export type WorkflowEventTrigger = 
  | 'START_FORECASTING'
  | 'REQUEST_FORECAST_APPROVAL'
  | 'APPROVE_FORECAST'
  | 'REJECT_FORECAST'
  | 'START_PLANNING'
  | 'START_PROCUREMENT'
  | 'REQUEST_PO_APPROVAL'
  | 'APPROVE_PO'
  | 'REJECT_PO'
  | 'START_FINANCE_REVIEW'
  | 'APPROVE_FINANCE'
  | 'REJECT_FINANCE'
  | 'REQUEST_PRODUCTION_AUTH'
  | 'APPROVE_PRODUCTION'
  | 'REJECT_PRODUCTION'
  | 'START_EXECUTION'
  | 'COMPLETE'
  | 'FAIL';

export const StateTransitions: Record<WorkflowState, Partial<Record<WorkflowEventTrigger, WorkflowState>>> = {
  [WorkflowState.INITIATED]: {
    START_FORECASTING: WorkflowState.FORECASTING,
    START_PLANNING: WorkflowState.PLANNING,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.FORECASTING]: {
    REQUEST_FORECAST_APPROVAL: WorkflowState.PENDING_FORECAST_APPROVAL,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.PENDING_FORECAST_APPROVAL]: {
    APPROVE_FORECAST: WorkflowState.PLANNING,
    REJECT_FORECAST: WorkflowState.REJECTED,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.PLANNING]: {
    START_PROCUREMENT: WorkflowState.PROCUREMENT,
    REQUEST_PRODUCTION_AUTH: WorkflowState.PENDING_PRODUCTION_AUTH,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.PROCUREMENT]: {
    REQUEST_PO_APPROVAL: WorkflowState.PENDING_PO_APPROVAL,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.PENDING_PO_APPROVAL]: {
    APPROVE_PO: WorkflowState.FINANCE_REVIEW,
    REJECT_PO: WorkflowState.REJECTED,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.FINANCE_REVIEW]: {
    APPROVE_FINANCE: WorkflowState.PENDING_PRODUCTION_AUTH,
    REJECT_FINANCE: WorkflowState.REJECTED,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.PENDING_PRODUCTION_AUTH]: {
    APPROVE_PRODUCTION: WorkflowState.EXECUTING,
    REJECT_PRODUCTION: WorkflowState.REJECTED,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.EXECUTING]: {
    COMPLETE: WorkflowState.COMPLETED,
    FAIL: WorkflowState.FAILED,
  },
  [WorkflowState.COMPLETED]: {},
  [WorkflowState.REJECTED]: {},
  [WorkflowState.FAILED]: {}
};

export function getNextState(currentState: WorkflowState, event: WorkflowEventTrigger): WorkflowState {
  const nextState = StateTransitions[currentState][event];
  if (!nextState) {
    throw new Error(`Invalid state transition: ${currentState} -> ${event}`);
  }
  return nextState;
}
