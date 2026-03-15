'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface PurchaseOrder {
  id: string;
  totalCost: number;
  status: string;
  materialId: string;
  quantity: number;
}

interface Budget {
  totalBudget: number;
  committed: number;
  spent: number;
}

export default function FinanceDashboard() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [pendingPOs, setPendingPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [budgetRes, posRes] = await Promise.all([
        fetch('/api/finance/budget/PROCUREMENT'),
        fetch('/api/procurement/po')
      ]);

      if (budgetRes.ok) {
        const budgetData = await budgetRes.json();
        setBudget(budgetData);
      }

      if (posRes.ok) {
        const posData = await posRes.json();
        setPendingPOs(posData.filter((po: PurchaseOrder) => po.status === 'PENDING_APPROVAL'));
      }
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (poId: string) => {
    try {
      const response = await fetch(`/api/finance/po/${poId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        alert('PO approved successfully');
        loadData();
      } else {
        const error = await response.json();
        alert(`Approval failed: ${error.error}`);
      }
    } catch (error) {
      alert('Error approving PO');
    }
  };

  const handleReject = async (poId: string) => {
    try {
      const response = await fetch(`/api/finance/po/${poId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        alert('PO rejected successfully');
        loadData();
      } else {
        const error = await response.json();
        alert(`Rejection failed: ${error.error}`);
      }
    } catch (error) {
      alert('Error rejecting PO');
    }
  };

  const totalBudget = budget?.totalBudget || 1000000;
  const committed = budget?.committed || 0;
  const spent = budget?.spent || 0;
  const available = totalBudget - committed - spent;
  const utilization = ((committed + spent) / totalBudget * 100).toFixed(1);

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Finance Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Budget monitoring and financial governance
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard title="Total Budget" value={`${(totalBudget / 1000).toFixed(0)}K`} icon="💰" subtitle="Annual allocation" />
          <KPICard title="Committed" value={`${(committed / 1000).toFixed(1)}K`} icon="📝" subtitle="Pending expenses" />
          <KPICard title="Spent" value={`${(spent / 1000).toFixed(1)}K`} icon="💸" />
          <KPICard title="Available" value={`${(available / 1000).toFixed(0)}K`} icon="✅" subtitle={`${utilization}% used`} />
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Budget Utilization
          </h4>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', color: '#718096' }}>Utilization</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{utilization}%</span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '24px', 
              background: '#e2e8f0', 
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${utilization}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
            <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' }}>
                ${(totalBudget / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>Total</div>
            </div>
            <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ed8936' }}>
                ${((committed + spent) / 1000).toFixed(1)}K
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>Used</div>
            </div>
            <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#48bb78' }}>
                ${(available / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '0.25rem' }}>Available</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Pending Approvals
            </h4>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                Loading...
              </div>
            ) : pendingPOs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No pending approvals
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingPOs.map((po) => (
                  <div key={po.id} style={{ 
                    padding: '1rem', 
                    background: '#fef5e7', 
                    borderRadius: '6px',
                    borderLeft: '4px solid #f59e0b'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>{po.id.substring(0, 8)}</span>
                      <span style={{ fontWeight: '600', color: '#d97706' }}>${po.totalCost.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#92400e', marginBottom: '0.75rem' }}>
                      {po.materialId} - Qty: {po.quantity}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleApprove(po.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#48bb78',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleReject(po.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#f56565',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Budget Status
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Total Budget
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                  ${totalBudget.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Committed (Pending POs)
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#ed8936' }}>
                  ${committed.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Spent
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#f56565' }}>
                  ${spent.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#c6f6d5', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#22543d', marginBottom: '0.25rem' }}>
                  Available
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#22543d' }}>
                  ${available.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
