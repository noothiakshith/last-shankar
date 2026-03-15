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

    return prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: {
        allocatedEmployeeId: employee.id,
      }
    });
  }

  /**
   * AI-Driven Workload Balancing: Finds the employee in a specific department
   * with the fewest active tasks.
   */
  async getLeastBusyEmployee(department: string): Promise<Employee | null> {
    const employees = await this.listEmployeesByDepartment(department);
    if (employees.length === 0) return null;

    const workloadMap = await Promise.all(employees.map(async (emp) => {
      const activeTaskCount = await prisma.workflowRun.count({
        where: {
          allocatedEmployeeId: emp.id,
          state: {
            notIn: ['COMPLETED', 'FAILED', 'REJECTED']
          }
        }
      });
      return { emp, activeTaskCount };
    }));

    // Sort by workload (ascending)
    workloadMap.sort((a, b) => a.activeTaskCount - b.activeTaskCount);
    
    return workloadMap[0].emp;
  }
}

export const hrService = new HRService();

