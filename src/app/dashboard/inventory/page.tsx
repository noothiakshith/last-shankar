'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface Material {
  id: string;
  name: string;
  sku: string;
  onHand: number;
  safetyStock: number;
  reorderPoint: number;
  unit: string;
}

interface SafetyAlert {
  materialId: string;
  materialName: string;
  onHand: number;
  safetyStock: number;
  deficit: number;
}

export default function InventoryDashboard() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventoryData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadInventoryData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadInventoryData = async () => {
    try {
      // Fetch all materials
      const materialsRes = await fetch('/api/inventory/materials');
      if (materialsRes.ok) {
        const materialsData = await materialsRes.json();
        setMaterials(materialsData);
      }

      // Fetch safety stock alerts
      const alertsRes = await fetch('/api/inventory/alerts');
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        setAlerts(alertsData);
      }

      // Fetch stock ledger
      const ledgerRes = await fetch('/api/inventory/ledger');
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setLedger(ledgerData);
      }
    } catch (error) {
      console.error('Error loading inventory data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (material: Material) => {
    if (material.onHand < material.safetyStock) return 'Critical';
    if (material.onHand < material.reorderPoint) return 'Low';
    return 'Sufficient';
  };

  const getStatusColor = (status: string) => {
    if (status === 'Sufficient') return '#48bb78';
    if (status === 'Low') return '#ed8936';
    return '#f56565';
  };

  const lowStockCount = materials.filter(m => getStatus(m) === 'Low' || getStatus(m) === 'Critical').length;
  const criticalCount = materials.filter(m => getStatus(m) === 'Critical').length;

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Inventory Management Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Real-time warehouse monitoring and stock control
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard title="Total Materials" value={materials.length} icon="📦" subtitle="Tracked items" />
          <KPICard title="Low Stock Items" value={lowStockCount} icon="⚠️" subtitle="Below reorder point" />
          <KPICard title="Critical Alerts" value={criticalCount} icon="🚨" subtitle="Below safety stock" />
          <KPICard 
            title="Stock Health" 
            value={materials.length > 0 ? `${Math.round((materials.length - criticalCount) / materials.length * 100)}%` : '0%'} 
            icon="💚" 
          />
        </div>

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
              Raw Materials Inventory
            </h4>
            <button
              onClick={loadInventoryData}
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

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              Loading inventory data...
            </div>
          ) : materials.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              No materials found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Material</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>On Hand</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Safety Stock</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Reorder Point</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Unit</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((material) => {
                    const status = getStatus(material);
                    return (
                      <tr key={material.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{material.name}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>{material.onHand.toLocaleString()}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>{material.safetyStock.toLocaleString()}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>{material.reorderPoint.toLocaleString()}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', color: '#718096' }}>{material.unit}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            background: getStatusColor(status) + '20',
                            color: getStatusColor(status),
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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
              Safety Stock Alerts
            </h4>
            {alerts.length === 0 ? (
              <div style={{ padding: '1rem', background: '#c6f6d5', borderRadius: '6px', borderLeft: '4px solid #48bb78' }}>
                <p style={{ fontWeight: '600', color: '#22543d', marginBottom: '0.5rem' }}>All Clear</p>
                <p style={{ fontSize: '0.9rem', color: '#22543d' }}>All materials above safety stock levels</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {alerts.map((alert) => (
                  <div key={alert.materialId} style={{ padding: '1rem', background: '#fed7d7', borderRadius: '6px', borderLeft: '4px solid #f56565' }}>
                    <p style={{ fontWeight: '600', color: '#c53030', marginBottom: '0.5rem' }}>
                      {alert.materialName}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#742a2a' }}>
                      On Hand: {alert.onHand} | Safety Stock: {alert.safetyStock} | Deficit: {alert.deficit}
                    </p>
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
              Inventory Summary
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Total Materials Tracked
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                  {materials.length}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Materials Below Reorder Point
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#ed8936' }}>
                  {lowStockCount}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.25rem' }}>
                  Critical (Below Safety Stock)
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#f56565' }}>
                  {criticalCount}
                </div>
              </div>
              <div style={{ padding: '1rem', background: '#c6f6d5', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.85rem', color: '#22543d', marginBottom: '0.25rem' }}>
                  Sufficient Stock
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: '#22543d' }}>
                  {materials.length - lowStockCount}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
          marginTop: '2rem'
        }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Stock Ledger (Movement History)
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Time</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Material</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Delta</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Reason</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}>No movements recorded</td>
                  </tr>
                ) : (
                  ledger.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>{new Date(entry.occurredAt).toLocaleString()}</td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{entry.material.name}</td>
                      <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: entry.delta > 0 ? '#48bb78' : '#f56565' }}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem' }}>{entry.reason}</td>
                      <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#718096' }}>{entry.reference || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
