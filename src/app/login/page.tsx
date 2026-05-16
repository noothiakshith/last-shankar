'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        width: '100%',
        maxWidth: '420px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c', marginBottom: '0.5rem' }}>
            NexisERP
          </h1>
          <p style={{ color: '#718096', fontSize: '0.95rem' }}>
            AI-Driven Enterprise Planning Platform
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="user@nexiserp.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#4a5568', fontWeight: '500' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '1rem'
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.75rem',
              background: '#fed7d7',
              color: '#c53030',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#a0aec0' : '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f7fafc', borderRadius: '8px', maxHeight: '320px', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.9rem', color: '#2d3748', marginBottom: '1rem', fontWeight: '600', textAlign: 'center' }}>
            🔐 Demo Accounts by Role
          </p>
          
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #667eea' }}>
              <div style={{ fontSize: '0.75rem', color: '#667eea', fontWeight: '600', marginBottom: '0.25rem' }}>
                👑 ADMIN
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                admin@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #48bb78' }}>
              <div style={{ fontSize: '0.75rem', color: '#48bb78', fontWeight: '600', marginBottom: '0.25rem' }}>
                📊 SALES ANALYST
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                sales@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #ed8936' }}>
              <div style={{ fontSize: '0.75rem', color: '#ed8936', fontWeight: '600', marginBottom: '0.25rem' }}>
                🏭 PRODUCTION PLANNER
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                paula@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #9f7aea' }}>
              <div style={{ fontSize: '0.75rem', color: '#9f7aea', fontWeight: '600', marginBottom: '0.25rem' }}>
                📦 INVENTORY MANAGER
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                ivan@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #38b2ac' }}>
              <div style={{ fontSize: '0.75rem', color: '#38b2ac', fontWeight: '600', marginBottom: '0.25rem' }}>
                🛒 PROCUREMENT OFFICER
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                oscar@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #f56565' }}>
              <div style={{ fontSize: '0.75rem', color: '#f56565', fontWeight: '600', marginBottom: '0.25rem' }}>
                💰 FINANCE MANAGER
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                fiona@nexiserp.com / password
              </div>
            </div>

            <div style={{ padding: '0.75rem', background: 'white', borderRadius: '6px', borderLeft: '3px solid #805ad5' }}>
              <div style={{ fontSize: '0.75rem', color: '#805ad5', fontWeight: '600', marginBottom: '0.25rem' }}>
                👔 EXECUTIVE
              </div>
              <div style={{ fontSize: '0.8rem', color: '#4a5568', fontFamily: 'monospace' }}>
                eve@nexiserp.com / password
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
            All passwords are "password" for demo purposes
          </p>
        </div>
      </div>
    </div>
  );
}
