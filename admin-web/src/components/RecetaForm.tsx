"use client";

import { useState } from "react";
import { RecetaMaestra } from "@/lib/api";

type RecetaInput = Omit<RecetaMaestra, "id" | "activa" | "created_at" | "updated_at">;

interface Props {
  initial?: Partial<RecetaInput>;
  onSubmit: (data: RecetaInput) => Promise<void>;
  submitLabel?: string;
}

function TagInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput("");
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-indigo-400 hover:text-indigo-700"
            >
              x
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={`Anadir ${label.toLowerCase()}...`}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 rounded-md bg-gray-100 text-sm font-medium hover:bg-gray-200"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function RecetaForm({ initial, onSubmit, submitLabel = "Guardar" }: Props) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [ingredientes, setIngredientes] = useState<string[]>(initial?.ingredientes ?? []);
  const [pasos, setPasos] = useState<string[]>(initial?.pasos ?? []);
  const [categoria, setCategoria] = useState(initial?.categoria ?? "");
  const [temporada, setTemporada] = useState(initial?.temporada ?? "");
  const [aprovechamiento, setAprovechamiento] = useState(initial?.aprovechamiento ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre || ingredientes.length === 0 || pasos.length === 0 || !categoria) {
      setError("Nombre, ingredientes, pasos y categoria son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        nombre,
        ingredientes,
        pasos,
        categoria,
        temporada: temporada || null,
        aprovechamiento,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Tortilla de patatas clasica"
        />
      </div>

      <TagInput label="Ingredientes" values={ingredientes} onChange={setIngredientes} />
      <TagInput label="Pasos" values={pasos} onChange={setPasos} />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Huevos"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temporada (opcional)
          </label>
          <input
            value={temporada}
            onChange={(e) => setTemporada(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Verano"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={aprovechamiento}
          onChange={(e) => setAprovechamiento(e.target.checked)}
          className="rounded"
        />
        Receta de aprovechamiento
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
