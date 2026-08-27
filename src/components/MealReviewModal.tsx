import React, { useState } from 'react';
import { 
  Check, 
  Edit3, 
  Plus, 
  Trash2, 
  Sparkles, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  ShieldCheck,
  Utensils
} from 'lucide-react';
import { GeminiAnalysisResult, MealRecord, MealType, FoodItem } from '../types';

interface MealReviewModalProps {
  isOpen: boolean;
  photoUrl: string;
  initialResult: GeminiAnalysisResult;
  targetDate: string;
  onSave: (meal: MealRecord) => void;
  onCancel: () => void;
}

export const MealReviewModal: React.FC<MealReviewModalProps> = ({
  isOpen,
  photoUrl,
  initialResult,
  targetDate,
  onSave,
  onCancel
}) => {
  const [title, setTitle] = useState(initialResult.title);
  const [mealType, setMealType] = useState<MealType>(initialResult.mealType || 'lunch');
  const [notes, setNotes] = useState(initialResult.dietaryNotes || '');
  const [isEditing, setIsEditing] = useState(false);
  const [items, setItems] = useState<FoodItem[]>(
    initialResult.items.map((item, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      name: item.name,
      portion: item.portion,
      grams: item.grams,
      carbs: item.carbs,
      protein: item.protein,
      fat: item.fat,
      calories: item.calories,
      confidence: item.confidence
    }))
  );

  if (!isOpen) return null;

  // Calculate live totals
  const totalCarbs = Math.round(items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0) * 10) / 10;
  const totalProtein = Math.round(items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0) * 10) / 10;
  const totalFat = Math.round(items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0) * 10) / 10;
  const totalCalories = Math.round(items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0));

  const handleUpdateItem = (id: string, field: keyof FoodItem, value: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        // Recalculate calories if macros changed
        if (['carbs', 'protein', 'fat'].includes(field)) {
          const c = Number(field === 'carbs' ? value : it.carbs) || 0;
          const p = Number(field === 'protein' ? value : it.protein) || 0;
          const f = Number(field === 'fat' ? value : it.fat) || 0;
          updated.calories = Math.round(c * 4 + p * 4 + f * 9);
        }
        return updated;
      })
    );
  };

  const handleAddItem = () => {
    const newItem: FoodItem = {
      id: `item-${Date.now()}`,
      name: 'New Item',
      portion: '1 serving',
      grams: 100,
      carbs: 10,
      protein: 5,
      fat: 2,
      calories: 78,
      confidence: 'medium'
    };
    setItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(it => it.id !== id));
  };

  const handleQuickSave = () => {
    const meal: MealRecord = {
      id: `meal-${Date.now()}`,
      timestamp: new Date().toISOString(),
      date: targetDate,
      mealType,
      title,
      notes,
      items,
      totalCarbs,
      totalProtein,
      totalFat,
      totalCalories,
      photoUrl
    };
    onSave(meal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-gradient-to-tr from-cyan-500 to-emerald-500 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Meal Analysis Review</h2>
              <p className="text-xs text-slate-400">Gemini Vision Nutrition Estimate</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Meal Photo & Title */}
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {photoUrl && (
              <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden border border-slate-700 shrink-0 relative bg-slate-950">
                <img src={photoUrl} alt="Meal" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 space-y-2.5 w-full">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Meal Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Meal Category</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`px-2 py-1 text-xs font-medium rounded-lg capitalize border transition ${
                        mealType === type
                          ? 'bg-cyan-600 border-cyan-500 text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Macro Quick Cards */}
          <div className="grid grid-cols-4 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="text-center p-2 rounded-lg bg-sky-950/40 border border-sky-500/20">
              <div className="text-[11px] font-medium text-sky-400">Carbs</div>
              <div className="text-lg font-bold text-white mt-0.5">{totalCarbs}<span className="text-xs font-normal text-slate-400">g</span></div>
            </div>
            <div className="text-center p-2 rounded-lg bg-rose-950/40 border border-rose-500/20">
              <div className="text-[11px] font-medium text-rose-400">Protein</div>
              <div className="text-lg font-bold text-white mt-0.5">{totalProtein}<span className="text-xs font-normal text-slate-400">g</span></div>
            </div>
            <div className="text-center p-2 rounded-lg bg-amber-950/40 border border-amber-500/20">
              <div className="text-[11px] font-medium text-amber-400">Fat</div>
              <div className="text-lg font-bold text-white mt-0.5">{totalFat}<span className="text-xs font-normal text-slate-400">g</span></div>
            </div>
            <div className="text-center p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
              <div className="text-[11px] font-medium text-emerald-400">Calories</div>
              <div className="text-lg font-bold text-white mt-0.5">{totalCalories}<span className="text-xs font-normal text-slate-400">kcal</span></div>
            </div>
          </div>

          {/* 1-Tap Save Action Hero */}
          <div className="bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500 text-slate-950 rounded-lg">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Looks good?</div>
                <div className="text-xs text-emerald-300">Instant 1-tap save with AI estimates</div>
              </div>
            </div>
            <button
              onClick={handleQuickSave}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>1-Tap Save</span>
            </button>
          </div>

          {/* Edit Items Section Toggle */}
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="w-full px-4 py-3 bg-slate-800/60 hover:bg-slate-800 text-left flex items-center justify-between transition text-sm font-medium text-slate-200"
            >
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-cyan-400" />
                <span>Review & Customize Ingredients ({items.length} items)</span>
              </div>
              {isEditing ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isEditing && (
              <div className="p-4 space-y-3.5 bg-slate-900/50">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={e => handleUpdateItem(item.id, 'name', e.target.value)}
                        placeholder="Item name"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium flex-1"
                      />
                      <input
                        type="text"
                        value={item.portion}
                        onChange={e => handleUpdateItem(item.id, 'portion', e.target.value)}
                        placeholder="Portion (e.g. 150g)"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300 w-28 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-sky-400 font-medium block">Carbs (g)</span>
                        <input
                          type="number"
                          value={item.carbs}
                          onChange={e => handleUpdateItem(item.id, 'carbs', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 font-medium block">Protein (g)</span>
                        <input
                          type="number"
                          value={item.protein}
                          onChange={e => handleUpdateItem(item.id, 'protein', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 font-medium block">Fat (g)</span>
                        <input
                          type="number"
                          value={item.fat}
                          onChange={e => handleUpdateItem(item.id, 'fat', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 font-medium block">Calories</span>
                        <input
                          type="number"
                          value={item.calories}
                          onChange={e => handleUpdateItem(item.id, 'calories', parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-center text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2 border border-dashed border-slate-700 hover:border-slate-500 rounded-xl text-xs text-slate-300 font-medium flex items-center justify-center space-x-1.5 hover:bg-slate-800/50 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Ingredient / Side Dish</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleQuickSave}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm rounded-xl transition shadow flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Meal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
