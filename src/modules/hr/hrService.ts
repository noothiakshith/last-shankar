import prisma from '@/lib/prisma';
import { Employee, WorkflowRun, Prisma } from '@prisma/client';

export function filterEmployeesByDepartment(employees: Employee[], department?: string | null): Employee[] {
  if (!department) return employees;
  return employees.filter(e => e.department === department);
}

export class HRService {
  async getEmployee(id: string): Promise<Employee> {
    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) throw new Error('Employee not found');
    return employee;
  }

  async listEmployeesByDepartment(department?: string | null): Promise<Employee[]> {
    const allEmployees = await prisma.employee.findMany();
    return filterEmployeesByDepartment(allEmployees, department);
  }

  async allocateToWorkflow(employeeId: string, workflowRunId: string): Promise<WorkflowRun> {
    const employee = await this.getEmployee(employeeId);
    
    const workflow = await prisma.workflowRun.findUnique({ where: { id: workflowRunId } });
    if (!workflow) throw new Error('Workflow run not found');

    const payloadObj = (workflow.payload && typeof workflow.payload === 'object' && !Array.isArray(workflow.payload)) 
                         ? (workflow.payload as Record<string, unknown>) 
                         : {};

    return prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        payload: {
          ...payloadObj,
          allocatedEmployeeId: employee.id,
        }
      }
    });
  }
}

export const hrService = new HRService();
