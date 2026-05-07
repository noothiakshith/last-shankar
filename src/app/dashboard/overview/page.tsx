'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { SalesDashboardContent } from '@/components/dashboards/SalesDashboardContent';
import { InventoryDashboardContent } from '@/components/dashboards/InventoryDashboardContent';
import { OrchestratorDashboardContent } from '@/components/dashboards/OrchestratorDashboardContent';
import { ProductionDashboardContent } from '@/components/dashboards/ProductionDashboardContent';
import { ProcurementDashboardContent } from '@/components/dashboards/ProcurementDashboardContent';
import { FinanceDashboardContent } from '@/components/dashboards/FinanceDashboardContent';
import { HRDashboardContent } from '@/components/dashboards/HRDashboardContent';

export default function OverviewDashboard() {
  return (
    <DashboardLayout>
      <div style={{ marginBottom: '1rem', padding: '1rem', background: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Enterprise Overview (Side-by-Side)</h2>
        <p style={{ color: '#4a5568' }}>Monitor and trace activities across all modules in real-time.</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(800px, 1fr))',
        gap: '2rem',
        paddingBottom: '2rem'
      }}>
        {/* Wrap each dashboard component in a scaled container so it fits nicer, or just a bounded div with overflow */}
        {[
          { title: 'Orchestrator (Workflows)', component: <OrchestratorDashboardContent /> },
          { title: 'Sales (Demand & AI)', component: <SalesDashboardContent /> },
          { title: 'Inventory', component: <InventoryDashboardContent /> },
          { title: 'Production', component: <ProductionDashboardContent /> },
          { title: 'Procurement', component: <ProcurementDashboardContent /> },
          { title: 'Finance', component: <FinanceDashboardContent /> },
          { title: 'HR', component: <HRDashboardContent /> },
        ].map((mod, idx) => (
          <div key={idx} style={{
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            background: '#f8fafc',
            overflow: 'hidden',
            boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              background: '#2d3748',
              color: 'white',
              padding: '0.75rem 1.5rem',
              fontWeight: '600',
              fontSize: '1.1rem'
            }}>
              {mod.title}
            </div>
            {/* By setting max height and overflow, we allow independent scrolling of each module. We also scale down slightly to see more context. */}
            <div style={{
              height: '600px',
              overflowY: 'auto',
              padding: '1.5rem',
              position: 'relative'
            }}>
              {/* To make the contents fit better side by side, we apply a CSS transform. */}
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.6%' }}>
                {mod.component}
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
