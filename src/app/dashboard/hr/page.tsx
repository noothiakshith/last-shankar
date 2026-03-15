'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface Employee {
  id: string;
  name: string;
  role: string;
  department?: string;
  costCenter?: string;
  status: string;
}

export default function HRDashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/hr/employees');
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (err) {
      console.error('Error loading employees:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async (employeeId: string) => {
    const workflowRunId = prompt('Enter workflow run ID (e.g., wf_abc123):');
    if (!workflowRunId) return;

    try {
      const response = await fetch(`/api/hr/employee/${employeeId}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowRunId })
      });

      if (response.ok) {
        alert('Employee allocated successfully');
        loadEmployees();
      } else {
        const error = await response.json();
        alert(`Allocation failed: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Error allocating employee');
    }
  };

  const activeEmployees = employees.filter(e => e.status === 'ACTIVE');
  const allocatedEmployees = employees.filter(e => e.costCenter);

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Human Resources Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Employee management and cost center allocation
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard
            title="Total Employees"
            value={employees.length}
            icon="👥"
            subtitle="All employees"
          />
          <KPICard
            title="Active"
            value={activeEmployees.length}
            icon="✅"
            subtitle="Currently active"
          />
          <KPICard
            title="Allocated"
            value={allocatedEmployees.length}
            icon="📍"
            subtitle="To cost centers"
          />
          <KPICard
            title="Utilization"
            value={employees.length > 0 ? `${((allocatedEmployees.length / employees.length) * 100).toFixed(0)}%` : '0%'}
            icon="📊"
            trend="up"
            trendValue="+5%"
          />
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            Employee Directory
          </h4>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              Loading employees...
            </div>
          ) : employees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              No employees found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Name
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Role
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Department
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Cost Center
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Status
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: '#4a5568' }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {employee.name}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#718096' }}>
                        {employee.role}
                      </td>
                      <td style={{ padding: '0.75rem', color: '#718096' }}>
                        {employee.department || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {employee.costCenter ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            background: '#d1fae5',
                            color: '#065f46',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            fontWeight: '500'
                          }}>
                            {employee.costCenter}
                          </span>
                        ) : (
                          <span style={{ color: '#a0aec0', fontSize: '0.85rem' }}>
                            Not allocated
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          background: employee.status === 'ACTIVE' ? '#d1fae5' : '#fee2e2',
                          color: employee.status === 'ACTIVE' ? '#065f46' : '#991b1b',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          fontWeight: '500'
                        }}>
                          {employee.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <button
                          onClick={() => handleAllocate(employee.id)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                          }}
                        >
                          Allocate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{
          marginTop: '1.5rem',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            Quick Actions
          </h4>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={loadEmployees}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#edf2f7',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🔄 Refresh Data
            </button>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                background: '#edf2f7',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📊 Export Report
            </button>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                background: '#edf2f7',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              ➕ Add Employee
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
