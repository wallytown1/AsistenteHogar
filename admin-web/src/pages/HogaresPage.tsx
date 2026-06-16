import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { Trash2 } from 'lucide-react';

export default function HogaresPage() {
  const [hogares, setHogares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHogares();
  }, []);

  const fetchHogares = async () => {
    try {
      const res = await apiClient.get('/admin/hogares');
      setHogares(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!window.confirm(`⚠️ ADVERTENCIA CRÍTICA ⚠️\n\n¿Estás absolutamente seguro de que deseas destruir el hogar "${nombre}" y TODOS SUS DATOS (usuarios, tareas, eventos)?\n\nEsta acción es IRREVERSIBLE.`)) return;

    try {
      await apiClient.delete(`/admin/hogar/${id}`);
      alert('Hogar destruido exitosamente.');
      fetchHogares();
    } catch (err: any) {
      alert('Error al destruir el hogar: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1>Hogares</h1>
        <p className="text-muted">Control global de los entornos familiares</p>
      </div>

      <div className="glass-panel table-container">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>Cargando hogares...</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre del Hogar</th>
                <th>Miembros</th>
                <th>Creado en</th>
                <th style={{ textAlign: 'right' }}>Acciones God Mode</th>
              </tr>
            </thead>
            <tbody>
              {hogares.map(h => (
                <tr key={h.id}>
                  <td style={{ fontWeight: 500 }}>{h.nombre}</td>
                  <td>
                    <span className="badge">{h.usuarios_count} usuario(s)</span>
                  </td>
                  <td className="text-muted">{new Date(h.created_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => handleDelete(h.id, h.nombre)} className="btn btn-danger" style={{ padding: '6px 12px' }}>
                      <Trash2 size={16} /> Destruir
                    </button>
                  </td>
                </tr>
              ))}
              {hogares.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: 32 }}>No hay hogares</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
