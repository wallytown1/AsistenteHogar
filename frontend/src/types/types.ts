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
  ultima_confirmacion?: string | null;
  // Calculado por el backend: probablemente consumido según la cadencia de compra.
  incierto?: boolean;
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

export type Valoracion = 'me_encanto' | 'gusto' | 'no_me_gusto';

export interface RecetaHistorial {
  id: string;
  hogar_id: string;
  nombre_receta: string;
  accion: 'cocinada' | 'rechazada';
  valoracion: Valoracion | null;
  categoria: string | null;
  cocinada_en: string;
  created_at: string;
}

export interface SugerenciaCompra {
  nombre: string;
  cantidad_habitual: number | null;
  unidad: string | null;
  motivo: string;
}

export type ChefRol = 'usuario' | 'chef';

export interface ConsumoAplicado {
  item_id: string;
  nombre: string;
  cantidad_anterior: number;
  fue_agotado: boolean;
}

export interface ChefMensaje {
  rol: ChefRol;
  texto: string;
  platos?: RecetaSugerida[];
  consumos_aplicados?: string[];
  consumos_detalle?: ConsumoAplicado[];
}

export interface ChefChatResponse {
  respuesta: string;
  generado_por_ia: boolean;
  mensaje: string | null;
  platos?: RecetaSugerida[];
  consumos_aplicados?: string[];
  consumos_detalle?: ConsumoAplicado[];
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
  notificacion_push?: string;
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

export interface ProductoTicketPdf {
  nombre: string;
  cantidad: number;
  unidad: string;
  categoria: string;
  fecha_caducidad: string | null; // YYYY-MM-DD
  precio_unitario: number | null; // € por unidad extraído del ticket
}

export interface TicketPdfResponse {
  productos: ProductoTicketPdf[];
  fecha_compra: string | null; // YYYY-MM-DD
  supermercado: string | null;
  mensaje: string | null;
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

export interface PerfilIndividual {
  id: string;
  hogar_id: string;
  nombre: string;
  preferencias_dieta: string[];
  excluir_ingredientes: string[];
  created_at: string;
  updated_at: string;
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

export interface ListaCompraItem {
  id: string;
  hogar_id: string;
  nombre: string;
  cantidad: number | null;
  unidad: string | null;
  is_checked: boolean;
  created_at: string;
  updated_at: string;
}

export interface RechazarIngredienteResponse {
  perfil_id: string;
  nombre_perfil: string;
  ingredientes_anadidos: string[];
  excluir_ingredientes_actualizado: string[];
  generado_por_ia: boolean;
  mensaje: string | null;
}

export interface TranscribeAudioResponse {
  texto: string;
  generado_por_ia: boolean;
}

export interface AhorroPreviewResponse {
  mes: string; // YYYY-MM
  recetas_cocinadas: number;
  ahorro_estimado_eur: number;
  tiene_datos_reales: boolean;
  mensaje: string | null;
}

export interface DesgloseMensualItem {
  nombre: string;
  cantidad_total: number;
  unidad: string;
  precio_unitario_medio: number;
  valor_total: number;
}

export interface AhorroResumenResponse {
  mes: string; // YYYY-MM
  recetas_cocinadas: number;
  ahorro_real_eur: number | null;
  ahorro_estimado_eur: number;
  tiene_datos_reales: boolean;
  kg_no_desperdiciados: number;
  porcentaje_media_espana: number;
  num_comensales: number;
  tickets_analizados: number;
  desglose: DesgloseMensualItem[];
  mensaje: string | null;
}
