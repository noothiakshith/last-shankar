# Requirements Document

## Introduction

NexisERP is a cloud-based, AI-assisted ERP prototype built on a predictive-first architecture. A Central Orchestrator coordinates enterprise workflows through a state machine, while an ML-powered Sales Intelligence module drives demand forecasting that cascades into production planning, inventory management, procurement, and finance. The system supports human-in-the-loop approval gates, role-based access control, and real-time dashboard visibility across all modules.

Tech stack: Next.js 14+ (full-stack), Prisma ORM, PostgreSQL, TensorFlow.js, NextAuth.js, Docker.

## Glossary

- **Orchestrator**: The Central Orchestrator service that owns the workflow state machine and routes events between modules.
- **WorkflowRun**: A persisted record representing a single execution of a workflow, including its current state and event history.
- **WorkflowEvent**: An immutable log entry recording a state transition within a WorkflowRun.
- **ApprovalGate**: A blocking checkpoint in a workflow that requires a human with a specific role to approve or reject before the workflow advances.
- **Sales_Intelligence**: The ML-based demand forecasting module powered by TensorFlow.js.
- **Production_Planner**: The Production Planning module responsible for MRP and BOM explosion.
- **Inventory_Manager**: The Inventory Management module responsible for stock tracking and shortage detection.
- **Procurement**: The Supplier & Procurement module responsible for purchase order lifecycle management.
- **Finance**: The Finance module responsible for budget validation and PO approval.
- **HR**: The HR module providing minimal employee record management.
- **LLM**: The LLM Intelligence module providing natural language summaries.
- **Auth**: The authentication and RBAC middleware layer.
- **BOM**: Bill of Materials — the list of raw materials and quantities required to produce one unit of a product.
- **MRP**: Material Requirements Planning — the calculation of raw material needs from forecast demand and BOM.
- **PO**: Purchase Order.
- **SKU**: Stock Keeping Unit — a unique identifier for a product or material.
- **MAE**: Mean Absolute Error — a model accuracy metric.
- **RMSE**: Root Mean Square Error — a model accuracy metric.
- **R²**: R-squared — a model fit metric.
- **RBAC**: Role-Based Access Control.
- **JWT**: JSON Web Token used for session authentication.
- **MLOps**: Machine Learning Operations — the feedback loop for continuous model improvement.

---

## Requirements

### Requirement 1: Authentication and Session Management

**User Story:** As a user, I want to log in with my credentials and receive a scoped session token, so that I can access the system securely according to my role.

#### Acceptance Criteria

1. WHEN a user submits valid credentials to `POST /api/auth/login`, THE Auth SHALL return a JWT containing the user's ID and role.
2. WHEN a user submits invalid credentials, THE Auth SHALL return a 401 error response.
3. THE Auth SHALL issue JWTs with a configurable expiry TTL.
4. WHEN a request arrives at any API route without a valid JWT, THE Auth SHALL reject the request with a 401 response.
5. WHEN a request arrives with a JWT whose role does not satisfy the route's required permission, THE Auth SHALL reject the request with a 403 response.

---

### Requirement 2: Role-Based Access Control

**User Story:** As a system administrator, I want each user to be assigned exactly one role, so that access to modules and actions is controlled by least privilege.

#### Acceptance Criteria

1. THE Auth SHALL enforce one of seven roles per user: ADMIN, SALES_ANALYST, PRODUCTION_PLANNER, INVENTORY_MANAGER, PROCUREMENT_OFFICER, FINANCE_MANAGER, or EXECUTIVE.
2. WHEN an ApprovalGate is resolved, THE Orchestrator SHALL verify that the resolving user's role matches the `requiredRole` on the gate before accepting the decision.
3. IF a user attempts to resolve an ApprovalGate with a non-matching role, THEN THE Orchestrator SHALL reject the request with a 403 response.
4. WHERE the ADMIN role is active, THE Auth SHALL grant access to all modules and actions.

---

### Requirement 3: Central Orchestrator — Workflow Lifecycle

**User Story:** As a system operator, I want to trigger and track enterprise workflows, so that cross-module processes are coordinated reliably.

#### Acceptance Criteria

1. WHEN a workflow is triggered via `POST /api/orchestrator/trigger`, THE Orchestrator SHALL create a WorkflowRun record with state `INITIATED` and persist it to the database.
2. THE Orchestrator SHALL support three workflow types: `DEMAND_TO_PLAN`, `PLAN_TO_PRODUCE`, and `PROCURE_TO_PAY`.
3. WHEN a WorkflowRun state changes, THE Orchestrator SHALL persist a WorkflowEvent record capturing `fromState`, `toState`, `eventType`, and `occurredAt`.
4. WHEN `GET /api/orchestrator/status/{runId}` is called, THE Orchestrator SHALL return the current WorkflowRun state and any pending ApprovalGates.
5. THE Orchestrator SHALL never transition a WorkflowRun to a state that is not a valid successor of its current state.
6. IF a module action throws an unhandled error, THEN THE Orchestrator SHALL set the WorkflowRun state to `FAILED` and log a WorkflowEvent with error metadata.

---

### Requirement 4: Central Orchestrator — Approval Gates

**User Story:** As a human approver, I want to review and approve or reject workflow checkpoints, so that critical decisions require human authorization before proceeding.

#### Acceptance Criteria

1. WHEN the Orchestrator reaches a checkpoint requiring human review, THE Orchestrator SHALL create an ApprovalGate record with status `PENDING` and block workflow progression.
2. WHEN an approver submits a decision via `POST /api/orchestrator/approve`, THE Orchestrator SHALL update the ApprovalGate status to `APPROVED` or `REJECTED` and record `resolvedBy` and `resolvedAt`.
3. WHEN an ApprovalGate is `APPROVED`, THE Orchestrator SHALL advance the WorkflowRun to the next valid state.
4. WHEN an ApprovalGate is `REJECTED`, THE Orchestrator SHALL set the WorkflowRun state to `REJECTED` and stop further progression.
5. WHILE an ApprovalGate is `PENDING`, THE Orchestrator SHALL not advance the WorkflowRun state.
6. IF an ApprovalGate remains `PENDING` beyond a configurable timeout threshold, THEN THE Orchestrator SHALL re-send a notification to the required role without auto-approving.

---

### Requirement 5: Sales Intelligence — Model Training

**User Story:** As a Sales Analyst, I want to train ML forecasting models on historical sales data, so that I can generate demand predictions for planning.

#### Acceptance Criteria

1. WHEN a model training request is submitted, THE Sales_Intelligence SHALL train a model of the requested type using historical SalesRecord data from the database.
2. THE Sales_Intelligence SHALL support model types: `LINEAR_REGRESSION`, `RANDOM_FOREST`, `XGBOOST`, and `ARIMA`.
3. WHEN training completes, THE Sales_Intelligence SHALL compute and persist MAE, RMSE, and R² metrics for the trained model.
4. IF model training fails due to insufficient data or numerical error, THEN THE Sales_Intelligence SHALL return a descriptive error and THE Orchestrator SHALL set the WorkflowRun state to `FAILED`.
5. THE Sales_Intelligence SHALL maintain a leaderboard ranking all trained models by their accuracy metrics, accessible via `getLeaderboard()`.

---

### Requirement 6: Sales Intelligence — Forecasting and Approval

**User Story:** As a Sales Analyst, I want to generate a demand forecast and submit it for approval, so that downstream planning only uses authorized predictions.

#### Acceptance Criteria

1. WHEN a forecast is requested, THE Sales_Intelligence SHALL use the specified trained model to produce predictions for the requested horizon in days.
2. WHEN a forecast is generated, THE Sales_Intelligence SHALL persist a ForecastResult record with status `DRAFT`.
3. WHEN a forecast is submitted for approval, THE Sales_Intelligence SHALL set the ForecastResult status to `PENDING_APPROVAL` and THE Orchestrator SHALL create a `FORECAST_APPROVAL` gate.
4. WHEN a forecast is approved, THE Sales_Intelligence SHALL set the ForecastResult status to `APPROVED` and record `approvedBy` and `approvedAt`.
5. WHEN actual sales data is recorded via `recordActuals`, THE Sales_Intelligence SHALL persist the actuals and make them available for future model retraining.

---

### Requirement 7: Production Planning — MRP and BOM

**User Story:** As a Production Planner, I want to run MRP from an approved forecast, so that I know exactly what to produce and what raw materials are needed.

#### Acceptance Criteria

1. WHEN MRP is run against an approved ForecastResult, THE Production_Planner SHALL explode the BOM for each forecasted product to derive raw material requirements.
2. FOR each product in the forecast, THE Production_Planner SHALL multiply the forecasted quantity by the BOM quantity per unit to compute total material requirements.
3. WHEN a ProductionPlan is generated, THE Production_Planner SHALL persist it with status `DRAFT` and link it to the source ForecastResult.
4. WHEN a ProductionPlan is authorized, THE Production_Planner SHALL set its status to `AUTHORIZED` and record `authorizedBy`.
5. THE Production_Planner SHALL expose a readiness report indicating whether all required materials are available before authorization.

---

### Requirement 8: Inventory Management — Stock Tracking

**User Story:** As an Inventory Manager, I want to track real-time stock levels and detect shortages, so that procurement can be triggered before production is blocked.

#### Acceptance Criteria

1. THE Inventory_Manager SHALL maintain a current on-hand quantity for each material, derived as the sum of all StockLedger delta entries for that material.
2. WHEN a stock update is applied, THE Inventory_Manager SHALL append a StockLedger entry with the delta, reason, and timestamp rather than overwriting the on-hand value directly.
3. WHEN shortage detection is run against a ProductionPlan, THE Inventory_Manager SHALL compare MRP requirements against on-hand quantities and return a ShortageReport listing all materials with insufficient stock.
4. WHEN any material's on-hand quantity falls below its `safetyStock` threshold, THE Inventory_Manager SHALL generate a SafetyStockAlert for that material.
5. WHEN production is completed, THE Inventory_Manager SHALL record the finished goods quantity for the produced product.

---

### Requirement 9: Supplier & Procurement — Purchase Order Lifecycle

**User Story:** As a Procurement Officer, I want to create and track purchase orders for shortage materials, so that raw material gaps are resolved before production begins.

#### Acceptance Criteria

1. WHEN a shortage is identified, THE Procurement SHALL look up qualified suppliers for the shortage material and return a list of matching Supplier records.
2. WHEN a PurchaseOrder is created, THE Procurement SHALL persist it with status `DRAFT`, computing `totalCost` as `quantity × unitCost`.
3. THE Procurement SHALL track PO status through the lifecycle: `DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `ORDERED` → `DELIVERED`.
4. WHEN a PO is submitted for approval, THE Procurement SHALL set its status to `PENDING_APPROVAL` and THE Orchestrator SHALL create a `PO_APPROVAL` gate.
5. WHEN delivery is confirmed via `confirmDelivery`, THE Procurement SHALL set the PO status to `DELIVERED` and trigger a stock update in THE Inventory_Manager for the received quantity.
6. IF a PO is rejected, THEN THE Procurement SHALL set the PO status to `REJECTED` and record the rejection reason.

---

### Requirement 10: Finance — Budget Validation and PO Approval

**User Story:** As a Finance Manager, I want to validate budgets and approve purchase orders, so that spending stays within authorized limits.

#### Acceptance Criteria

1. WHEN a PO approval is requested, THE Finance SHALL check that the PO's `totalCost` does not exceed the available budget for the relevant cost center.
2. IF a PO's `totalCost` exceeds the available budget, THEN THE Finance SHALL return a validation failure and THE Orchestrator SHALL block the PO approval gate.
3. WHEN a PO is approved by Finance, THE Finance SHALL record `approvedBy` and `approvedAt` on the PO and increment the cost center's `committed` balance.
4. WHEN an expense is recorded, THE Finance SHALL persist an Expense record and increment the cost center's `spent` balance.
5. THE Finance SHALL provide a budget summary per cost center showing `totalBudget`, `committed`, and `spent` values.

---

### Requirement 11: HR Module (Minimal)

**User Story:** As an administrator, I want basic employee records and workflow allocation tracking, so that workforce assignments are visible in the system.

#### Acceptance Criteria

1. THE HR SHALL store employee records containing name, email, department, and role.
2. WHEN an employee lookup is requested by ID, THE HR SHALL return the matching Employee record.
3. WHEN employees are listed by department, THE HR SHALL return all Employee records matching the specified department.
4. WHEN an employee is allocated to a workflow, THE HR SHALL record the association between the employee and the WorkflowRun.
5. WHERE the ADMIN role is active, THE Auth SHALL restrict access to employee PII to ADMIN role only.

---

### Requirement 12: LLM Intelligence Module (Minimal)

**User Story:** As an executive or analyst, I want natural language summaries of workflow state and forecasts, so that I can understand system status without reading raw data.

#### Acceptance Criteria

1. WHEN a workflow summary is requested, THE LLM SHALL return a natural language description of the WorkflowRun's current state, recent events, and pending approvals.
2. WHEN a forecast explanation is requested, THE LLM SHALL return a natural language description of the ForecastResult including model type, horizon, and key predictions.

---

### Requirement 13: Demand-to-Plan Workflow Sequencing

**User Story:** As a system operator, I want the Demand-to-Plan workflow to execute modules in the correct sequence with appropriate approval gates, so that the end-to-end process is reliable and auditable.

#### Acceptance Criteria

1. WHEN a `DEMAND_TO_PLAN` workflow is triggered, THE Orchestrator SHALL sequence execution as: Sales Intelligence forecast → FORECAST_APPROVAL gate → Production Planning MRP → Inventory shortage detection → (if shortages) Procurement PO creation → PO_APPROVAL gate → Finance budget validation → PRODUCTION_AUTHORIZATION gate → Production execution → Inventory finished goods update → COMPLETED.
2. WHEN a `DEMAND_TO_PLAN` workflow reaches `PENDING_FORECAST_APPROVAL`, THE Orchestrator SHALL not invoke Production Planning until the gate is resolved.
3. WHEN no shortages are detected, THE Orchestrator SHALL skip the Procurement and PO_APPROVAL steps and proceed directly to the PRODUCTION_AUTHORIZATION gate.
4. WHEN the workflow reaches `COMPLETED`, THE Orchestrator SHALL have persisted WorkflowEvents for every state transition in the run.

---

### Requirement 14: Data Seeding

**User Story:** As a developer, I want the database to be seeded with realistic sales and reference data, so that the system can be demonstrated and tested without manual data entry.

#### Acceptance Criteria

1. THE system SHALL provide a Prisma seed script that loads SalesRecord data from Superstore and Walmart CSV datasets.
2. THE seed script SHALL also create synthetic Supplier, BOMItem, Material, and Budget baseline records sufficient to run a complete Demand-to-Plan workflow.
3. WHEN the seed script is run, THE system SHALL be idempotent — running it multiple times SHALL NOT create duplicate records.

---

### Requirement 15: Deployment

**User Story:** As a developer, I want the system to run in Docker, so that the environment is reproducible and portable.

#### Acceptance Criteria

1. THE system SHALL provide a `docker-compose.yml` that starts the Next.js application and a PostgreSQL database as separate services.
2. WHEN `docker-compose up` is executed, THE system SHALL be accessible on a configurable host port without additional manual configuration.
3. THE system SHALL read all environment-specific configuration (database URL, JWT secret, token TTL) from environment variables.
