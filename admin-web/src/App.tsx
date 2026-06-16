import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Activity, Users, Home, Settings, LogOut, KeyRound } from 'lucide-react';
import { apiClient } from './api/client';
import './styles/index.css';

import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import HogaresPage from './pages/HogaresPage';

function Login() {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('admin_master_key', key);
    // Verificación rápida haciendo un ping al /admin/users
    try {
      await apiClient.get('/admin/users');
      navigate('/');
    } catch (err) {
      localStorage.removeItem('admin_master_key');
      setError('Clave maestra incorrecta o rechazada.');
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="glass-card" style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ background: 'var(--accent)', padding: 12, borderRadius: '50%' }}>
            <KeyRound color="white" size={32} />
          </div>
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Admin God Mode</h2>
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: 24, fontSize: '0.9rem' }}>
          Introduce la clave maestra del servidor.
        </p>
        {error && <div style={{ color: 'var(--danger)', marginBottom: 16, fontSize: '0.85rem', textAlign: 'center' }}>{error}</div>}
        <form onSubmit={handleLogin}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Master API Key..."
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 8,
              background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)',
              color: 'white', marginBottom: 16, outline: 'none'
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Acceder al Panel</button>
        </form>
      </div>
    </div>
  );
}

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('admin_master_key');
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Activity color="var(--accent)" size={28} />
        <h3>Asistente Admin</h3>
      </div>
      <nav style={{ flex: 1 }}>
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <Home size={20} /> Dashboard
        </a>
        <a href="/hogares" onClick={(e) => { e.preventDefault(); navigate('/hogares'); }} className={`nav-item ${location.pathname === '/hogares' ? 'active' : ''}`}>
          <Home size={20} /> Hogares
        </a>
        <a href="/users" onClick={(e) => { e.preventDefault(); navigate('/users'); }} className={`nav-item ${location.pathname === '/users' ? 'active' : ''}`}>
          <Users size={20} /> Usuarios
        </a>
      </nav>
      <div>
        <button onClick={handleLogout} className="btn" style={{ width: '100%', color: 'var(--text-secondary)' }}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_master_key');
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  useEffect(() => {
    const handleAuthError = () => {
      window.location.href = '/login';
    };
    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
        <Route path="/hogares" element={<ProtectedRoute><HogaresPage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
