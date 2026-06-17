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
 * Umbrales alineados con las alertas del backend (≤6 días) y notificaciones locales (≤3 días).
 * Pasa null para artículos sin fecha de caducidad → siempre "fresco".
 */
export function getSemaforoCaducidad(dias: number | null): SemaforoCaducidad {
  if (dias === null || dias > 6) {
    return {
      nivel: 'fresco',
      color: colors.success,
      colorSoft: colors.successSoft,
      etiqueta: 'Fresco',
    };
  }
  if (dias >= 4) {
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
