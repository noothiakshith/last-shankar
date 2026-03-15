'use client';

import DashboardLayout from '@/components/DashboardLayout';
import KPICard from '@/components/KPICard';
import { useState } from 'react';

export default function DashboardPage() {
  const [stats] = useState({
    activeWorkflows: 0,
    pendingApprovals: 0,
    forecastAccuracy: 0,
    inventoryAlerts: 0
  });

  return (
    <DashboardLayout>
      <div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1a202c', marginBottom: '0.5rem' }}>
            System Overview
          </h3>
          <p style={{ color: '#718096' }}>
            Welcome to NexisERP - Your AI-driven enterprise planning platform
          </p>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          <KPICard
            title="Active Workflows"
            value={stats.activeWorkflows}
            icon="🎯"
            subtitle="Currently running"
          />
          <KPICard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon="⏳"
            subtitle="Awaiting action"
          />
          <KPICard
            title="Forecast Accuracy"
            value={`${stats.forecastAccuracy}%`}
            icon="📈"
            trend="up"
            trendValue="+5%"
          />
          <KPICard
            title="Inventory Alerts"
            value={stats.inventoryAlerts}
            icon="⚠️"
            subtitle="Low stock items"
          />
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1.5rem'
        }}>
          <div style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '1rem' }}>
              Quick Actions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a href="/dashboard/sales" style={{
                padding: '0.75rem',
                background: '#f7fafc',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#1a202c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span>📈</span>
                <span>Generate Sales Forecast</span>
              </a>
              <a href="/dashboard/orchestrator" style={{
                padding: '0.75rem',
                background: '#f7fafc',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#1a202c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span>🎯</span>
                <span>View Workflow Status</span>
              </a>
              <a href="/dashboard/inventory" style={{
                padding: '0.75rem',
                background: '#f7fafc',
                borderRadius: '6px',
                textDecoration: 'none',
                color: '#1a202c',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <span>📦</span>
                <span>Check Inventory Levels</span>
              </a>
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
              System Status
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#718096' }}>ML Service</span>
                <span style={{ 
                  padding: '0.25rem 0.75rem', 
                  background: '#c6f6d5', 
                  color: '#22543d',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}>
                  Online
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#718096' }}>Database</span>
                <span style={{ 
                  padding: '0.25rem 0.75rem', 
                  background: '#c6f6d5', 
                  color: '#22543d',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}>
                  Connected
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#718096' }}>Orchestrator</span>
                <span style={{ 
                  padding: '0.25rem 0.75rem', 
                  background: '#c6f6d5', 
                  color: '#22543d',
                  borderRadius: '12px',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}>
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
