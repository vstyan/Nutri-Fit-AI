import React, { useState } from 'react';
import { 
  Utensils, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Plus, 
  Camera, 
  Image as ImageIcon,
  Star,
  Copy,
  Sparkles,
  Bookmark,
  Edit3
} from 'lucide-react';
import { MealRecord, MealType } from '../types';

interface MealHistoryProps {
  meals: MealRecord[];
  favoriteMeals: MealRecord[];
  yesterdayMeals: MealRecord[];
  onDeleteMeal: (mealId: string) => void;
  onEditMeal: (meal: MealRecord) => void;
  onToggleFavorite: (mealId: string) => void;
  onCopyMealToToday: (meal: MealRecord) => void;
  onOpenCapture: () => void;
}

const MEAL_LABELS: Record<MealType, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast', icon: '🌅' },
  lunch: { label: 'Lunch', icon: '☀️' },
  dinner: { label: 'Dinner', icon: '🌙' },
  snack: { label: 'Snacks & Drinks', icon: '🍎' }
};

export const MealHistory: React.FC<MealHistoryProps> = ({
  meals,
  favoriteMeals,
  yesterdayMeals,
  onDeleteMeal,
  onEditMeal,
  onToggleFavorite,
  onCopyMealToToday,
  onOpenCapture
}) => {
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [showQuickDrawer, setShowQuickDrawer] = useState(false);

  const hasQuickOptions = favoriteMeals.length > 0 || yesterdayMeals.length > 0;

  return (
    <div className="space-y-3">
      {/* Section Header with Quick Copy trigger */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Utensils className="w-4 h-4 text-cyan-400" />
          <span>Logged Meals ({meals.length})</span>
        </h2>
        <div className="flex items-center space-x-2">
          {hasQuickOptions && (
            <button
              onClick={() => setShowQuickDrawer(!showQuickDrawer)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Favorites & Recent ({favoriteMeals.length + yesterdayMeals.length})</span>
            </button>
          )}

          <button
            onClick={onOpenCapture}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Meal</span>
          </button>
        </div>
      </div>

      {/* Quick Copy & Favorites Drawer */}
      {showQuickDrawer && hasQuickOptions && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              <span>1-Tap Quick Log</span>
            </span>
            <button
              onClick={() => setShowQuickDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          {/* Yesterday's Meals */}
          {yesterdayMeals.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 block">Copy from Yesterday:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {yesterdayMeals.map(ym => (
                  <div
                    key={`yesterday-${ym.id}`}
                    className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{ym.title}</div>
                      <div className="text-[10px] text-slate-400">{ym.totalCalories} kcal • {ym.netCarbs || ym.totalCarbs}g Net C</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onCopyMealToToday(ym);
                        setShowQuickDrawer(false);
                      }}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Starred Favorites */}
          {favoriteMeals.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-amber-300 block flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Saved Favorites:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {favoriteMeals.map(fav => (
                  <div
                    key={`fav-${fav.id}`}
                    className="p-2.5 bg-slate-950/80 border border-amber-500/20 rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{fav.title}</div>
                      <div className="text-[10px] text-amber-400/80">{fav.totalCalories} kcal • {fav.netCarbs || fav.totalCarbs}g Net C</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onCopyMealToToday(fav);
                        setShowQuickDrawer(false);
                      }}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Log</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {meals.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-cyan-400">
            <Utensils className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No meals logged for this date</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Snap a photo, record your voice, or describe your food to estimate macros with Gemini AI.
            </p>
          </div>
          <button
            onClick={onOpenCapture}
            className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-lg shadow-cyan-500/20 inline-flex items-center space-x-2"
          >
            <Camera className="w-4 h-4" />
            <span>Log Food with AI</span>
          </button>
        </div>
      ) : (
        /* Meals Timeline */
        <div className="space-y-3">
          {meals.map(meal => {
            const isExpanded = expandedMealId === meal.id;
            const timeFormatted = new Date(meal.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const netC = meal.netCarbs !== undefined ? meal.netCarbs : Math.max(0, Math.round(((meal.totalCarbs || 0) - (meal.totalFiber || 0)) * 10) / 10);

            return (
              <div
                key={meal.id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition shadow-md"
              >
                <div className="p-4 flex items-start justify-between gap-3">
                  {/* Photo Thumbnail */}
                  {meal.photoUrl ? (
                    <button
                      onClick={() => setSelectedPhoto(meal.photoUrl || null)}
                      className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0 bg-slate-950 relative group cursor-pointer"
                      title="Click to view photo"
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

                    {/* Macros line with Fiber & Net Carbs */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-xs font-mono font-semibold text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20" title={`Total Carbs: ${meal.totalCarbs}g | Fiber: ${meal.totalFiber || 0}g`}>
                        {netC}g <span className="text-[10px] font-normal text-slate-400">Net C</span>
                      </span>
                      {meal.totalFiber !== undefined && meal.totalFiber > 0 && (
                        <span className="text-xs font-mono font-semibold text-indigo-300 bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {meal.totalFiber}g <span className="text-[10px] font-normal text-slate-400">Fib</span>
                        </span>
                      )}
                      <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/20">
                        {meal.totalProtein}g <span className="text-[10px] font-normal text-slate-400">P</span>
                      </span>
                      <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">
                        {meal.totalFat}g <span className="text-[10px] font-normal text-slate-400">F</span>
                      </span>
                      <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                        {meal.totalCalories} <span className="text-[10px] font-normal text-slate-400">kcal</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit, Favorite, Copy, Expand, Delete */}
                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      onClick={() => onEditMeal(meal)}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition"
                      title="Edit meal & ingredients"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onToggleFavorite(meal.id)}
                      className={`p-1.5 rounded-lg transition ${
                        meal.isFavorite 
                          ? 'text-amber-400 bg-amber-500/10' 
                          : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800'
                      }`}
                      title={meal.isFavorite ? 'Unfavorite' : 'Add to Favorites'}
                    >
                      <Star className={`w-4 h-4 ${meal.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => onCopyMealToToday(meal)}
                      className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition"
                      title="Duplicate meal"
                    >
                      <Copy className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => setExpandedMealId(isExpanded ? null : meal.id)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                      title="View ingredients"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => onDeleteMeal(meal.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="Delete meal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded Food Items List */}
                {isExpanded && meal.items && meal.items.length > 0 && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-800/80 bg-slate-950/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Ingredients & Portions ({meal.items.length})
                      </div>
                      <button
                        type="button"
                        onClick={() => onEditMeal(meal)}
                        className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold py-0.5 px-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 transition"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Ingredients</span>
                      </button>
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
                            <span className="text-cyan-300">{item.carbs}g C</span>
                            {item.fiber !== undefined && item.fiber > 0 && (
                              <span className="text-indigo-300">{item.fiber}g Fib</span>
                            )}
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
      )}

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
