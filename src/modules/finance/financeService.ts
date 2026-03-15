import prisma from '@/lib/prisma'
import { Budget, Prisma, Expense, ApprovalGateType, ApprovalStatus, Role } from '@prisma/client'
import { orchestratorService } from '@/modules/orchestrator/orchestratorService'

// --- Pure calculation functions for property testing ---

export function checkBudgetValidity(amount: number, totalBudget: number, committed: number, spent: number): boolean {
  if (amount < 0) return false;
  return amount <= (totalBudget - committed - spent);
}

export function calculateNewCommitted(poTotalCost: number, currentCommitted: number): number {
  return currentCommitted + poTotalCost;
}

export function calculateNewSpent(expenseAmount: number, currentSpent: number): number {
  return currentSpent + expenseAmount;
}

// --- Service layer functions ---

export async function validateBudget(amount: number, costCenter: string): Promise<boolean> {
  const budget = await prisma.budget.findUnique({ where: { costCenter } })
  if (!budget) return false
  return checkBudgetValidity(amount, budget.totalBudget, budget.committed, budget.spent)
}

export async function getBudgetSummary(costCenter: string): Promise<Budget> {
  const budget = await prisma.budget.findUnique({ where: { costCenter } })
  if (!budget) throw new Error('Budget not found')
  return budget
}

export async function approvePO(poId: string, approvedBy: string, costCenter: string = 'PROCUREMENT'): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
  if (!po) throw new Error('PO not found')
  
  // Idempotency check: if already approved, just return
  if (po.status === 'APPROVED') return;
  
  const isValid = await validateBudget(po.totalCost, costCenter)
  if (!isValid) throw new Error('Insufficient budget for PO')

  await prisma.$transaction([
    prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      },
    }),
    prisma.budget.update({
      where: { costCenter },
      data: {
        committed: { increment: po.totalCost },
      },
    }),
  ])

  // Resolve orchestrator approval gate if it exists for this PO
  await orchestratorService.resolveApprovalByPayload(
    ApprovalGateType.PO_APPROVAL,
    'poIds',
    poId,
    Role.FINANCE_MANAGER,
    approvedBy,
    true
  );
}

export async function rejectPO(poId: string, rejectedBy: string): Promise<void> {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
  if (!po) throw new Error('PO not found')
  
  // Idempotency check
  if (po.status === 'REJECTED') return;

  await prisma.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: 'REJECTED',
    },
  })

  // Resolve orchestrator approval gate if it exists for this PO
  await orchestratorService.resolveApprovalByPayload(
    ApprovalGateType.PO_APPROVAL,
    'poIds',
    poId,
    Role.FINANCE_MANAGER,
    rejectedBy,
    false
  );
}


export async function recordExpense(expense: { costCenter: string, amount: number, description: string, reference?: string }): Promise<Expense> {
  if (expense.amount <= 0) throw new Error('Expense amount must be positive')
  
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const exp = await tx.expense.create({
      data: {
        costCenter: expense.costCenter,
        amount: expense.amount,
        description: expense.description,
        reference: expense.reference,
      },
    })

    await tx.budget.update({
      where: { costCenter: expense.costCenter },
      data: { spent: { increment: expense.amount } }
    })
    
    return exp
  })
}
