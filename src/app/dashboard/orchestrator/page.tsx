'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';

// Types
interface WorkflowEvent {
  id: string;
  eventType: string;
  fromState: string;
  toState: string;
  metadata: any;
  occurredAt: string;
}

interface WorkflowApproval {
  id: string;
  gateType: string;
  requiredRole: string;
  status: string;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

interface AllocatedEmployee {
  id: string;
  name: string;
  department: string;
  email: string;
}

interface Workflow {
  id: string;
  type: string;
  state: string;
  payload: any;
  triggeredBy: string;
  createdAt: string;
  updatedAt?: string;
  allocatedEmployee?: AllocatedEmployee;
  events?: WorkflowEvent[];
  approvals?: WorkflowApproval[];
}

// State colors and icons
const STATE_CONFIG: Record<string, { color: string; hex: string; icon: string }> = {
  INITIATED: { color: 'Blue', hex: '#667eea', icon: '⚡' },
  FORECASTING: { color: 'Purple', hex: '#9f7aea', icon: '📊' },
  PLANNING: { color: 'Indigo', hex: '#667eea', icon: '📋' },
  PROCUREMENT: { color: 'Orange', hex: '#ed8936', icon: '🛒' },
  PENDING_PO_APPROVAL: { color: 'Yellow', hex: '#ecc94b', icon: '⏳' },
  FINANCE_REVIEW: { color: 'Teal', hex: '#38b2ac', icon: '💰' },
  PENDING_PRODUCTION_AUTH: { color: 'Yellow', hex: '#ecc94b', icon: '⏳' },
  PENDING_FORECAST_APPROVAL: { color: 'Yellow', hex: '#ecc94b', icon: '⏳' },
  EXECUTING: { color: 'Green', hex: '#48bb78', icon: '🔧' },
  COMPLETED: { color: 'Dark Green', hex: '#276749', icon: '✅' },
  FAILED: { color: 'Red', hex: '#f56565', icon: '❌' },
  REJECTED: { color: 'Gray', hex: '#718096', icon: '🚫' }
};

const WORKFLOW_TYPE_BADGES: Record<string, string> = {
  DEMAND_TO_PLAN: 'D2P',
  PLAN_TO_PRODUCE: 'P2P',
  PROCURE_TO_PAY: 'PTP'
};

export default function OrchestratorDashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadWorkflows();
    const interval = setInterval(loadWorkflows, 10000); // Auto-refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedWorkflow) {
      loadWorkflowDetail(selectedWorkflow.id);
      const interval = setInterval(() => loadWorkflowDetail(selectedWorkflow.id), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedWorkflow?.id]);

  const loadWorkflows = async () => {
    try {
      const response = await fetch('/api/orchestrator/workflows?limit=50');
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

  const loadWorkflowDetail = async (workflowId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/orchestrator/workflow/${workflowId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedWorkflow(data);
      }
    } catch (err) {
      console.error('Error loading workflow detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getTimeDelta = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    
    if (seconds < 60) return `< 1 min`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  // Group workflows by state
  const workflowsByState: Record<string, Workflow[]> = {};
  workflows.forEach(w => {
    if (!workflowsByState[w.state]) {
      workflowsByState[w.state] = [];
    }
    workflowsByState[w.state].push(w);
  });

  // Calculate summary stats
  const activeWorkflows = workflows.filter(w => !['COMPLETED', 'FAILED', 'REJECTED'].includes(w.state));
  const completedWorkflows = workflows.filter(w => w.state === 'COMPLETED');
  const failedWorkflows = workflows.filter(w => ['FAILED', 'REJECTED'].includes(w.state));
  const pendingApprovals = workflows.filter(w => 
    w.state.includes('PENDING') || (w.approvals && w.approvals.some(a => a.status === 'PENDING'))
  ).length;

  // States to show in board (in order)
  const boardStates = [
    'INITIATED',
    'FORECASTING',
    'PENDING_FORECAST_APPROVAL',
    'PLANNING',
    'PROCUREMENT',
    'PENDING_PO_APPROVAL',
    'FINANCE_REVIEW',
    'PENDING_PRODUCTION_AUTH',
    'EXECUTING',
    'COMPLETED',
    'FAILED',
    'REJECTED'
  ].filter(state => workflowsByState[state]?.length > 0 || ['COMPLETED', 'FAILED'].includes(state));

  return (
    <DashboardLayout>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
              🎯 Orchestrator Dashboard
            </h3>
            <p style={{ color: '#718096' }}>
              Workflow management and monitoring
            </p>
          </div>
          <a
            href="/dashboard/sales"
            style={{
              padding: '0.5rem 1rem',
              background: '#667eea',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#5568d3'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#667eea'}
          >
            ← Back to Sales
          </a>
        </div>

        {/* Summary Stats */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Active</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#667eea' }}>{activeWorkflows.length}</div>
          </div>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Completed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#276749' }}>{completedWorkflows.length}</div>
          </div>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Failed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f56565' }}>{failedWorkflows.length}</div>
          </div>
          <div style={{ 
            background: 'white', 
            padding: '1rem', 
            borderRadius: '8px', 
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.25rem' }}>Pending Approval</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ecc94b' }}>{pendingApprovals}</div>
          </div>
        </div>

        {/* Pipeline Board */}
        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginBottom: '2rem'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Pipeline Board
          </h4>
          
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            overflowX: 'auto',
            paddingBottom: '1rem'
          }}>
            {boardStates.map(state => {
              const stateWorkflows = workflowsByState[state] || [];
              const config = STATE_CONFIG[state] || { hex: '#718096', icon: '●' };
              
              return (
                <div key={state} style={{ 
                  minWidth: '280px',
                  background: '#f7fafc',
                  borderRadius: '8px',
                  padding: '1rem'
                }}>
                  {/* Column Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                    paddingBottom: '0.75rem',
                    borderBottom: `2px solid ${config.hex}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.25rem' }}>{config.icon}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1a202c' }}>
                        {state.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold',
                      background: config.hex,
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '12px'
                    }}>
                      {stateWorkflows.length}
                    </span>
                  </div>

                  {/* Workflow Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {stateWorkflows.map(workflow => {
                      const hasPendingApproval = workflow.state.includes('PENDING');
                      const productId = workflow.payload?.productId || workflow.type;
                      
                      return (
                        <div
                          key={workflow.id}
                          onClick={() => setSelectedWorkflow(workflow)}
                          style={{
                            background: 'white',
                            padding: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            boxShadow: selectedWorkflow?.id === workflow.id 
                              ? `0 0 0 2px ${config.hex}` 
                              : '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = `0 0 0 2px ${config.hex}`;
                          }}
                          onMouseLeave={(e) => {
                            if (selectedWorkflow?.id !== workflow.id) {
                              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                            }
                          }}
                        >
                          {/* Product/Type */}
                          <div style={{ 
                            fontSize: '0.9rem', 
                            fontWeight: '600', 
                            color: '#1a202c',
                            marginBottom: '0.5rem'
                          }}>
                            {productId}
                          </div>

                          {/* Workflow Type Badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              background: '#667eea',
                              color: 'white',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px'
                            }}>
                              {WORKFLOW_TYPE_BADGES[workflow.type] || workflow.type}
                            </span>
                            {hasPendingApproval && (
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                background: '#ecc94b',
                                color: '#744210',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px'
                              }}>
                                Awaiting Approval
                              </span>
                            )}
                          </div>

                          {/* Time */}
                          <div style={{ fontSize: '0.75rem', color: '#718096', marginBottom: '0.5rem' }}>
                            {getTimeAgo(workflow.createdAt)}
                          </div>

                          {/* Assigned Employee */}
                          {workflow.allocatedEmployee && (
                            <div style={{ 
                              fontSize: '0.75rem', 
                              color: '#4a5568',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              <span>👤</span>
                              <span>{workflow.allocatedEmployee.name}</span>
                            </div>
                          )}

                          {/* Status Dot */}
                          <div style={{ 
                            position: 'absolute',
                            top: '0.5rem',
                            right: '0.5rem',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: config.hex
                          }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Workflow Detail View */}
        {selectedWorkflow && (
          <WorkflowDetailView 
            workflow={selectedWorkflow}
            onClose={() => setSelectedWorkflow(null)}
            loading={detailLoading}
            getTimeAgo={getTimeAgo}
            getTimeDelta={getTimeDelta}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// Workflow Detail Component
function WorkflowDetailView({ 
  workflow, 
  onClose, 
  loading,
  getTimeAgo,
  getTimeDelta
}: { 
  workflow: Workflow; 
  onClose: () => void;
  loading: boolean;
  getTimeAgo: (date: string) => string;
  getTimeDelta: (start: string, end: string) => string;
}) {
  const config = STATE_CONFIG[workflow.state] || { hex: '#718096', icon: '●' };
  const isFailed = workflow.state === 'FAILED';

  return (
    <div style={{
      background: 'white',
      padding: '2rem',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0',
      position: 'relative'
    }}>
      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'none',
          border: 'none',
          fontSize: '1.5rem',
          cursor: 'pointer',
          color: '#718096'
        }}
      >
        ×
      </button>

      {/* Header Card */}
      <div style={{
        background: '#f7fafc',
        padding: '1.5rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: `2px solid ${config.hex}`
      }}>
        <h4 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1a202c' }}>
          {workflow.type.replace(/_/g, ' ')} Workflow
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div><strong>ID:</strong> {workflow.id}</div>
          <div><strong>State:</strong> <span style={{ color: config.hex, fontWeight: '600' }}>{workflow.state}</span></div>
          <div><strong>Product:</strong> {workflow.payload?.productId || 'N/A'}</div>
          <div><strong>Triggered:</strong> {getTimeAgo(workflow.createdAt)} by {workflow.triggeredBy}</div>
          {workflow.allocatedEmployee && (
            <div><strong>Assigned:</strong> {workflow.allocatedEmployee.name} ({workflow.allocatedEmployee.department})</div>
          )}
          {workflow.updatedAt && (
            <div><strong>Last Updated:</strong> {new Date(workflow.updatedAt).toLocaleTimeString()}</div>
          )}
        </div>
        {workflow.payload?.sessionId && (
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#718096' }}>
            <strong>Source:</strong> CSV Upload Session ({workflow.payload.sessionId})
          </div>
        )}
      </div>

      {/* Error Banner */}
      {isFailed && (
        <div style={{
          background: '#fed7d7',
          border: '2px solid #f56565',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#c53030', marginBottom: '0.5rem' }}>
            ❌ WORKFLOW FAILED
          </div>
          <div style={{ fontSize: '0.85rem', color: '#742a2a' }}>
            Failed at: {workflow.state} state
          </div>
        </div>
      )}

      {/* Workflow Timeline */}
      <div style={{ marginBottom: '2rem' }}>
        <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📍 Workflow Timeline
        </h5>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>Loading timeline...</div>
        ) : workflow.events && workflow.events.length > 0 ? (
          <div style={{ position: 'relative', paddingLeft: '2rem' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '0.5rem',
              top: '0',
              bottom: '0',
              width: '2px',
              background: '#e2e8f0'
            }} />

            {workflow.events.slice().reverse().map((event, idx) => {
              const eventConfig = STATE_CONFIG[event.toState] || { hex: '#718096', icon: '●' };
              const nextEvent = workflow.events![workflow.events!.length - idx - 2];
              const timeDelta = nextEvent ? getTimeDelta(event.occurredAt, nextEvent.occurredAt) : 'current';
              const isCurrent = idx === 0;

              return (
                <div key={event.id} style={{ marginBottom: '1.5rem', position: 'relative' }}>
                  {/* Dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-1.65rem',
                    top: '0.25rem',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: eventConfig.hex,
                    border: '2px solid white',
                    boxShadow: '0 0 0 2px #e2e8f0'
                  }} />

                  {/* Content */}
                  <div style={{
                    background: isCurrent ? '#f7fafc' : 'white',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: `1px solid ${isCurrent ? eventConfig.hex : '#e2e8f0'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: '600', color: '#1a202c', fontSize: '0.9rem' }}>
                        {event.toState.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {getTimeAgo(event.occurredAt)} ({timeDelta} in this state)
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                      Event: {event.eventType}
                    </div>
                    {event.metadata && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#4a5568',
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: '#edf2f7',
                        borderRadius: '4px'
                      }}>
                        {JSON.stringify(event.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>No events recorded</div>
        )}
      </div>

      {/* Payload / Context Data */}
      <div style={{ marginBottom: '2rem' }}>
        <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 Workflow Context
        </h5>
        <div style={{
          background: '#f7fafc',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
            {Object.entries(workflow.payload || {}).map(([key, value]) => (
              <div key={key} style={{ display: 'contents' }}>
                <div style={{ fontWeight: '600', color: '#4a5568' }}>{key}:</div>
                <div style={{ color: '#1a202c' }}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval Gates */}
      {workflow.approvals && workflow.approvals.length > 0 && (
        <div>
          <h5 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔐 Approval Gates
          </h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {workflow.approvals.map(approval => (
              <div
                key={approval.id}
                style={{
                  background: approval.status === 'APPROVED' ? '#c6f6d5' : approval.status === 'PENDING' ? '#fef5e7' : '#f7fafc',
                  padding: '1rem',
                  borderRadius: '8px',
                  border: `1px solid ${approval.status === 'APPROVED' ? '#48bb78' : approval.status === 'PENDING' ? '#ecc94b' : '#e2e8f0'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    {approval.status === 'APPROVED' ? '✅' : approval.status === 'PENDING' ? '⏳' : '⬜'} {approval.gateType.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                    {approval.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#718096' }}>
                  Required Role: {approval.requiredRole}
                </div>
                {approval.resolvedBy && (
                  <div style={{ fontSize: '0.8rem', color: '#4a5568', marginTop: '0.25rem' }}>
                    Resolved by: {approval.resolvedBy} at {approval.resolvedAt ? new Date(approval.resolvedAt).toLocaleString() : 'N/A'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
