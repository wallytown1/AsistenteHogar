import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/admin/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1>Usuarios</h1>
        <p className="text-muted">Directorio global de cuentas registradas</p>
      </div>

      <div className="glass-panel table-container">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Cargando usuarios...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Hogar Asignado</th>
                <th>Creado en</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.nombre}</td>
                  <td className="text-muted">{u.email}</td>
                  <td>
                    {u.is_active ?
                      <span className="badge success">Activo</span> :
                      <span className="badge">Inactivo</span>
                    }
                  </td>
                  <td>{u.hogar_nombre || <span className="text-muted">Huérfano</span>}</td>
                  <td className="text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 32 }}>No hay usuarios</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
