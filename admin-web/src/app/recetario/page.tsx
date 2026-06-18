"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/AdminNav";
import RecetaForm from "@/components/RecetaForm";
import { adminApi, ApiError, RecetaMaestra } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export default function RecetarioPage() {
  const router = useRouter();
  const [recetas, setRecetas] = useState<RecetaMaestra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [activaOnly, setActivaOnly] = useState(false);

  function load() {
    adminApi
      .getRecetario(activaOnly)
      .then(setRecetas)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.push("/login");
        else setError("Error al cargar el recetario.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaOnly]);

  async function handleCreate(data: Omit<RecetaMaestra, "id" | "activa" | "created_at" | "updated_at">) {
    await adminApi.createReceta(data);
    setShowForm(false);
    load();
  }

  async function toggleActiva(receta: RecetaMaestra) {
    await adminApi.patchReceta(receta.id, { activa: !receta.activa });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta receta del catálogo maestro?")) return;
    await adminApi.deleteReceta(id);
    load();
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Recetario maestro</h1>
            <p className="text-sm text-gray-500 mt-1">
              Catalogo de recetas mediterraneas espanolas para el asistente.
            </p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nueva receta"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Nueva receta</h2>
            <RecetaForm onSubmit={handleCreate} submitLabel="Crear receta" />
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activaOnly}
              onChange={(e) => setActivaOnly(e.target.checked)}
              className="rounded"
            />
            Solo activas
          </label>
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && recetas.length === 0 && (
          <p className="text-sm text-gray-500">No hay recetas en el catalogo.</p>
        )}

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">Temporada</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700">Aprov.</th>
                <th className="text-center px-4 py-3 font-medium text-gray-700">Activa</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recetas.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link
                      href={`/recetario/${r.id}`}
                      className="hover:text-indigo-600 hover:underline"
                    >
                      {r.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.categoria}</td>
                  <td className="px-4 py-3 text-gray-500">{r.temporada ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {r.aprovechamiento ? "Si" : "No"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiva(r)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.activa
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {r.activa ? "Activa" : "Inactiva"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
