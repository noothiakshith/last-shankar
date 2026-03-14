# Implementation Plan: NexisERP

## Overview

Incremental implementation starting with project scaffolding and shared infrastructure, then building each ERP module in dependency order, and finishing with frontend dashboards and Docker deployment. Each task builds on the previous so no code is left orphaned.

## Tasks

- [x] 1. Project scaffolding and environment setup
  - Bootstrap Next.js 14+ project with App Router and TypeScript
  - Configure `tsconfig.json`, `eslint`, and `prettier`
  - Install all dependencies: Prisma, NextAuth.js, TensorFlow.js (Node), fast-check, Vitest, `@testing-library/react`
  - Create `.env.example` with `DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_TTL`, `NEXTAUTH_URL`
  - Create `src/lib/`, `src/modules/`, `src/app/api/` directory structure
  - _Requirements: 15.3_


- [x] 2. Prisma schema and database migrations
  - Write complete `prisma/schema.prisma` with all models: User, Session, WorkflowRun, WorkflowEvent, ApprovalGate, SalesRecord, TrainedModel, ForecastResult, Product, BOMItem, ProductionPlan, ProductionOrder, Material, StockLedger, FinishedGood, Supplier, SupplierMaterial, PurchaseOrder, Budget, Expense, Employee
  - Define all enums: Role, WorkflowType, WorkflowState, ApprovalGateType, ApprovalStatus, ModelType, ForecastStatus, ProductionPlanStatus, OrderStatus, POStatus
  - Add indexes on `WorkflowEvent.workflowRunId` and `StockLedger.materialId`
  - Run `prisma migrate dev --name init` to generate and apply migration
  - _Requirements: 3.1, 8.1, 8.2_

- [ ] 3. Seed script
  - [x] 3.1 Implement CSV loader for Superstore and Walmart sales data
    - Write `prisma/seed.ts` that reads CSV files and upserts SalesRecord rows using a unique key (date + productId + region + source) for idempotency
    - _Requirements: 14.1, 14.3_
  - [x] 3.2 Implement synthetic reference data seeding
    - Seed Material, Product, BOMItem, Supplier, SupplierMaterial, Budget, and Employee records with `upsert` calls
    - Ensure a complete set of records sufficient to run a full DEMAND_TO_PLAN workflow
    - _Requirements: 14.2, 14.3_
  - [x] 3.3 Write property test for seed idempotency
    - **Property 30: Seed script is idempotent**
    - **Validates: Requirements 14.3**


- [ ] 4. Authentication and RBAC
  - [x] 4.1 Configure NextAuth.js with credentials provider
    - Create `src/app/api/auth/[...nextauth]/route.ts` using NextAuth credentials provider
    - Implement `authorize` callback that validates email/password against User records and returns `{ id, email, role }`
    - Configure JWT strategy with `NEXTAUTH_SECRET` and configurable `JWT_TTL` from env
    - _Requirements: 1.1, 1.3_
  - [x] 4.2 Write property test for JWT identity claims
    - **Property 1: JWT contains correct identity claims**
    - **Validates: Requirements 1.1**
  - [x] 4.3 Write property test for invalid credential rejection
    - **Property 2: Invalid credentials always rejected**
    - **Validates: Requirements 1.2**
  - [x] 4.4 Implement RBAC middleware
    - Create `src/lib/auth.ts` with `withAuth(handler, requiredRole[])` higher-order function
    - Validate JWT presence and expiry; return 401 if missing or expired
    - Validate role against required roles; return 403 if insufficient
    - Grant ADMIN role access to all routes
    - _Requirements: 1.4, 1.5, 2.1, 2.4_
  - [x] 4.5 Write property test for unauthenticated request rejection
    - **Property 3: Unauthenticated requests always rejected**
    - **Validates: Requirements 1.4**
  - [x] 4.6 Write property test for insufficient-role rejection
    - **Property 4: Insufficient-role requests always rejected**
    - **Validates: Requirements 1.5, 2.2, 2.3**
  - [x] 4.7 Write property test for ADMIN role bypass
    - **Property 5: ADMIN role passes all permission checks**
    - **Validates: Requirements 2.4**

- [x] 5. Checkpoint — Ensure auth tests pass, ask the user if questions arise.


- [x] 6. Central Orchestrator — core state machine
  - [x] 6.1 Implement state machine transition table
    - Create `src/modules/orchestrator/stateMachine.ts` defining valid `(currentState, event) → nextState` transitions for all WorkflowState values
    - Throw on invalid transitions
    - _Requirements: 3.5_
  - [x] 6.2 Write property test for valid state transitions
    - **Property 8: State machine never makes invalid transitions**
    - **Validates: Requirements 3.5**
  - [x] 6.3 Implement OrchestratorService
    - Create `src/modules/orchestrator/orchestratorService.ts` implementing `triggerWorkflow`, `advanceState`, `requestApproval`, `resolveApproval`, `getWorkflowStatus`, `getEventLog`
    - `triggerWorkflow` creates WorkflowRun with state `INITIATED` and persists a WorkflowEvent
    - `advanceState` validates transition, persists WorkflowEvent, updates WorkflowRun
    - Wrap all module dispatches in try/catch; on error set state to `FAILED` and log event
    - _Requirements: 3.1, 3.2, 3.3, 3.6_
  - [x] 6.4 Write property test for workflow initial state
    - **Property 6: Workflow always starts in INITIATED state**
    - **Validates: Requirements 3.1**
  - [x] 6.5 Write property test for event log completeness
    - **Property 7: Every state transition produces a WorkflowEvent**
    - **Validates: Requirements 3.3, 13.4**
  - [x] 6.6 Write property test for module error producing FAILED state
    - **Property 9: Module errors always produce FAILED state**
    - **Validates: Requirements 3.6**
  - [x] 6.7 Implement ApprovalGate logic
    - `requestApproval` creates ApprovalGate with status `PENDING` and blocks workflow
    - `resolveApproval` validates resolving user's role matches `requiredRole`; returns 403 on mismatch
    - On APPROVED: advance WorkflowRun; on REJECTED: set state to REJECTED
    - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 6.8 Write property test for pending gate blocking advancement
    - **Property 10: Pending approval gates block workflow advancement**
    - **Validates: Requirements 4.1, 4.5**
  - [x] 6.9 Write property test for gate resolution audit fields
    - **Property 11: Gate resolution records audit fields**
    - **Validates: Requirements 4.2**
  - [x] 6.10 Write property test for role mismatch blocking gate resolution
    - **Property 12: Role mismatch blocks gate resolution**
    - **Validates: Requirements 2.2, 2.3**
  - [x] 6.11 Implement Orchestrator API routes
    - `POST /api/orchestrator/trigger` — protected by `withAuth`, calls `triggerWorkflow`
    - `GET /api/orchestrator/status/[runId]` — returns WorkflowRun + pending ApprovalGates
    - `POST /api/orchestrator/approve` — validates role, calls `resolveApproval`
    - _Requirements: 3.1, 3.4, 4.2_

- [x] 7. Checkpoint — Ensure orchestrator tests pass, ask the user if questions arise.


- [x] 8. Sales Intelligence Module
  - [x] 8.1 Implement TensorFlow.js model training
    - Create `src/modules/sales/salesIntelligenceService.ts`
    - Implement `trainModel(config)`: load SalesRecord data from DB, build and train TF.js model for LINEAR_REGRESSION, RANDOM_FOREST, XGBOOST, ARIMA types
    - Compute MAE, RMSE, R² after training; persist TrainedModel record with `artifactPath`
    - On training failure (NaN loss, insufficient data) throw descriptive error so Orchestrator sets state to FAILED
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 8.2 Write property test for trained model metrics validity
    - **Property 13: Trained model metrics are valid numbers**
    - **Validates: Requirements 5.3**
  - [x] 8.3 Implement leaderboard and forecast generation
    - Implement `getLeaderboard()`: query all TrainedModel records, sort ascending by MAE
    - Implement `runForecast(modelId, horizon)`: load model artifact, generate predictions for H days, persist ForecastResult with status `DRAFT`
    - _Requirements: 5.5, 6.1, 6.2_
  - [x] 8.4 Write property test for leaderboard ordering
    - **Property 14: Leaderboard order is consistent with metrics**
    - **Validates: Requirements 5.5**
  - [x] 8.5 Write property test for forecast horizon coverage
    - **Property 15: Forecast horizon matches requested days**
    - **Validates: Requirements 6.1**
  - [x] 8.6 Implement forecast approval flow and actuals recording
    - Implement `submitForecastForApproval(forecastId)`: set ForecastResult status to `PENDING_APPROVAL`, call `orchestrator.requestApproval` for FORECAST_APPROVAL gate
    - On gate APPROVED: set status to `APPROVED`, record `approvedBy`/`approvedAt`
    - Implement `recordActuals(period, actuals)`: persist SalesActual records for MLOps retraining loop
    - _Requirements: 6.3, 6.4, 6.5_
  - [x] 8.7 Write property test for forecast status lifecycle monotonicity
    - **Property 16: Forecast status lifecycle is monotonic**
    - **Validates: Requirements 6.2, 6.3, 6.4**
  - [x] 8.8 Implement Sales Intelligence API routes
    - `POST /api/sales/train` — SALES_ANALYST only
    - `POST /api/sales/forecast` — SALES_ANALYST only
    - `GET /api/sales/leaderboard` — SALES_ANALYST, EXECUTIVE
    - `POST /api/sales/forecast/[id]/submit` — SALES_ANALYST only
    - `POST /api/sales/actuals` — SALES_ANALYST only
    - _Requirements: 5.1, 6.1, 6.3_


- [ ] 9. Production Planning Module
  - [ ] 9.1 Implement MRP and BOM explosion
    - Create `src/modules/production/productionPlanningService.ts`
    - Implement `runMRP(forecastId)`: load approved ForecastResult, for each product fetch BOMItems, multiply forecast quantity × BOM quantity per unit to derive material requirements
    - Persist ProductionPlan (status `DRAFT`) and ProductionOrder records linked to the plan
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ] 9.2 Write property test for MRP material requirement calculation
    - **Property 17: MRP material requirement equals forecast quantity times BOM quantity**
    - **Validates: Requirements 7.1, 7.2**
  - [ ] 9.3 Implement plan authorization and readiness report
    - Implement `checkProductionReadiness(planId)`: return ReadinessReport indicating material availability
    - Implement `authorizePlan(planId, authorizedBy)`: set ProductionPlan status to `AUTHORIZED`, record `authorizedBy`
    - _Requirements: 7.4, 7.5_
  - [ ] 9.4 Implement Production Planning API routes
    - `POST /api/production/mrp` — PRODUCTION_PLANNER only
    - `GET /api/production/plan/[id]/readiness` — PRODUCTION_PLANNER only
    - `POST /api/production/plan/[id]/authorize` — PRODUCTION_PLANNER only
    - _Requirements: 7.1, 7.4, 7.5_

- [ ] 10. Inventory Management Module
  - [ ] 10.1 Implement stock ledger and on-hand calculation
    - Create `src/modules/inventory/inventoryService.ts`
    - Implement `updateStock(itemId, delta, reason)`: append StockLedger entry; never overwrite on-hand directly
    - Implement `getStockLevel(itemId)`: derive on-hand as `SUM(delta)` from StockLedger for that material
    - _Requirements: 8.1, 8.2_
  - [ ] 10.2 Write property test for stock on-hand ledger sum
    - **Property 18: Stock on-hand equals sum of all ledger deltas**
    - **Validates: Requirements 8.1, 8.2**
  - [ ] 10.3 Implement shortage detection and safety stock alerts
    - Implement `detectShortages(planId)`: compare MRP requirements against on-hand; return ShortageReport with all deficit materials
    - Implement `getSafetyStockAlerts()`: return all materials where `onHand < safetyStock`
    - _Requirements: 8.3, 8.4_
  - [ ] 10.4 Write property test for shortage report completeness
    - **Property 19: Shortage report is complete and sound**
    - **Validates: Requirements 8.3**
  - [ ] 10.5 Write property test for safety stock alert completeness
    - **Property 20: Safety stock alerts are complete and sound**
    - **Validates: Requirements 8.4**
  - [ ] 10.6 Implement finished goods recording and API routes
    - Implement `recordFinishedGoods(productId, quantity)`: upsert FinishedGood record
    - `GET /api/inventory/stock/[itemId]` — INVENTORY_MANAGER only
    - `POST /api/inventory/stock/[itemId]` — INVENTORY_MANAGER only
    - `GET /api/inventory/shortages/[planId]` — INVENTORY_MANAGER, PRODUCTION_PLANNER
    - `GET /api/inventory/alerts` — INVENTORY_MANAGER only
    - _Requirements: 8.3, 8.4, 8.5_

- [ ] 11. Checkpoint — Ensure production and inventory tests pass, ask the user if questions arise.


- [ ] 12. Supplier & Procurement Module
  - [ ] 12.1 Implement supplier lookup and PO creation
    - Create `src/modules/procurement/procurementService.ts`
    - Implement `findSuppliers(materialId)`: query SupplierMaterial join to return only qualified suppliers for that material
    - Implement `createPurchaseOrder(po)`: persist PO with status `DRAFT`, compute `totalCost = quantity × unitCost`
    - _Requirements: 9.1, 9.2_
  - [ ] 12.2 Write property test for PO total cost calculation
    - **Property 21: PO total cost equals quantity times unit cost**
    - **Validates: Requirements 9.2**
  - [ ] 12.3 Write property test for supplier lookup qualification
    - **Property 22: Supplier lookup returns only qualified suppliers**
    - **Validates: Requirements 9.1**
  - [ ] 12.4 Implement PO lifecycle and delivery confirmation
    - Implement `getPOStatus`, `getPendingPOs`
    - Implement PO submission: set status to `PENDING_APPROVAL`, call `orchestrator.requestApproval` for PO_APPROVAL gate
    - Implement `confirmDelivery(poId, receivedQty)`: set PO status to `DELIVERED`, call `inventoryService.updateStock` with delta = receivedQty
    - On rejection: set PO status to `REJECTED`
    - _Requirements: 9.3, 9.4, 9.5, 9.6_
  - [ ] 12.5 Write property test for delivery confirmation triggering stock update
    - **Property 23: Delivery confirmation triggers stock update**
    - **Validates: Requirements 9.5**
  - [ ] 12.6 Implement Procurement API routes
    - `GET /api/procurement/suppliers/[materialId]` — PROCUREMENT_OFFICER only
    - `POST /api/procurement/po` — PROCUREMENT_OFFICER only
    - `GET /api/procurement/po/[id]` — PROCUREMENT_OFFICER, FINANCE_MANAGER
    - `POST /api/procurement/po/[id]/submit` — PROCUREMENT_OFFICER only
    - `POST /api/procurement/po/[id]/deliver` — PROCUREMENT_OFFICER only
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 13. Finance Module
  - [ ] 13.1 Implement budget validation and PO approval
    - Create `src/modules/finance/financeService.ts`
    - Implement `validateBudget(amount, costCenter)`: return success iff `amount ≤ (totalBudget - committed - spent)`
    - Implement `approvePO(poId, approvedBy)`: validate budget, record `approvedBy`/`approvedAt`, increment `committed` by PO totalCost
    - Implement `rejectPO(poId, rejectedBy, reason)`: set PO status to REJECTED
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ] 13.2 Write property test for budget validation correctness
    - **Property 24: Budget validation is correct at all amounts**
    - **Validates: Requirements 10.1, 10.2**
  - [ ] 13.3 Write property test for PO approval committed balance increment
    - **Property 25: PO approval increments committed balance by exact PO cost**
    - **Validates: Requirements 10.3**
  - [ ] 13.4 Implement expense recording and budget summary
    - Implement `recordExpense(expense)`: persist Expense record, increment `spent` on Budget
    - Implement `getBudgetSummary(costCenter)`: return Budget record for cost center
    - _Requirements: 10.4, 10.5_
  - [ ] 13.5 Write property test for expense recording spent balance increment
    - **Property 26: Expense recording increments spent balance by exact amount**
    - **Validates: Requirements 10.4**
  - [ ] 13.6 Implement Finance API routes
    - `POST /api/finance/po/[id]/approve` — FINANCE_MANAGER only
    - `POST /api/finance/po/[id]/reject` — FINANCE_MANAGER only
    - `POST /api/finance/expense` — FINANCE_MANAGER only
    - `GET /api/finance/budget/[costCenter]` — FINANCE_MANAGER, EXECUTIVE
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

- [ ] 14. Checkpoint — Ensure procurement and finance tests pass, ask the user if questions arise.


- [ ] 15. HR Module (minimal)
  - [ ] 15.1 Implement HR service and API routes
    - Create `src/modules/hr/hrService.ts` implementing `getEmployee`, `listEmployeesByDepartment`, `allocateToWorkflow`
    - `allocateToWorkflow` records employee–WorkflowRun association (can be a simple JSON field or join table)
    - Restrict all employee PII endpoints to ADMIN role via `withAuth`
    - `GET /api/hr/employee/[id]` — ADMIN only
    - `GET /api/hr/employees?department=X` — ADMIN only
    - `POST /api/hr/employee/[id]/allocate` — ADMIN only
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [ ] 15.2 Write property test for employee department filter
    - **Property 27: Employee department filter is complete and sound**
    - **Validates: Requirements 11.3**
  - [ ] 15.3 Write property test for employee PII access restriction
    - **Property 28: Employee PII is inaccessible to non-ADMIN roles**
    - **Validates: Requirements 11.5**

- [ ] 16. LLM Intelligence Module (minimal)
  - [ ] 16.1 Implement LLM service and API routes
    - Create `src/modules/llm/llmService.ts` implementing `summarizeWorkflow` and `explainForecast`
    - `summarizeWorkflow(runId)`: fetch WorkflowRun + recent WorkflowEvents + pending ApprovalGates; compose a natural language summary string (template-based or via external LLM API call)
    - `explainForecast(forecastId)`: fetch ForecastResult + TrainedModel; compose natural language description
    - `GET /api/llm/workflow/[runId]/summary` — EXECUTIVE, ADMIN
    - `GET /api/llm/forecast/[id]/explain` — SALES_ANALYST, EXECUTIVE, ADMIN
    - _Requirements: 12.1, 12.2_


- [ ] 17. Demand-to-Plan workflow orchestration wiring
  - [ ] 17.1 Implement DEMAND_TO_PLAN workflow dispatcher
    - Create `src/modules/orchestrator/workflows/demandToPlan.ts`
    - Wire the full sequence: Sales forecast → FORECAST_APPROVAL gate → MRP → shortage detection → (if shortages) PO creation → PO_APPROVAL gate → Finance budget validation → PRODUCTION_AUTHORIZATION gate → production execution → finished goods update → COMPLETED
    - Skip PROCUREMENT and PENDING_PO_APPROVAL states when no shortages are detected
    - _Requirements: 13.1, 13.2, 13.3_
  - [ ] 17.2 Write property test for no-shortage workflow skipping procurement states
    - **Property 29: No-shortage workflow skips procurement states**
    - **Validates: Requirements 13.3**
  - [ ] 17.3 Implement PLAN_TO_PRODUCE and PROCURE_TO_PAY workflow dispatchers
    - Create stub dispatchers for the remaining two workflow types following the same pattern
    - _Requirements: 3.2_

- [ ] 18. Checkpoint — Run full DEMAND_TO_PLAN integration test with seeded data, ensure all state transitions and approval gates fire correctly. Ask the user if questions arise.


- [ ] 19. Frontend dashboards
  - [ ] 19.1 Implement shared layout, navigation, and auth session provider
    - Create `src/app/layout.tsx` with NextAuth `SessionProvider`
    - Build role-aware navigation sidebar that shows only links relevant to the current user's role
    - Create login page at `src/app/login/page.tsx` using NextAuth `signIn`
    - _Requirements: 1.1, 2.1_
  - [ ] 19.2 Implement Orchestrator dashboard
    - Page at `src/app/dashboard/orchestrator/page.tsx`
    - List active WorkflowRuns with current state; poll `/api/orchestrator/status/[runId]` every 5 seconds
    - Show pending ApprovalGates with Approve/Reject buttons (role-gated)
    - Trigger new workflow form
    - _Requirements: 3.4, 4.1, 4.2_
  - [ ] 19.3 Implement Sales Intelligence dashboard
    - Page at `src/app/dashboard/sales/page.tsx`
    - Model training form (model type selector), leaderboard table sorted by MAE
    - Forecast generation form (model, horizon), forecast result display with submit-for-approval button
    - _Requirements: 5.1, 5.5, 6.1, 6.3_
  - [ ] 19.4 Implement Production Planning dashboard
    - Page at `src/app/dashboard/production/page.tsx`
    - List ProductionPlans with status; readiness report view; authorize button
    - _Requirements: 7.3, 7.4, 7.5_
  - [ ] 19.5 Implement Inventory dashboard
    - Page at `src/app/dashboard/inventory/page.tsx`
    - Stock level lookup by SKU; safety stock alerts list; shortage report view per plan
    - _Requirements: 8.1, 8.3, 8.4_
  - [ ] 19.6 Implement Procurement dashboard
    - Page at `src/app/dashboard/procurement/page.tsx`
    - Pending POs list; PO detail with status timeline; create PO form; confirm delivery button
    - _Requirements: 9.2, 9.3, 9.5_
  - [ ] 19.7 Implement Finance dashboard
    - Page at `src/app/dashboard/finance/page.tsx`
    - Budget summary per cost center; POs pending finance approval with approve/reject; expense entry form
    - _Requirements: 10.1, 10.3, 10.4, 10.5_
  - [ ] 19.8 Implement HR dashboard (minimal)
    - Page at `src/app/dashboard/hr/page.tsx` — ADMIN only
    - Employee list filterable by department; employee detail view
    - _Requirements: 11.1, 11.2, 11.3_
  - [ ] 19.9 Implement Executive / LLM summary dashboard
    - Page at `src/app/dashboard/executive/page.tsx`
    - Workflow summary cards using LLM summaries; forecast explanation panel
    - _Requirements: 12.1, 12.2_

- [ ] 20. Checkpoint — Verify all dashboards render correctly for each role, ask the user if questions arise.


- [ ] 21. Docker deployment
  - [ ] 21.1 Write Dockerfile for Next.js application
    - Multi-stage build: `deps` stage installs node_modules, `builder` stage runs `next build`, `runner` stage uses `node:alpine` with only production artifacts
    - Expose port 3000; read `DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_TTL`, `NEXTAUTH_URL` from environment
    - _Requirements: 15.1, 15.3_
  - [ ] 21.2 Write docker-compose.yml
    - Define `app` service (Next.js) and `db` service (postgres:15-alpine)
    - Map configurable host port to container port 3000 via `APP_PORT` env variable
    - Set `db` healthcheck; make `app` depend on `db` being healthy
    - Mount `.env` file for environment variable injection
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 22. Final checkpoint — Ensure all tests pass and `docker-compose up` starts the system cleanly. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each major phase boundary
- Property tests use fast-check and validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The HR and LLM modules are intentionally minimal — their tasks are lightweight by design
