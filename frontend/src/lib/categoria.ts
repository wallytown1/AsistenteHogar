import { FoodIconName } from '../components/ui';

/** Icono culinario (MaterialCommunityIcons) según la categoría del alimento. */
export function getCategoriaIcon(categoria: string): FoodIconName {
  const c = (categoria || '').toLowerCase();
  if (c.includes('lácteo') || c.includes('lacteo')) return 'cup-water';
  if (c.includes('carne')) return 'food-drumstick-outline';
  if (c.includes('fruta')) return 'food-apple-outline';
  if (c.includes('verdura') || c.includes('vegetal')) return 'carrot';
  if (c.includes('bebida')) return 'bottle-soda-outline';
  if (c.includes('pan') || c.includes('cereal')) return 'baguette';
  return 'food-outline';
}
