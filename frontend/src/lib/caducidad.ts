import { colors } from '../theme/tokens';

export type NivelCaducidad = 'fresco' | 'pronto' | 'urgente';

export interface SemaforoCaducidad {
  nivel: NivelCaducidad;
  color: string;
  colorSoft: string;
  etiqueta: string;
}

/**
 * Devuelve el nivel del semáforo de caducidad según los días restantes.
 * `umbral` (default 6) define cuándo empieza "Consumir pronto"; es configurable por el usuario.
 * El borde "urgente" (≤3 días) es fijo — siempre requiere atención inmediata.
 * Pasa null para artículos sin fecha de caducidad → siempre "fresco".
 */
export function getSemaforoCaducidad(dias: number | null, umbral = 6): SemaforoCaducidad {
  if (dias === null || dias > umbral) {
    return {
      nivel: 'fresco',
      color: colors.success,
      colorSoft: colors.successSoft,
      etiqueta: 'Fresco',
    };
  }
  if (dias > 3) {
    return {
      nivel: 'pronto',
      color: colors.warning,
      colorSoft: colors.warningSoft,
      etiqueta: 'Consumir pronto',
    };
  }
  return {
    nivel: 'urgente',
    color: colors.danger,
    colorSoft: colors.dangerSoft,
    etiqueta: dias <= 0 ? 'Caducado' : '¡Urgente!',
  };
}
