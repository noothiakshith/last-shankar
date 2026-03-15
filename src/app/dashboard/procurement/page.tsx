'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState, useEffect } from 'react';

interface PurchaseOrder {
  id: string;
  supplierId: string;
  materialId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  status: string;
  createdAt: string;
  supplier?: { name: string };
}

export default function ProcurementDashboard() {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPurchaseOrders();
  }, []);

  const loadPurchaseOrders = async () => {
    try {
      const response = await fetch('/api/procurement/po');
      if (response.ok) {
        const data = await response.json();
        setPurchaseOrders(data);
      }
    } catch (error) {
      console.error('Error loading purchase orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'DELIVERED') return '#48bb78';
    if (status === 'APPROVED') return '#4299e1';
    if (status === 'PENDING_APPROVAL') return '#ed8936';
    return '#718096';
  };

  const pendingCount = purchaseOrders.filter(po => po.status === 'PENDING_APPROVAL').length;
  const totalSpend = purchaseOrders.reduce((sum, po) => sum + po.totalCost, 0);

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            Procurement Dashboard
          </h3>
          <p style={{ color: '#718096' }}>
            Supplier management and purchase order tracking
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard title="Active Suppliers" value="4" icon="🏢" subtitle="Qualified vendors" />
          <KPICard title="Pending POs" value={pendingCount} icon="⏳" subtitle="Awaiting approval" />
          <KPICard title="Total Spend" value={`$${(totalSpend / 1000).toFixed(1)}K`} icon="💵" />
          <KPICard title="Total POs" value={purchaseOrders.length} icon="📋" subtitle="All orders" />
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
              Purchase Orders
            </h4>
            <button
              onClick={loadPurchaseOrders}
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
              Loading purchase orders...
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
              No purchase orders found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>PO ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Material</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Quantity</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Cost</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center', color: '#718096', fontWeight: '600', fontSize: '0.85rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseOrders.map((po) => (
                    <tr key={po.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', fontWeight: '600', color: '#667eea' }}>{po.id.substring(0, 8)}</td>
                      <td style={{ padding: '1rem' }}>{po.materialId}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>{po.quantity}</td>
                      <td style={{ padding: '1rem', textAlign: 'right' }}>${po.totalCost.toLocaleString()}</td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: getStatusColor(po.status) + '20',
                          color: getStatusColor(po.status),
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          {po.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
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
              Supplier Directory
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { name: 'Acme Metals', leadTime: '7 days', materials: 2 },
                { name: 'PolyPlastics', leadTime: '5 days', materials: 2 },
                { name: 'TechParts', leadTime: '10 days', materials: 1 },
                { name: 'Alloy Works', leadTime: '6 days', materials: 2 }
              ].map((supplier, idx) => (
                <div key={idx} style={{ padding: '1rem', background: '#f7fafc', borderRadius: '6px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>{supplier.name}</div>
                  <div style={{ fontSize: '0.85rem', color: '#718096' }}>
                    Lead Time: {supplier.leadTime} • Materials: {supplier.materials}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Recent Activity
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {purchaseOrders.slice(0, 3).map((po, idx) => (
                <div key={idx} style={{ padding: '0.75rem', background: '#f7fafc', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.9rem' }}>{po.id.substring(0, 8)} - {po.status}</span>
                    <span style={{ fontSize: '0.85rem', color: '#718096' }}>
                      {new Date(po.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
