"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import RecetaForm from "@/components/RecetaForm";
import { adminApi, ApiError, RecetaMaestra } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import Link from "next/link";

export default function RecetaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [receta, setReceta] = useState<RecetaMaestra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    adminApi
      .getReceta(id)
      .then(setReceta)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.push("/login");
        else if (e instanceof ApiError && e.status === 404) setError("Receta no encontrada.");
        else setError("Error al cargar la receta.");
      })
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleUpdate(data: Omit<RecetaMaestra, "id" | "activa" | "created_at" | "updated_at">) {
    const updated = await adminApi.patchReceta(id, data);
    setReceta(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8 max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/recetario"
            className="text-sm text-gray-500 hover:text-indigo-600"
          >
            Recetario
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-900">
            {receta?.nombre ?? "Cargando..."}
          </span>
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {receta && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h1 className="text-lg font-semibold text-gray-900 mb-4">{receta.nombre}</h1>
            {saved && (
              <div className="mb-4 bg-green-50 text-green-700 text-sm px-3 py-2 rounded-md">
                Guardado correctamente.
              </div>
            )}
            <RecetaForm
              initial={receta}
              onSubmit={handleUpdate}
              submitLabel="Actualizar receta"
            />
          </div>
        )}
      </main>
    </div>
  );
}
