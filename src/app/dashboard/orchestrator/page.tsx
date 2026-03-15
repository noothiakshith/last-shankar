'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface WorkflowEvent {
  id: string;
  eventType: string;
  moduleName: string;
  occurredAt: string;
}

interface WorkflowApproval {
  id: string;
  approvalType: string;
  status: string;
}

interface Workflow {
  id: string;
  state: string;
  createdAt: string;
  events: WorkflowEvent[];
  approvals: WorkflowApproval[];
}

export default function OrchestratorDashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [loadingSummaries, setLoadingSummaries] = useState<Record<string, boolean>>({});
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({ type: 'DEMAND_TO_PLAN', planId: '', productId: 'prod-widget-a' });

  useEffect(() => {
    loadWorkflows();
    const interval = setInterval(loadWorkflows, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/orchestrator/workflows?limit=20');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (err) {
      console.error('Error loading workflows:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async (runId: string) => {
    if (summaries[runId] || loadingSummaries[runId]) return;
    
    setLoadingSummaries(prev => ({ ...prev, [runId]: true }));
    try {
      const response = await fetch(`/api/llm/workflow/${runId}/summary`);
      if (response.ok) {
        const data = await response.json();
        setSummaries(prev => ({ ...prev, [runId]: data.summary }));
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    } finally {
      setLoadingSummaries(prev => ({ ...prev, [runId]: false }));
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const payload = newWorkflow.type === 'DEMAND_TO_PLAN' 
        ? { productId: newWorkflow.productId }
        : { planId: newWorkflow.planId };

      const response = await fetch('/api/orchestrator/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newWorkflow.type, payload })
      });

      if (response.ok) {
        alert('Workflow triggered successfully');
        setShowTriggerModal(false);
        loadWorkflows();
      } else {
        const data = await response.json();
        alert(`Failed to trigger: ${data.error}`);
      }
    } catch (err) {
      alert('Error triggering workflow');
    } finally {
      setTriggering(false);
    }
  };

  const getStateColor = (state: string) => {
    if (state === 'COMPLETED') return '#48bb78';
    if (state === 'FAILED' || state === 'REJECTED') return '#f56565';
    if (state.includes('PENDING')) return '#ed8936';
    return '#4299e1';
  };

  const getModuleFromState = (state: string): string => {
    if (state.includes('FORECAST')) return 'Sales';
    if (state.includes('PLANNING') || state.includes('PRODUCTION')) return 'Production';
    if (state.includes('INVENTORY')) return 'Inventory';
    if (state.includes('PROCUREMENT') || state.includes('PO')) return 'Procurement';
    if (state.includes('FINANCE') || state.includes('BUDGET')) return 'Finance';
    return 'System';
  };

  const activeWorkflows = workflows.filter(w => !['COMPLETED', 'FAILED', 'REJECTED'].includes(w.state));
  const pendingApprovals = workflows.reduce((sum, w) => sum + w.approvals.length, 0);
  const completedToday = workflows.filter(w => {
    const today = new Date().toDateString();
    return w.state === 'COMPLETED' && new Date(w.createdAt).toDateString() === today;
  }).length;

  // Get recent events from all workflows
  const allEvents = workflows.flatMap(w => 
    w.events.map(e => ({ ...e, workflowId: w.id, state: w.state }))
  ).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()).slice(0, 5);

  // Module status based on active workflows
  const moduleStatus = {
    Sales: workflows.some(w => w.state.includes('FORECAST')) ? 'Active' : 'Idle',
    Production: workflows.some(w => w.state.includes('PLANNING') || w.state.includes('PRODUCTION')) ? 'Active' : 'Idle',
    Inventory: workflows.some(w => w.state.includes('INVENTORY')) ? 'Active' : 'Idle',
    Procurement: workflows.some(w => w.state.includes('PROCUREMENT') || w.state.includes('PO')) ? 'Active' : 'Idle',
    Finance: workflows.some(w => w.state.includes('FINANCE') || w.state.includes('BUDGET')) ? 'Active' : 'Idle'
  };

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Central Orchestrator Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Enterprise workflow coordination and system intelligence layer
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard
            title="Active Workflows"
            value={activeWorkflows.length}
            icon="🎯"
            subtitle="Currently running"
          />
          <KPICard
            title="Pending Approvals"
            value={pendingApprovals}
            icon="⏳"
            subtitle="Awaiting action"
          />
          <KPICard
            title="Completed Today"
            value={completedToday}
            icon="✅"
            subtitle="Finished workflows"
          />
          <KPICard
            title="Total Workflows"
            value={workflows.length}
            icon="📊"
            subtitle="All time"
          />
        </div>

        {/* AI Insight Section */}
        {activeWorkflows.length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '2rem',
            borderRadius: '12px',
            color: 'white',
            marginBottom: '2rem',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>AI System Intelligence</h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {activeWorkflows.slice(0, 2).map((w) => (
                  <div key={w.id} style={{ background: 'rgba(255, 255, 255, 0.1)', padding: '1.25rem', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>Workflow: {w.id.slice(0, 8)}...</span>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        padding: '0.2rem 0.5rem', 
                        background: 'rgba(255,255,255,0.2)', 
                        borderRadius: '4px' 
                      }}>{w.state}</span>
                    </div>
                    
                    {summaries[w.id] ? (
                      <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>{summaries[w.id]}</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                          {loadingSummaries[w.id] ? 'Generating executive insight...' : 'AI analysis available for this workflow.'}
                        </p>
                        {!loadingSummaries[w.id] && (
                          <button 
                            onClick={() => fetchSummary(w.id)}
                            style={{
                              alignSelf: 'flex-start',
                              padding: '0.4rem 0.8rem',
                              background: 'white',
                              color: '#667eea',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            Generate Insight
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ 
              position: 'absolute', 
              top: '-20px', 
              right: '-20px', 
              fontSize: '10rem', 
              opacity: 0.1,
              transform: 'rotate(15deg)'
            }}>🧠</div>
          </div>
        )}

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600' }}>
              Workflow Pipeline
            </h4>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowTriggerModal(true)}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
              >
                🚀 Trigger New Workflow
              </button>
              <button
                onClick={loadWorkflows}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
          <div style={{ 
            display: 'flex', 
            overflowX: 'auto', 
            gap: '0.5rem',
            padding: '1rem 0'
          }}>
            {['Sales', 'Production', 'Inventory', 'Procurement', 'Finance', 'Execution'].map((stage, idx) => {
              const isActive = Object.entries(moduleStatus).some(([mod, status]) => 
                mod === stage && status === 'Active'
              );
              return (
                <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    padding: '1rem 1.5rem',
                    background: isActive ? '#667eea' : '#edf2f7',
                    color: isActive ? 'white' : '#1a202c',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    whiteSpace: 'nowrap',
                    minWidth: '120px',
                    textAlign: 'center'
                  }}>
                    {stage}
                  </div>
                  {idx < 5 && (
                    <div style={{ padding: '0 0.5rem', color: '#a0aec0', fontSize: '1.5rem' }}>
                      →
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '2fr 1fr', 
          gap: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Recent Workflow Events
            </h4>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                Loading events...
              </div>
            ) : allEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
                No recent events
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: '1rem',
                      background: '#f7fafc',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${getStateColor(event.state)}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600', color: '#1a202c' }}>{event.eventType}</span>
                      <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                        {new Date(event.occurredAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                      Module: {event.moduleName} • State: {event.state}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
                      Workflow: {event.workflowId}
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
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Module Status
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { name: 'Sales', icon: '📈' },
                { name: 'Production', icon: '🏭' },
                { name: 'Inventory', icon: '📦' },
                { name: 'Procurement', icon: '🛒' },
                { name: 'Finance', icon: '💰' }
              ].map((module) => {
                const status = moduleStatus[module.name as keyof typeof moduleStatus];
                return (
                  <div
                    key={module.name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.75rem',
                      background: '#f7fafc',
                      borderRadius: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{module.icon}</span>
                      <span style={{ fontWeight: '500' }}>{module.name}</span>
                    </div>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: status === 'Active' ? '#c6f6d5' : '#e2e8f0',
                      color: status === 'Active' ? '#22543d' : '#4a5568',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Trigger Modal */}
        {showTriggerModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              padding: '2rem',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Trigger New Workflow</h4>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Workflow Type</label>
                <select 
                  value={newWorkflow.type}
                  onChange={(e) => setNewWorkflow({...newWorkflow, type: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  <option value="DEMAND_TO_PLAN">Demand to Plan</option>
                  <option value="PLAN_TO_PRODUCE">Plan to Produce</option>
                </select>
              </div>

              {newWorkflow.type === 'DEMAND_TO_PLAN' ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Product ID</label>
                  <input 
                    type="text" 
                    value={newWorkflow.productId}
                    onChange={(e) => setNewWorkflow({...newWorkflow, productId: e.target.value})}
                    placeholder="prod-widget-a"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                  />
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>Plan ID</label>
                  <input 
                    type="text" 
                    value={newWorkflow.planId}
                    onChange={(e) => setNewWorkflow({...newWorkflow, planId: e.target.value})}
                    placeholder="Enter Production Plan ID"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setShowTriggerModal(false)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleTrigger}
                  disabled={triggering}
                  style={{ 
                    padding: '0.5rem 1rem', 
                    borderRadius: '6px', 
                    background: '#667eea', 
                    color: 'white', 
                    border: 'none',
                    fontWeight: '600',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering ? 0.7 : 1
                  }}
                >
                  {triggering ? 'Triggering...' : 'Initialize'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
