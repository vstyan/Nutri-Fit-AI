import React, { useState } from 'react';
import { 
  Utensils, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Plus, 
  Camera, 
  Image as ImageIcon 
} from 'lucide-react';
import { MealRecord, MealType } from '../types';

interface MealHistoryProps {
  meals: MealRecord[];
  onDeleteMeal: (mealId: string) => void;
  onOpenCapture: () => void;
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: '🌅' },
  lunch: { label: 'Lunch', icon: '☀️' },
  dinner: { label: 'Dinner', icon: '🌙' },
  snack: { label: 'Snacks & Drinks', icon: '🍎' }
};

export const MealHistory: React.FC<MealHistoryProps> = ({
  meals,
  onDeleteMeal,
  onOpenCapture
}) => {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  if (meals.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
          <Utensils className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">No meals logged for this day</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Take a picture of what you eat with your camera to let Gemini AI analyze your macros and build your daily log.
          </p>
        </div>
        <button
          onClick={onOpenCapture}
          className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20 inline-flex items-center space-x-2"
        >
          <Camera className="w-4 h-4" />
          <span>Snap Meal Photo</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Utensils className="w-4 h-4 text-cyan-400" />
          <span>Today's Meals ({meals.length})</span>
        </h2>
        <button
          onClick={onOpenCapture}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Meal</span>
        </button>
      </div>

      <div className="space-y-3">
        {meals.map(meal => {
          const isExpanded = expandedMealId === meal.id;
          const timeFormatted = new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <div
              key={meal.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition"
            >
              <div className="p-4 flex items-start justify-between gap-3">
                {/* Photo Thumbnail */}
                {meal.photoUrl ? (
                  <button
                    onClick={() => setSelectedPhoto(meal.photoUrl || null)}
                    className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0 bg-slate-950 relative group cursor-pointer"
                    title="Click to view full photo"
                  >
                    <img src={meal.photoUrl} alt={meal.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  </button>
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700/60 flex items-center justify-center shrink-0 text-xl">
                    {MEAL_LABELS[meal.mealType]?.icon || '🍽️'}
                  </div>
                )}

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {MEAL_LABELS[meal.mealType]?.label || meal.mealType}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeFormatted}
                    </span>
                  </div>

                  <h3 className="font-semibold text-white text-sm mt-1 truncate">{meal.title}</h3>

                  {/* Macros line */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-mono font-semibold text-sky-400 bg-sky-950/40 px-2 py-0.5 rounded border border-sky-500/20">
                      {meal.totalCarbs}g <span className="text-[10px] font-normal text-slate-400">Carbs</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                      {meal.totalProtein}g <span className="text-[10px] font-normal text-slate-400">Protein</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                      {meal.totalFat}g <span className="text-[10px] font-normal text-slate-400">Fat</span>
                    </span>
                    <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                      {meal.totalCalories} <span className="text-[10px] font-normal text-slate-400">kcal</span>
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                    title="View food items"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => onDeleteMeal(meal.id)}
                    className="p-2 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                    title="Delete meal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Expanded Food Items List */}
              {isExpanded && meal.items && meal.items.length > 0 && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950/50">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Ingredients & Portions ({meal.items.length})
                  </div>
                  <div className="space-y-1.5">
                    {meal.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800/60"
                      >
                        <div>
                          <span className="font-medium text-slate-200">{item.name}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5">({item.portion || `${item.grams}g`})</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-300 space-x-2">
                          <span className="text-sky-400">{item.carbs}g C</span>
                          <span className="text-rose-400">{item.protein}g P</span>
                          <span className="text-amber-400">{item.fat}g F</span>
                          <span className="text-emerald-400">{item.calories} kcal</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <img src={selectedPhoto} alt="Full meal view" className="w-full h-full object-contain max-h-[85vh]" />
          </div>
        </div>
      )}
    </div>
  );
};
