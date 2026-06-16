export interface AlimentoItem {
  id: string;
  hogar_id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  fecha_caducidad: string | null; // Formato YYYY-MM-DD
  categoria: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventoItem {
  id: string;
  hogar_id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string; // ISO-8601 string
  fecha_fin: string; // ISO-8601 string
  participantes: string[] | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConflictoDetalle {
  evento_a: EventoItem;
  evento_b: EventoItem;
  duracion_solapamiento_segundos: number;
}

export interface ConflictoEvento {
  evento_nuevo: EventoItem;
  evento_conflictivo: EventoItem;
}

export interface TareaItem {
  id: string;
  hogar_id: string;
  nombre: string;
  asignado_a: string | null;
  frecuencia: string;
  prioridad: string;
  ultimo_completado: string | null;
  estado: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PantryStockMetrics {
  porcentaje_stock: number;
  items_disponibles: number;
  alertas_caducidad: AlimentoItem[];
  items: AlimentoItem[];
}

export interface RecetaSugerida {
  titulo: string;
  tiempo_min: number;
  ingredientes_usados: string[];
  pasos: string[];
}

export interface RecetasSugeridasResponse {
  recetas: RecetaSugerida[];
  generado_por_ia: boolean;
  mensaje: string | null;
}

export interface CalendarAgendaResponse {
  eventos: EventoItem[];
  conflictos: ConflictoDetalle[];
}

export interface DashboardData {
  fecha: string;
  eventos_hoy: EventoItem[];
  alertas_despensa: PantryStockMetrics;
  tareas_pendientes: TareaItem[];
  conflictos_agenda: ConflictoDetalle[];
  briefing_texto?: string;
  /** True si el briefing proviene del LLM: obliga a mostrar el aviso de transparencia IA */
  briefing_generado_por_ia?: boolean;
}

export interface CuentaEliminadaResponse {
  success: boolean;
  message: string;
}

export interface EventoInterpretado {
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string; // ISO-8601
  fecha_fin: string; // ISO-8601
  participantes: string[] | null;
}

export interface InterpretarEventoResponse {
  evento: EventoInterpretado | null;
  mensaje: string | null;
}

export interface TareaInterpretada {
  nombre: string;
  asignado_a: string | null;
  frecuencia: string;
  prioridad: string;
}

export interface InterpretarTareaResponse {
  tarea: TareaInterpretada | null;
  mensaje: string | null;
}

export interface AlimentoInterpretado {
  nombre: string;
  cantidad: number;
  unidad: string;
  categoria: string;
  fecha_caducidad: string | null; // YYYY-MM-DD
}

export interface InterpretarDespensaResponse {
  alimentos: AlimentoInterpretado[];
  mensaje: string | null;
}

export interface SugerenciaMetadataResponse {
  categoria: string | null;
  dias_estimados: number | null;
  fecha_caducidad_estimada: string | null; // YYYY-MM-DD
  generado_por_ia: boolean;
  mensaje: string | null;
}

export interface DiaPlanComidas {
  dia: string;
  comida: string;
  cena: string;
}

export interface PlanComidasResponse {
  dias: DiaPlanComidas[];
  generado_por_ia: boolean;
  mensaje: string | null;
}

export interface Usuario {
  id: string;
  hogar_id: string;
  email: string;
  nombre: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Hogar {
  id: string;
  nombre: string;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  usuario: Usuario;
  hogar: Hogar;
}
