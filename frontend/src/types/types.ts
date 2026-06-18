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

export interface PerfilHogar {
  id: string;
  hogar_id: string;
  gustos_culinarios: string[];
  num_comensales: number;
  created_at: string;
  updated_at: string;
}

export interface PantryStockMetrics {
  porcentaje_stock: number;
  items_disponibles: number;
  alertas_caducidad: AlimentoItem[];
  items: AlimentoItem[];
}

export interface FotoNeveraResponse {
  alimentos: AlimentoInterpretado[];
  sugerencias_rapidas: string[];
  mensaje: string | null;
}

export interface RecetaHistorial {
  id: string;
  hogar_id: string;
  nombre_receta: string;
  accion: 'cocinada' | 'rechazada';
  cocinada_en: string;
  created_at: string;
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

export interface SugerenciasResponse {
  recetas: RecetasSugeridasResponse;
  plan_comidas: PlanComidasResponse;
}

export interface DashboardData {
  fecha: string;
  alertas_despensa: PantryStockMetrics;
  briefing_texto?: string;
  /** True si el briefing proviene del LLM: obliga a mostrar el aviso de transparencia IA */
  briefing_generado_por_ia?: boolean;
}

export interface CuentaEliminadaResponse {
  success: boolean;
  message: string;
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
