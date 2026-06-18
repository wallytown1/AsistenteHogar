"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminNav from "@/components/AdminNav";
import PromptEditor from "@/components/PromptEditor";
import { adminApi, ApiError, PromptTemplate } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";

export default function PromptsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    adminApi
      .getPrompts()
      .then(setTemplates)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.push("/login");
        else setError("Error al cargar los prompts.");
      })
      .finally(() => setLoading(false));
  }, [router]);

  function handleSaved(updated: PromptTemplate) {
    setTemplates((prev) =>
      prev.some((t) => t.clave === updated.clave)
        ? prev.map((t) => (t.clave === updated.clave ? updated : t))
        : [...prev, updated],
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav />
      <main className="flex-1 p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Prompts IA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Edita las instrucciones de sistema que recibe Gemini. La filosofia mediterranea
            se anade automaticamente al final de cada prompt.
          </p>
        </div>

        {loading && <p className="text-sm text-gray-500">Cargando...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && templates.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500">
              No hay plantillas configuradas. Usa el endpoint{" "}
              <code className="bg-gray-100 px-1 rounded">PATCH /admin/prompts/recetas</code>{" "}
              para crear una, o edita directamente aqui si aparece.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {templates.map((t) => (
            <PromptEditor key={t.clave} template={t} onSaved={handleSaved} />
          ))}
        </div>
      </main>
    </div>
  );
}
