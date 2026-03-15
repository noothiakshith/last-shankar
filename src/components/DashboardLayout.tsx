'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const menuItems = [
    { path: '/dashboard', label: 'Overview', icon: '📊' },
    { path: '/dashboard/orchestrator', label: 'Orchestrator', icon: '🎯' },
    { path: '/dashboard/sales', label: 'Sales Intelligence', icon: '📈' },
    { path: '/dashboard/production', label: 'Production', icon: '🏭' },
    { path: '/dashboard/inventory', label: 'Inventory', icon: '📦' },
    { path: '/dashboard/procurement', label: 'Procurement', icon: '🛒' },
    { path: '/dashboard/finance', label: 'Finance', icon: '💰' },
    { path: '/dashboard/hr', label: 'Human Resources', icon: '👥' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f7fafc' }}>
      {/* Sidebar */}
      <div style={{
        width: '260px',
        background: '#1a202c',
        color: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #2d3748' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>NexisERP</h1>
          <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
            AI-Driven ERP
          </p>
        </div>

        <nav style={{ flex: 1, padding: '1rem' }}>
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                marginBottom: '0.5rem',
                background: pathname === item.path ? '#4a5568' : 'transparent',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                fontSize: '0.95rem',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                if (pathname !== item.path) {
                  e.currentTarget.style.background = '#2d3748';
                }
              }}
              onMouseLeave={(e) => {
                if (pathname !== item.path) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #2d3748' }}>
          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#2d3748', borderRadius: '6px' }}>
            <p style={{ fontSize: '0.85rem', color: '#a0aec0', marginBottom: '0.25rem' }}>Logged in as</p>
            <p style={{ fontSize: '0.9rem', fontWeight: '600' }}>{session.user?.email}</p>
            <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: '0.25rem' }}>
              Role: {session.user?.role || 'User'}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#e53e3e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Top Bar */}
        <div style={{
          background: 'white',
          padding: '1rem 2rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1a202c', margin: 0 }}>
            {menuItems.find(item => item.path === pathname)?.label || 'Dashboard'}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: '#718096' }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
