import { describe, it, expect } from 'vitest';
import { scaleFoodItem, scaleFoodItems, scalePortionString } from '../utils/portionScaler';
import { FoodItem } from '../types';

describe('Portion Scaler Utility', () => {
  const sampleItem: FoodItem = {
    id: 'item-1',
    name: 'Grilled Salmon with Rice',
    portion: '200g',
    grams: 200,
    carbs: 40,
    fiber: 4,
    protein: 34,
    fat: 16,
    unsaturatedFat: 12,
    saturatedFat: 4,
    transFat: 0,
    cholesterol: 85,
    calories: 440,
    confidence: 'high'
  };

  describe('scaleFoodItem', () => {
    it('scales all macronutrients and calories by 0.5x (half portion)', () => {
      const halved = scaleFoodItem(sampleItem, 0.5);

      expect(halved.grams).toBe(100);
      expect(halved.carbs).toBe(20);
      expect(halved.fiber).toBe(2);
      expect(halved.protein).toBe(17);
      expect(halved.fat).toBe(8);
      expect(halved.unsaturatedFat).toBe(6);
      expect(halved.saturatedFat).toBe(2);
      expect(halved.transFat).toBe(0);
      expect(halved.cholesterol).toBe(43); // 85 * 0.5 = 42.5 -> 43
      expect(halved.calories).toBe(220); // 440 * 0.5
      expect(halved.portion).toBe('100g');
    });

    it('scales all macronutrients and calories by 2.0x (double portion)', () => {
      const doubled = scaleFoodItem(sampleItem, 2.0);

      expect(doubled.grams).toBe(400);
      expect(doubled.carbs).toBe(80);
      expect(doubled.fiber).toBe(8);
      expect(doubled.protein).toBe(68);
      expect(doubled.fat).toBe(32);
      expect(doubled.unsaturatedFat).toBe(24);
      expect(doubled.saturatedFat).toBe(8);
      expect(doubled.cholesterol).toBe(170);
      expect(doubled.calories).toBe(880);
      expect(doubled.portion).toBe('400g');
    });

    it('scales by 0.75x (three-quarter portion)', () => {
      const threeQuarter = scaleFoodItem(sampleItem, 0.75);

      expect(threeQuarter.grams).toBe(150);
      expect(threeQuarter.carbs).toBe(30);
      expect(threeQuarter.fiber).toBe(3);
      expect(threeQuarter.protein).toBe(25.5);
      expect(threeQuarter.fat).toBe(12);
      expect(threeQuarter.calories).toBe(330);
      expect(threeQuarter.portion).toBe('150g');
    });

    it('preserves exact values when scaled by 1.0x', () => {
      const original = scaleFoodItem(sampleItem, 1.0);

      expect(original.grams).toBe(sampleItem.grams);
      expect(original.carbs).toBe(sampleItem.carbs);
      expect(original.protein).toBe(sampleItem.protein);
      expect(original.fat).toBe(sampleItem.fat);
      expect(original.calories).toBe(sampleItem.calories);
    });
  });

  describe('scalePortionString', () => {
    it('scales gram amounts correctly', () => {
      expect(scalePortionString('150g', 75, 0.5)).toBe('75g');
      expect(scalePortionString('200 g', 100, 0.5)).toBe('100g');
      expect(scalePortionString('50g', 100, 2.0)).toBe('100g');
    });

    it('scales countable unit descriptions correctly', () => {
      expect(scalePortionString('2 slices', 70, 0.5)).toBe('1 slices');
      expect(scalePortionString('1 serving', 100, 0.5)).toBe('0.5 serving');
      expect(scalePortionString('1.5 cups', 150, 2.0)).toBe('3 cups');
      expect(scalePortionString('3 eggs', 150, 0.33)).toBe('1 eggs');
    });

    it('handles non-numeric portions gracefully', () => {
      expect(scalePortionString('medium bowl', 250, 0.5)).toBe('0.5x (medium bowl)');
      expect(scalePortionString('medium bowl', 500, 1.0)).toBe('medium bowl');
    });
  });

  describe('scaleFoodItems', () => {
    it('scales an array of food items simultaneously', () => {
      const item2: FoodItem = {
        id: 'item-2',
        name: 'Olive Oil',
        portion: '1 tbsp',
        grams: 14,
        carbs: 0,
        fiber: 0,
        protein: 0,
        fat: 14,
        calories: 120
      };

      const scaledList = scaleFoodItems([sampleItem, item2], 0.5);

      expect(scaledList).toHaveLength(2);
      expect(scaledList[0].calories).toBe(220);
      expect(scaledList[1].calories).toBe(60);
      expect(scaledList[1].fat).toBe(7);
      expect(scaledList[1].portion).toBe('0.5 tbsp');
    });
  });
});
