'use client';


import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface ProductionPlan {
  id: string;
  forecastId: string;
  status: string;
  createdAt: string;
  orders: Array<{
    id: string;
    productId: string;
    requiredQty: number;
    status: string;
  }>;
  activeWorkflowRun: {
    id: string;
    state: string;
    allocatedEmployee: {
      name: string;
      role: string;
    } | null;
  } | null;
}

interface ReadinessReport {
  planId: string;
  isReady: boolean;
  materials: Array<{
    materialId: string;
    materialSku: string;
    materialName: string;
    required: number;
    available: number;
    shortage: number;
    unit: string;
  }>;
}

export function ProductionDashboardContent() {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizing, setAuthorizing] = useState(false);
  const [triggeringWorkflow, setTriggeringWorkflow] = useState(false);

  useEffect(() => {
    loadProductionData();
    const interval = setInterval(loadProductionData, 10000); // Faster refresh for demo
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      loadReadiness(selectedPlan.id);
    }
  }, [selectedPlan?.id]);

  const loadProductionData = async () => {
    try {
      const response = await fetch('/api/production/plan');
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
        if (data.length > 0 && !selectedPlan) {
          setSelectedPlan(data[0]);
        } else if (selectedPlan) {
          // Update selected plan with fresh data if it changed
          const updated = data.find((p: ProductionPlan) => p.id === selectedPlan.id);
          if (updated) setSelectedPlan(updated);
        }
      }
    } catch (error) {
      console.error('Error loading production plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReadiness = async (planId: string) => {
    try {
      const response = await fetch(`/api/production/plan/${planId}/readiness`);
      if (response.ok) {
        const data = await response.json();
        setReadiness(data);
      }
    } catch (error) {
      console.error('Error loading readiness:', error);
    }
  };

  const handleAuthorize = async () => {
    if (!selectedPlan) return;
    setAuthorizing(true);
    try {
      const response = await fetch(`/api/production/plan/${selectedPlan.id}/authorize`, {
        method: 'POST'
      });
      if (response.ok) {
        loadProductionData();
      } else {
        const data = await response.json();
        alert(`Authorization failed: ${data.error}`);
      }
    } catch (err) {
      alert('Error authorizing plan');
    } finally {
      setAuthorizing(false);
    }
  };

  const handleTriggerWorkflow = async () => {
    if (!selectedPlan) return;
    setTriggeringWorkflow(true);
    try {
      const response = await fetch('/api/orchestrator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PLAN_TO_PRODUCE',
          payload: { planId: selectedPlan.id }
        })
      });
      if (response.ok) {
        loadProductionData();
      } else {
        const data = await response.json();
        alert(`Workflow trigger failed: ${data.error}`);
      }
    } catch (err) {
      alert('Error triggering P2P workflow');
    } finally {
      setTriggeringWorkflow(false);
    }
  };

  const activePlans = plans.filter(p => p.status !== 'COMPLETED');
  const totalRequiredQty = selectedPlan?.orders.reduce((sum, o) => sum + o.requiredQty, 0) || 0;
  const shortageCount = readiness?.materials.filter(m => m.shortage > 0).length || 0;

  return (
    <div>
      <div className="animate-in fade-in duration-500">
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1a202c', letterSpacing: '-0.025em' }}>
              Production Management
            </h1>
            <p style={{ color: '#718096', marginTop: '0.25rem' }}>
              Material Requirements Planning & Execution Control
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
             <div style={{
               padding: '0.5rem 1rem',
               background: '#f7fafc',
               borderRadius: '12px',
               border: '1px solid #e2e8f0',
               fontSize: '0.875rem',
               fontWeight: '600',
               color: '#4a5568',
               display: 'flex',
               alignItems: 'center',
               gap: '0.5rem'
             }}>
               <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#48bb78' }}></span>
               Live System Active
             </div>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard title="Strategic Plans" value={activePlans.length} icon="🎯" subtitle="Pending completion" trend="up" trendValue="Live" />
          <KPICard
            title="Material Readiness"
            value={readiness?.isReady ? "Optimal" : "Concern"}
            icon={readiness?.isReady ? "🛡️" : "🚧"}
            subtitle={readiness ? (readiness.isReady ? "Stock secure" : `${shortageCount} Critical gaps`) : "Assess a plan"}
          />
          <KPICard title="Resource Target" value={totalRequiredQty.toLocaleString()} icon="📦" subtitle="Units in queue" />
          <KPICard title="AI Engine" value="Enabled" icon="🤖" subtitle="Auto-Staffing Active" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '1.5rem', minHeight: '600px' }}>
          {/* Left Sidebar: Plan List */}
          <div style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
              <h3 style={{ fontWeight: '700', color: '#334155', fontSize: '1rem' }}>Lifecycle Inventory</h3>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>Scanning plans...</div>
              ) : plans.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No plans generated.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan)}
                      style={{
                        padding: '1.25rem',
                        background: selectedPlan?.id === plan.id ? 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' : 'white',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        border: selectedPlan?.id === plan.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: selectedPlan?.id === plan.id ? '0 10px 15px -3px rgba(99, 102, 241, 0.1)' : 'none',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {plan.activeWorkflowRun && (
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          padding: '0.25rem 0.5rem',
                          background: '#6366f1',
                          color: 'white',
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          borderBottomLeftRadius: '8px'
                        }}>
                          LIVE RUN
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>Ref: {plan.id.substring(plan.id.length - 8).toUpperCase()}</span>
                        <span style={{
                          padding: '0.125rem 0.625rem',
                          background: plan.status === 'COMPLETED' ? '#dcfce7' : plan.status === 'AUTHORIZED' ? '#dbeafe' : '#fef3c7',
                          color: plan.status === 'COMPLETED' ? '#15803d' : plan.status === 'AUTHORIZED' ? '#1d4ed8' : '#b45309',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: '700',
                          textTransform: 'uppercase'
                        }}>
                          {plan.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                        <span>📅 {new Date(plan.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>📦 {plan.orders.length} Batch{plan.orders.length !== 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Main Area: Plan Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {!selectedPlan ? (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'white',
                borderRadius: '16px',
                border: '1px dashed #cbd5e1',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
                <p style={{ fontWeight: '600' }}>Select a production plan to analyze lifecycle</p>
              </div>
            ) : (
              <>
                {/* Status Bar */}
                <div style={{
                  background: 'white',
                  padding: '1.25rem 2rem',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ display: 'flex', gap: '2rem' }}>
                    <div>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Plan Identity</p>
                      <p style={{ fontWeight: '700', color: '#1e293b' }}>#{selectedPlan.id}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Workflow Orchestration</p>
                      {selectedPlan.activeWorkflowRun ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ height: '8px', width: '8px', borderRadius: '50%', background: '#6366f1', display: 'inline-block', animation: 'pulse 2s infinite' }}></span>
                          <p style={{ fontWeight: '700', color: '#6366f1' }}>{selectedPlan.activeWorkflowRun.state}</p>
                        </div>
                      ) : (
                        <p style={{ fontWeight: '600', color: '#94a3b8' }}>Inactive</p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {!selectedPlan.activeWorkflowRun && selectedPlan.status === 'DRAFT' && (
                      <button
                        onClick={handleTriggerWorkflow}
                        disabled={triggeringWorkflow}
                        style={{
                          padding: '0.625rem 1.25rem',
                          background: '#6366f1',
                          color: 'white',
                          borderRadius: '10px',
                          fontWeight: '700',
                          fontSize: '0.875rem',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.4)',
                          transition: 'all 0.2s'
                        }}
                      >
                         {triggeringWorkflow ? '⚡ Initializing...' : '🚀 Start P2P Workflow'}
                      </button>
                    )}

                    {(['DRAFT', 'PENDING_AUTHORIZATION'].includes(selectedPlan.status)) && (
                      <button
                        onClick={handleAuthorize}
                        disabled={authorizing || !readiness?.isReady}
                        style={{
                          padding: '0.625rem 1.25rem',
                          background: readiness?.isReady ? '#10b981' : '#f1f5f9',
                          color: readiness?.isReady ? 'white' : '#94a3b8',
                          borderRadius: '10px',
                          fontWeight: '700',
                          fontSize: '0.875rem',
                          border: 'none',
                          cursor: readiness?.isReady ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s'
                        }}
                      >
                         {authorizing ? 'Submitting...' : '✅ Authorize Batch'}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 1fr', gap: '1.5rem' }}>
                  {/* MRP Section */}
                  <div style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>Material Explosion (MRP)</h4>
                      <div style={{
                        padding: '0.375rem 0.75rem',
                        background: readiness?.isReady ? '#f0fdf4' : '#fff7ed',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        color: readiness?.isReady ? '#166534' : '#9a3412',
                        border: readiness?.isReady ? '1px solid #bcf0da' : '1px solid #ffedd5'
                      }}>
                        {readiness?.isReady ? 'STOCK SECURE' : 'SHORTAGE DETECTED'}
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0.5rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Material</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Req</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Stock</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem', color: '#64748b', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>Gap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!readiness ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Analyzing stock...</td></tr>
                          ) : readiness.materials.map((m) => (
                            <tr key={m.materialId} style={{ background: '#f8fafc' }}>
                              <td style={{ padding: '1rem', borderRadius: '12px 0 0 12px' }}>
                                <p style={{ fontWeight: '700', color: '#334155', margin: 0 }}>{m.materialName}</p>
                                <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: 0 }}>{m.materialSku}</p>
                              </td>
                              <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600' }}>{m.required} {m.unit}</td>
                              <td style={{ padding: '1rem', textAlign: 'right' }}>{m.available} {m.unit}</td>
                              <td style={{ padding: '1rem', textAlign: 'right', borderRadius: '0 12px 12px 0' }}>
                                {m.shortage > 0 ? (
                                  <span style={{ color: '#ef4444', fontWeight: '800' }}>-{m.shortage}</span>
                                ) : (
                                  <span style={{ color: '#10b981' }}>✅</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Orders & Intelligence Section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                     {/* Batch Detail */}
                     <div style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        padding: '1.5rem',
                        borderRadius: '20px',
                        color: 'white',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: '700', opacity: 0.8, marginBottom: '1rem', textTransform: 'uppercase' }}>Production Batches</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {selectedPlan.orders.map(o => (
                            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.75rem' }}>
                              <div>
                                <p style={{ fontWeight: '800', fontSize: '1rem' }}>{o.productId}</p>
                                <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>Order ID: {o.id.substring(0,8).toUpperCase()}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontWeight: '900', fontSize: '1.25rem', color: '#818cf8' }}>{o.requiredQty}</p>
                                <p style={{ fontSize: '0.6rem', fontWeight: '700', textTransform: 'uppercase' }}>Units</p>
                              </div>
                            </div>
                          ))}
                        </div>
                     </div>

                     {/* AI Insights Card */}
                     <div style={{
                       background: 'white',
                       padding: '1.5rem',
                       borderRadius: '20px',
                       border: '1px solid #e2e8f0',
                       boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                       flex: 1
                     }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>🤖</span>
                          <h4 style={{ fontWeight: '800', color: '#1e293b' }}>AI Staffing Insight</h4>
                        </div>
                        {selectedPlan.activeWorkflowRun ? (
                          <div style={{ padding: '1rem', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                            <p style={{ fontSize: '0.875rem', color: '#5b21b6', lineHeight: '1.5', fontWeight: '500' }}>
                              The <b>AI Orchestrator</b> has automatically allocated the <b>Least Busy</b> production manager to this run to ensure zero bottlenecks.
                            </p>
                            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#818cf8',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: 'white',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                {selectedPlan.activeWorkflowRun.allocatedEmployee?.name.split(' ').map(n => n[0]).join('') || 'AI'}
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b' }}>
                                {selectedPlan.activeWorkflowRun.allocatedEmployee?.name || 'Allocating...'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', textAlign: 'center' }}>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Start a workflow to trigger AI staffing allocation.</p>
                          </div>
                        )}
                     </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  );
}
