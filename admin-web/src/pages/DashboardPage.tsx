import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Users, Home, Activity } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({ users: 0, hogares: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [uRes, hRes] = await Promise.all([
          apiClient.get('/admin/users'),
          apiClient.get('/admin/hogares')
        ]);
        setStats({ users: uRes.data.length, hogares: hRes.data.length });
      } catch (err) {
        console.error("Error fetching stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h1>Panel de Control</h1>
        <p className="text-muted">Resumen global de la plataforma</p>
      </div>

      <div className="grid-cards">
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: 10, borderRadius: 8 }}>
              <Users color="var(--accent)" size={24} />
            </div>
            <h3 className="text-muted">Usuarios Registrados</h3>
          </div>
          <div className="stat-value">{loading ? '...' : stats.users}</div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(34, 197, 94, 0.2)', padding: 10, borderRadius: 8 }}>
              <Home color="#4ade80" size={24} />
            </div>
            <h3 className="text-muted">Hogares Creados</h3>
          </div>
          <div className="stat-value">{loading ? '...' : stats.hogares}</div>
        </div>

        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: 10, borderRadius: 8 }}>
              <Activity color="#f87171" size={24} />
            </div>
            <h3 className="text-muted">Estado de la API</h3>
          </div>
          <div className="stat-value" style={{ fontSize: '1.8rem', marginTop: 22, color: '#4ade80' }}>
            Operativo
          </div>
        </div>
      </div>
    </div>
  );
}
