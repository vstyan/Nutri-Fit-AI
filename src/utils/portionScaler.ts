import { FoodItem } from '../types';

/**
 * Intelligently scales portion descriptions (e.g. "150g", "2 slices", "1 cup") by a multiplier.
 */
export function scalePortionString(portionStr: string | undefined, grams: number, scale: number): string {
  if (!portionStr) return `${grams}g`;
  const trimmed = portionStr.trim();
  
  // Direct gram string e.g. "150g" or "150 g"
  if (/^\d+(?:\.\d+)?\s*g$/i.test(trimmed)) {
    return `${grams}g`;
  }

  // Counted units e.g. "2 slices", "1.5 cups", "1 serving", "2.5 scoops"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    const originalCount = parseFloat(match[1]);
    const newCount = Math.round(originalCount * scale * 10) / 10;
    const unit = match[2];
    return unit ? `${newCount} ${unit}` : `${newCount}`;
  }

  if (scale === 1) return trimmed;
  return `${scale}x (${trimmed})`;
}

/**
 * Mathematically scales a FoodItem by a given multiplier (e.g. 0.5 for half portion).
 */
export function scaleFoodItem(item: FoodItem, scale: number): FoodItem {
  const factor = Math.max(0.01, scale);
  const g = item.grams > 0 ? Math.max(1, Math.round(item.grams * factor)) : item.grams;
  const c = Math.round(item.carbs * factor * 10) / 10;
  const fib = Math.round((item.fiber || 0) * factor * 10) / 10;
  const p = Math.round(item.protein * factor * 10) / 10;
  const f = Math.round(item.fat * factor * 10) / 10;
  
  const uFat = item.unsaturatedFat !== undefined 
    ? Math.round(item.unsaturatedFat * factor * 10) / 10 
    : undefined;
  const sFat = item.saturatedFat !== undefined 
    ? Math.round(item.saturatedFat * factor * 10) / 10 
    : undefined;
  const tFat = item.transFat !== undefined 
    ? Math.round(item.transFat * factor * 10) / 10 
    : undefined;
  const chol = item.cholesterol !== undefined 
    ? Math.round(item.cholesterol * factor) 
    : undefined;

  // Scale calories proportionally
  const cal = Math.round(item.calories * factor);

  return {
    ...item,
    grams: g,
    carbs: c,
    fiber: fib,
    protein: p,
    fat: f,
    unsaturatedFat: uFat,
    saturatedFat: sFat,
    transFat: tFat,
    cholesterol: chol,
    calories: cal,
    portion: scalePortionString(item.portion, g, factor)
  };
}

/**
 * Scales an array of FoodItems by a given multiplier.
 */
export function scaleFoodItems(items: FoodItem[], scale: number): FoodItem[] {
  return items.map(item => scaleFoodItem(item, scale));
}
