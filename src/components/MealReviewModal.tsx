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
  Wheat,
  Star,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { GeminiAnalysisResult, MealRecord, MealType, FoodItem } from '../types';
import { analyzeFoodText } from '../services/geminiService';

interface MealReviewModalProps {
  isOpen: boolean;
  photoUrl?: string;
  initialResult?: GeminiAnalysisResult | null;
  editingMeal?: MealRecord | null;
  targetDate: string;
  geminiApiKey?: string;
  onSave: (meal: MealRecord) => void;
  onCancel: () => void;
}

export const MealReviewModal: React.FC<MealReviewModalProps> = ({
  isOpen,
  photoUrl = '',
  initialResult,
  editingMeal,
  targetDate,
  geminiApiKey,
  onSave,
  onCancel
}) => {
  const isEditMode = !!editingMeal;
  const [title, setTitle] = useState(editingMeal?.title || initialResult?.title || '');
  const [mealType, setMealType] = useState<MealType>(editingMeal?.mealType || initialResult?.mealType || 'lunch');
  const [notes, setNotes] = useState(editingMeal?.notes || initialResult?.dietaryNotes || '');
  const [isFavorite, setIsFavorite] = useState(editingMeal?.isFavorite || false);
  const [isEditing, setIsEditing] = useState(isEditMode);
  const [items, setItems] = useState<FoodItem[]>(() => {
    if (editingMeal && editingMeal.items) {
      return editingMeal.items;
    }
    if (initialResult && initialResult.items) {
      return initialResult.items.map((item, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        name: item.name,
        portion: item.portion,
        grams: item.grams,
        carbs: item.carbs,
        fiber: item.fiber || 0,
        protein: item.protein,
        fat: item.fat,
        calories: item.calories,
        confidence: item.confidence
      }));
    }
    return [];
  });

  // Sync state whenever modal opens or props change
  React.useEffect(() => {
    if (isOpen) {
      if (editingMeal) {
        setTitle(editingMeal.title);
        setMealType(editingMeal.mealType || 'lunch');
        setNotes(editingMeal.notes || '');
        setIsFavorite(!!editingMeal.isFavorite);
        setIsEditing(true);
        setItems(
          (editingMeal.items || []).map((item, idx) => ({
            id: item.id || `item-${Date.now()}-${idx}`,
            name: item.name,
            portion: item.portion || `${item.grams || 100}g`,
            grams: item.grams || 100,
            carbs: item.carbs || 0,
            fiber: item.fiber || 0,
            protein: item.protein || 0,
            fat: item.fat || 0,
            calories: item.calories || 0,
            confidence: item.confidence || 'high'
          }))
        );
      } else if (initialResult) {
        setTitle(initialResult.title);
        setMealType(initialResult.mealType || 'lunch');
        setNotes(initialResult.dietaryNotes || '');
        setIsFavorite(false);
        setIsEditing(false);
        setItems(
          initialResult.items.map((item, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            name: item.name,
            portion: item.portion,
            grams: item.grams,
            carbs: item.carbs,
            fiber: item.fiber || 0,
            protein: item.protein,
            fat: item.fat,
            calories: item.calories,
            confidence: item.confidence
          }))
        );
      }
    }
  }, [isOpen, editingMeal, initialResult]);

  if (!isOpen) return null;

  const currentPhoto = editingMeal ? (editingMeal.photoUrl || photoUrl) : photoUrl;

  // Calculate live totals
  const totalCarbs = Math.round(items.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0) * 10) / 10;
  const totalFiber = Math.round(items.reduce((sum, item) => sum + (Number(item.fiber) || 0), 0) * 10) / 10;
  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const totalProtein = Math.round(items.reduce((sum, item) => sum + (Number(item.protein) || 0), 0) * 10) / 10;
  const totalFat = Math.round(items.reduce((sum, item) => sum + (Number(item.fat) || 0), 0) * 10) / 10;
  const totalCalories = Math.round(items.reduce((sum, item) => sum + (Number(item.calories) || 0), 0));

  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzeError, setReanalyzeError] = useState<string | null>(null);

  const handleReanalyzeWithAI = async () => {
    if (!title.trim()) return;
    if (!geminiApiKey) {
      setReanalyzeError('Please enter your Gemini API Key in Settings to re-calculate with AI.');
      return;
    }
    setIsReanalyzing(true);
    setReanalyzeError(null);
    try {
      const descriptionToAnalyze = notes.trim() ? `${title.trim()}, ${notes.trim()}` : title.trim();
      const result = await analyzeFoodText(descriptionToAnalyze, geminiApiKey);
      if (result.items && result.items.length > 0) {
        setItems(
          result.items.map((item, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            name: item.name,
            portion: item.portion,
            grams: item.grams,
            carbs: item.carbs,
            fiber: item.fiber || 0,
            protein: item.protein,
            fat: item.fat,
            calories: item.calories,
            confidence: item.confidence
          }))
        );
      }
      if (result.title) setTitle(result.title);
      if (result.mealType) setMealType(result.mealType);
      if (result.dietaryNotes) setNotes(result.dietaryNotes);
    } catch (err: any) {
      console.error('Re-estimation error:', err);
      setReanalyzeError(err.message || 'Failed to re-calculate macros with Gemini AI.');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleUpdateItem = (id: string, field: keyof FoodItem, value: any) => {
    setItems(prev =>
      prev.map(it => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (['carbs', 'protein', 'fat', 'fiber'].includes(field)) {
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
      name: 'New Ingredient',
      portion: '1 serving',
      grams: 100,
      carbs: 10,
      fiber: 2,
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
      id: editingMeal ? editingMeal.id : `meal-${Date.now()}`,
      timestamp: editingMeal ? editingMeal.timestamp : new Date().toISOString(),
      date: editingMeal ? editingMeal.date : targetDate,
      mealType,
      title: title.trim() || (editingMeal ? editingMeal.title : 'Meal Entry'),
      notes,
      items,
      totalCarbs,
      totalFiber,
      netCarbs,
      totalProtein,
      totalFat,
      totalCalories,
      photoUrl: currentPhoto,
      isFavorite
    };
    onSave(meal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl text-white ${isEditMode ? 'bg-cyan-600' : 'bg-gradient-to-tr from-cyan-500 to-emerald-500'}`}>
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {isEditMode ? 'Edit Meal & Ingredients' : 'Meal Analysis Review'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditMode ? 'Modify ingredients, portions, macros, and meal title' : 'Gemini AI Nutrition & Macro Breakdown'}
              </p>
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
            {photoUrl ? (
              <div className="w-full sm:w-32 h-32 rounded-xl overflow-hidden border border-slate-700 shrink-0 relative bg-slate-950">
                <img src={photoUrl} alt="Meal" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-full sm:w-28 h-28 rounded-xl border border-slate-800 bg-slate-950 flex flex-col items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-8 h-8" />
                <span className="text-[10px] text-slate-400 mt-1 font-semibold">Text/Voice Log</span>
              </div>
            )}

            <div className="flex-1 space-y-2.5 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Meal Title / Description</label>
                  <input
                    type="text"
                    value={title}
                    onFocus={e => e.target.select()}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Protein shake with whey, banana, and peanut butter"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-medium focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIsFavorite(!isFavorite)}
                  title={isFavorite ? 'Saved as Favorite' : 'Save as Favorite'}
                  className={`p-2 rounded-xl border transition mt-4 ${
                    isFavorite 
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-amber-400'
                  }`}
                >
                  <Star className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* 1-Tap AI Recalculate Button */}
              <button
                type="button"
                onClick={handleReanalyzeWithAI}
                disabled={isReanalyzing || !title.trim()}
                className="w-full px-3 py-1.5 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-emerald-950/70 hover:from-cyan-900/70 hover:to-emerald-900/70 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition shadow-sm disabled:opacity-50"
                title="Pass this updated description to Gemini to re-estimate all ingredients, portions, and macros"
              >
                {isReanalyzing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini AI is recalculating ingredients & macros...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-current" />
                    <span>Recalculate Macros with Gemini AI</span>
                  </>
                )}
              </button>

              {reanalyzeError && (
                <div className="p-2 bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{reanalyzeError}</span>
                </div>
              )}

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

          {/* Macro Quick Cards with Fiber & Net Carbs */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="text-center p-2 rounded-lg bg-sky-950/40 border border-sky-500/20">
                <div className="text-[10px] font-medium text-sky-400">Total Carbs</div>
                <div className="text-base font-bold text-white mt-0.5">{totalCarbs}<span className="text-[10px] font-normal text-slate-400">g</span></div>
              </div>

              <div className="text-center p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20">
                <div className="text-[10px] font-medium text-indigo-400">Fiber</div>
                <div className="text-base font-bold text-white mt-0.5">{totalFiber}<span className="text-[10px] font-normal text-slate-400">g</span></div>
              </div>

              <div className="text-center p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20">
                <div className="text-[10px] font-medium text-cyan-300">Net Carbs</div>
                <div className="text-base font-extrabold text-cyan-300 mt-0.5">{netCarbs}<span className="text-[10px] font-normal text-slate-400">g</span></div>
              </div>

              <div className="text-center p-2 rounded-lg bg-rose-950/40 border border-rose-500/20">
                <div className="text-[10px] font-medium text-rose-400">Protein</div>
                <div className="text-base font-bold text-white mt-0.5">{totalProtein}<span className="text-[10px] font-normal text-slate-400">g</span></div>
              </div>

              <div className="text-center p-2 rounded-lg bg-amber-950/40 border border-amber-500/20">
                <div className="text-[10px] font-medium text-amber-400">Fat</div>
                <div className="text-base font-bold text-white mt-0.5">{totalFat}<span className="text-[10px] font-normal text-slate-400">g</span></div>
              </div>

              <div className="text-center p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20">
                <div className="text-[10px] font-medium text-emerald-400">Calories</div>
                <div className="text-base font-bold text-white mt-0.5">{totalCalories}<span className="text-[10px] font-normal text-slate-400">kcal</span></div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-right px-1">
              Net Carbs = Total Carbs ({totalCarbs}g) - Fiber ({totalFiber}g) = <strong className="text-cyan-300">{netCarbs}g</strong>
            </div>
          </div>

          {/* 1-Tap Save Action Hero */}
          <div className="bg-gradient-to-r from-emerald-950/50 to-slate-900 border border-emerald-500/40 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-emerald-500 text-slate-950 rounded-lg">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  {isEditMode ? 'Done modifying meal?' : 'Looks accurate?'}
                </div>
                <div className="text-xs text-emerald-300">
                  {isEditMode ? '1-tap save your updated ingredients & macros' : '1-tap save with AI macro estimations'}
                </div>
              </div>
            </div>
            <button
              onClick={handleQuickSave}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-emerald-500/20 flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{isEditMode ? 'Update Meal' : '1-Tap Save'}</span>
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
                        onFocus={e => e.target.select()}
                        onChange={e => handleUpdateItem(item.id, 'name', e.target.value)}
                        placeholder="Item name"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-medium flex-1"
                      />
                      <input
                        type="text"
                        value={item.portion}
                        onFocus={e => e.target.select()}
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

                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-sky-400 font-medium block">Carbs (g)</span>
                        <input
                          type="number"
                          value={item.carbs === 0 ? '' : item.carbs}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateItem(item.id, 'carbs', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-indigo-400 font-medium block">Fiber (g)</span>
                        <input
                          type="number"
                          value={item.fiber === 0 ? '' : item.fiber}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateItem(item.id, 'fiber', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 font-medium block">Protein (g)</span>
                        <input
                          type="number"
                          value={item.protein === 0 ? '' : item.protein}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateItem(item.id, 'protein', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-400 font-medium block">Fat (g)</span>
                        <input
                          type="number"
                          value={item.fat === 0 ? '' : item.fat}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateItem(item.id, 'fat', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white text-xs"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-400 font-medium block">Calories</span>
                        <input
                          type="number"
                          value={item.calories === 0 ? '' : item.calories}
                          placeholder="0"
                          onFocus={e => e.target.select()}
                          onChange={e => handleUpdateItem(item.id, 'calories', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-center text-white text-xs"
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
            <span>{isEditMode ? 'Save Changes' : 'Save Meal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
