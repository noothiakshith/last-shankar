interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

export default function KPICard({ title, value, subtitle, icon, trend, trendValue }: KPICardProps) {
  const trendColors = {
    up: '#48bb78',
    down: '#f56565',
    neutral: '#718096'
  };

  return (
    <div style={{
      background: 'white',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      border: '1px solid #e2e8f0'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '0.5rem', fontWeight: '500' }}>
            {title}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a202c', margin: 0 }}>
            {value}
          </p>
        </div>
        {icon && (
          <div style={{
            width: '48px',
            height: '48px',
            background: '#edf2f7',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem'
          }}>
            {icon}
          </div>
        )}
      </div>
      
      {(subtitle || trend) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {trend && trendValue && (
            <span style={{ 
              fontSize: '0.85rem', 
              color: trendColors[trend],
              fontWeight: '600'
            }}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: '0.85rem', color: '#718096' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
