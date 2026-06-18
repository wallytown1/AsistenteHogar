"use client";

import { useState } from "react";
import { adminApi, PromptTemplate } from "@/lib/api";

interface Props {
  template: PromptTemplate;
  onSaved: (updated: PromptTemplate) => void;
}

export default function PromptEditor({ template, onSaved }: Props) {
  const [instruction, setInstruction] = useState(template.system_instruction);
  const [activo, setActivo] = useState(template.activo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await adminApi.patchPrompt(template.clave, {
        system_instruction: instruction,
        activo,
      });
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-sm font-semibold text-gray-800">
            {template.clave}
          </span>
          <span className="ml-2 text-xs text-gray-400">v{template.version}</span>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="rounded"
          />
          Activo
        </label>
      </div>

      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        rows={10}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="System instruction para este prompt..."
      />

      <p className="text-xs text-gray-500 italic">
        La filosofia mediterranea se anade automaticamente al final — no es necesario incluirla.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
