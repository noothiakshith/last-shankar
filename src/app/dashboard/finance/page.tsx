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
  workflowRunId: string | null;
  supplier: {
    name: string;
  };
}

interface Batch {
  workflowId: string;
  workflowRun: {
    id: string;
    type: string;
    state: string;
    createdAt: string;
  };
  pos: PurchaseOrder[];
  batchTotal: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  allApproved: boolean;
}

interface Budget {
  totalBudget: number;
  committed: number;
  spent: number;
}

export default function FinanceDashboard() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [unlinkedPOs, setUnlinkedPOs] = useState<PurchaseOrder[]>([]);
  const [selectedPOs, setSelectedPOs] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await fetch('/api/finance/po/batches');
      if (response.ok) {
        const data = await response.json();
        setBudget(data.budget);
        setBatches(data.batches);
        setUnlinkedPOs(data.unlinked);
        
        // Initialize all POs as selected for each batch (including rejected ones)
        const initialSelection: Record<string, string[]> = {};
        data.batches.forEach((batch: Batch) => {
          initialSelection[batch.workflowId] = batch.pos
            .filter(po => po.status === 'PENDING_APPROVAL' || po.status === 'REJECTED')
            .map(po => po.id);
        });
        setSelectedPOs(initialSelection);
      }
    } catch (error) {
      console.error('Error loading finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePOSelection = (workflowId: string, poId: string) => {
    setSelectedPOs(prev => {
      const current = prev[workflowId] || [];
      const newSelection = current.includes(poId)
        ? current.filter(id => id !== poId)
        : [...current, poId];
      return { ...prev, [workflowId]: newSelection };
    });
  };

  const handleBatchApprove = async (workflowId: string) => {
    const poIds = selectedPOs[workflowId] || [];
    if (poIds.length === 0) {
      alert('No POs selected for approval');
      return;
    }

    // Check if any rejected POs are being approved
    const batch = batches.find(b => b.workflowId === workflowId);
    const selectedPOsData = batch?.pos.filter(po => poIds.includes(po.id)) || [];
    const rejectedPOs = selectedPOsData.filter(po => po.status === 'REJECTED');
    
    if (rejectedPOs.length > 0) {
      const confirmMessage = `⚠️ WARNING: You are about to approve ${rejectedPOs.length} previously REJECTED PO(s).\n\nRejected POs:\n${rejectedPOs.map(po => `- ${po.id.substring(0, 12)}... ($${po.totalCost.toLocaleString()})`).join('\n')}\n\nAre you sure you want to proceed with approval?`;
      
      if (!confirm(confirmMessage)) {
        return;
      }
    }

    try {
      const response = await fetch('/api/finance/po/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId, poIds })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        // Reload data to refresh budget and PO list
        await loadData();
      } else {
        const error = await response.json();
        alert(`Approval failed: ${error.error}`);
      }
    } catch (error) {
      alert('Error approving batch');
    }
  };

  const handleBatchReject = async (workflowId: string) => {
    if (!confirm('Are you sure you want to reject this entire batch?')) return;

    try {
      const response = await fetch('/api/finance/po/batch-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId })
      });

      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        loadData();
      } else {
        const error = await response.json();
        alert(`Rejection failed: ${error.error}`);
      }
    } catch (error) {
      alert('Error rejecting batch');
    }
  };

  const handleIndividualApprove = async (poId: string) => {
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

  const handleIndividualReject = async (poId: string) => {
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
            Budget monitoring and batch PO approval
          </p>
        </div>

        {/* KPI Cards */}
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

        {/* Budget Utilization Bar */}
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

        {/* PO Batches by Workflow */}
        <div style={{ marginBottom: '2rem' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
            PO Batches by Workflow
          </h4>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              Loading...
            </div>
          ) : batches.length === 0 ? (
            <div style={{ 
              background: 'white', 
              padding: '2rem', 
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              color: '#718096'
            }}>
              No workflow batches pending approval
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {batches.map((batch) => (
                <div key={batch.workflowId} style={{
                  background: batch.allApproved ? '#c6f6d5' : 'white',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  border: batch.allApproved ? '2px solid #48bb78' : '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {batch.allApproved ? '✅ ' : ''}Workflow: {batch.workflowRun.type}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                        ID: {batch.workflowId.substring(0, 12)}... | State: {batch.workflowRun.state}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#667eea' }}>
                        ${batch.batchTotal.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                        {batch.pendingCount} pending, {batch.approvedCount} approved, {batch.rejectedCount} rejected
                      </div>
                    </div>
                  </div>

                  {!batch.allApproved && (
                    <>
                      <div style={{ marginBottom: '1rem' }}>
                        {batch.pos.map((po) => (
                          <div key={po.id} style={{
                            padding: '0.75rem',
                            background: po.status === 'APPROVED' ? '#e6fffa' : po.status === 'REJECTED' ? '#fed7d7' : '#fef5e7',
                            borderRadius: '6px',
                            marginBottom: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            border: po.status === 'REJECTED' ? '2px solid #fc8181' : 'none'
                          }}>
                            {(po.status === 'PENDING_APPROVAL' || po.status === 'REJECTED') && (
                              <input
                                type="checkbox"
                                checked={(selectedPOs[batch.workflowId] || []).includes(po.id)}
                                onChange={() => togglePOSelection(batch.workflowId, po.id)}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                              />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                                  {po.status === 'APPROVED' ? '✓ ' : po.status === 'REJECTED' ? '⚠️ ' : ''}{po.id.substring(0, 12)}...
                                </span>
                                <span style={{ fontWeight: '600', color: po.status === 'APPROVED' ? '#38a169' : po.status === 'REJECTED' ? '#e53e3e' : '#d97706' }}>
                                  ${po.totalCost.toLocaleString()}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                                {po.supplier.name} | {po.materialId} | Qty: {po.quantity.toFixed(2)}
                                {po.status === 'REJECTED' && <span style={{ color: '#e53e3e', fontWeight: '600', marginLeft: '0.5rem' }}>(REJECTED - Can be re-approved)</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                          onClick={() => handleBatchApprove(batch.workflowId)}
                          disabled={!selectedPOs[batch.workflowId] || selectedPOs[batch.workflowId].length === 0}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: (!selectedPOs[batch.workflowId] || selectedPOs[batch.workflowId].length === 0) ? '#cbd5e0' : '#48bb78',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (!selectedPOs[batch.workflowId] || selectedPOs[batch.workflowId].length === 0) ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}
                        >
                          Approve Selected ({(selectedPOs[batch.workflowId] || []).length})
                        </button>
                        <button
                          onClick={() => handleBatchReject(batch.workflowId)}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: '#f56565',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600'
                          }}
                        >
                          Reject Batch
                        </button>
                      </div>
                    </>
                  )}

                  {batch.allApproved && (
                    <div style={{ 
                      padding: '1rem', 
                      background: '#f0fff4', 
                      borderRadius: '6px',
                      textAlign: 'center',
                      color: '#22543d',
                      fontWeight: '600'
                    }}>
                      All POs in this batch have been approved
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unlinked POs and Budget Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Unlinked POs ({unlinkedPOs.length})
            </h4>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                Loading...
              </div>
            ) : unlinkedPOs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No unlinked POs
              </div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {unlinkedPOs.slice(0, 10).map((po) => (
                  <div key={po.id} style={{ 
                    padding: '1rem', 
                    background: '#fef5e7', 
                    borderRadius: '6px',
                    borderLeft: '4px solid #f59e0b'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{po.id.substring(0, 12)}...</span>
                      <span style={{ fontWeight: '600', color: '#d97706' }}>${po.totalCost.toLocaleString()}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#92400e', marginBottom: '0.75rem' }}>
                      {po.materialId} - Qty: {po.quantity.toFixed(2)}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleIndividualApprove(po.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#48bb78',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        Approve
                      </button>
                      <button 
                        onClick={() => handleIndividualReject(po.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#f56565',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {unlinkedPOs.length > 10 && (
                  <div style={{ textAlign: 'center', padding: '0.5rem', color: '#718096', fontSize: '0.85rem' }}>
                    ... and {unlinkedPOs.length - 10} more
                  </div>
                )}
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
