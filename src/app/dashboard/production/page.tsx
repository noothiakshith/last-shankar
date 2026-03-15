'use client';

import DashboardLayout from '@/components/DashboardLayout';
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

export default function ProductionDashboard() {
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProductionData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadProductionData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPlan) {
      loadReadiness(selectedPlan.id);
    }
  }, [selectedPlan]);

  const loadProductionData = async () => {
    try {
      const response = await fetch('/api/production/plan');
      if (response.ok) {
        const data = await response.json();
        setPlans(data);
        if (data.length > 0 && !selectedPlan) {
          setSelectedPlan(data[0]);
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

  const activePlans = plans.filter(p => p.status !== 'COMPLETED');
  const totalRequiredQty = selectedPlan?.orders.reduce((sum, o) => sum + o.requiredQty, 0) || 0;
  const shortageCount = readiness?.materials.filter(m => m.shortage > 0).length || 0;

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Production Planning Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Material requirements planning and production readiness
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard title="Active Plans" value={activePlans.length} icon="📋" subtitle="In progress" />
          <KPICard 
            title="Production Ready" 
            value={readiness?.isReady ? "Yes" : "No"} 
            icon={readiness?.isReady ? "✅" : "⚠️"} 
            subtitle={readiness ? (readiness.isReady ? "All materials available" : `${shortageCount} shortages`) : "Select a plan"}
          />
          <KPICard title="Forecast Target" value={totalRequiredQty.toLocaleString()} icon="🎯" subtitle="Units planned" />
          <KPICard title="Total Plans" value={plans.length} icon="📊" subtitle="All time" />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            Loading production plans...
          </div>
        ) : plans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#718096' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No production plans found</p>
            <p style={{ fontSize: '0.9rem' }}>Create a forecast and run MRP to generate production plans</p>
          </div>
        ) : (
          <>
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
                  Production Plans
                </h4>
                <button
                  onClick={loadProductionData}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Refresh
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    style={{
                      padding: '1rem',
                      background: selectedPlan?.id === plan.id ? '#edf2f7' : '#f7fafc',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: selectedPlan?.id === plan.id ? '2px solid #667eea' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>{plan.id.substring(0, 8)}</span>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: plan.status === 'COMPLETED' ? '#c6f6d5' : '#fef5e7',
                        color: plan.status === 'COMPLETED' ? '#22543d' : '#d97706',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {plan.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                      Orders: {plan.orders.length} | Created: {new Date(plan.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedPlan && readiness && (
              <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0',
                marginBottom: '2rem'
              }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                  Material Requirements (MRP) - Plan {selectedPlan.id.substring(0, 8)}
                </h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Material</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Required</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Available</th>
                        <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Shortage</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readiness.materials.map((item) => (
                        <tr key={item.materialId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '1rem', fontWeight: '500' }}>{item.materialName}</td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>{item.required.toLocaleString()} {item.unit}</td>
                          <td style={{ padding: '1rem', textAlign: 'right' }}>{item.available.toLocaleString()} {item.unit}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', color: item.shortage > 0 ? '#f56565' : '#718096' }}>
                            {item.shortage > 0 ? item.shortage.toLocaleString() : '-'}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: item.shortage > 0 ? '#fed7d7' : '#c6f6d5',
                              color: item.shortage > 0 ? '#c53030' : '#22543d',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              fontWeight: '600'
                            }}>
                              {item.shortage > 0 ? 'Shortage' : 'Sufficient'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                border: '1px solid #e2e8f0'
              }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Production Orders
                </h4>
                {selectedPlan ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedPlan.orders.map((order) => (
                      <div key={order.id} style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          Product: {order.productId}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                          Quantity: {order.requiredQty} | Status: {order.status}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
                    Select a plan to view orders
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
                  Production Status
                </h4>
                {readiness ? (
                  <>
                    {readiness.isReady ? (
                      <div style={{ padding: '1rem', background: '#c6f6d5', borderRadius: '6px', borderLeft: '4px solid #48bb78', marginBottom: '1rem' }}>
                        <p style={{ fontWeight: '600', color: '#22543d', marginBottom: '0.5rem' }}>Ready to Produce</p>
                        <p style={{ fontSize: '0.9rem', color: '#22543d' }}>All materials available for production</p>
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', background: '#fed7d7', borderRadius: '6px', borderLeft: '4px solid #f56565', marginBottom: '1rem' }}>
                        <p style={{ fontWeight: '600', color: '#c53030', marginBottom: '0.5rem' }}>Production Blocked</p>
                        <p style={{ fontSize: '0.9rem', color: '#742a2a' }}>
                          {shortageCount} material shortage{shortageCount !== 1 ? 's' : ''} detected
                        </p>
                      </div>
                    )}
                    {!readiness.isReady && (
                      <div style={{ padding: '1rem', background: '#fef5e7', borderRadius: '6px', borderLeft: '4px solid #f59e0b' }}>
                        <p style={{ fontWeight: '600', color: '#d97706', marginBottom: '0.5rem' }}>Action Required</p>
                        <p style={{ fontSize: '0.9rem', color: '#92400e' }}>
                          Procurement needed for missing materials
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>
                    Select a plan to view status
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
