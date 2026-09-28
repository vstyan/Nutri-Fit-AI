export const APP_VERSION = '1.7.0';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Gender = 'male' | 'female';
export type UnitSystem = 'metric' | 'imperial';

export interface UserProfile {
  gender: Gender;
  age: number;
  weightKg: number; // stored in kg
  heightCm: number; // stored in cm
  unitSystem: UnitSystem;
}

export interface WeightRecord {
  date: string; // YYYY-MM-DD
  weightKg: number;
  weightLbs: number;
  timestamp: string;
  notes?: string;
}

export type LipidUnit = 'mg_dl' | 'mmol_l';

export interface BloodLipidRecord {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO string
  unit: LipidUnit;
  totalCholesterol: number; // in mg/dL (canonical storage)
  ldl: number; // in mg/dL (canonical storage)
  hdl: number; // in mg/dL (canonical storage)
  triglycerides: number; // in mg/dL (canonical storage)
  notes?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  portion: string;
  grams: number;
  carbs: number;
  fiber: number; // dietary fiber in grams
  protein: number;
  fat: number;
  unsaturatedFat?: number; // healthy unsaturated fat (mono + poly) in grams
  saturatedFat?: number;   // saturated fat in grams
  transFat?: number;       // trans fat in grams
  cholesterol?: number;    // dietary cholesterol in milligrams (mg)
  calories: number;
  confidence?: 'high' | 'medium' | 'low';
}

export interface MealRecord {
  id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  mealType: MealType;
  title: string;
  notes?: string;
  items: FoodItem[];
  totalCarbs: number;
  totalFiber: number; // dietary fiber in grams
  netCarbs: number; // totalCarbs - totalFiber (min 0)
  totalProtein: number;
  totalFat: number;
  totalUnsaturatedFat?: number; // sum of healthy unsaturated fats in grams
  totalSaturatedFat?: number;   // sum of saturated fats in grams
  totalTransFat?: number;       // sum of trans fats in grams
  totalCholesterol?: number;    // sum of dietary cholesterol in milligrams (mg)
  totalCalories: number;
  photoUrl?: string; // base64
  isFavorite?: boolean;
}

export interface WorkoutEntry {
  id: string;
  timestamp: string; // ISO string
  title: string;
  description: string;
  caloriesBurned: number; // kcal
  durationMinutes?: number;
  intensity?: 'low' | 'moderate' | 'high' | 'vigorous';
  explanation?: string;
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  activeCaloriesBurned: number; // exercise / workout calories entered by user (EAT)
  baseBmrCalories: number; // resting BMR base calories
  neatCalories?: number; // Non-Exercise Activity Thermogenesis (baseline sedentary floor when manual)
  tefCalories?: number; // Thermic Effect of Food dynamically calculated from logged food
  totalCaloriesBurned: number; // Total TDEE: BMR + NEAT + EAT + TEF
  workouts?: WorkoutEntry[];
  notes?: string;
  source?: 'manual' | 'google_fit';
  lastSyncedAt?: string;
  lastUpdated: string;
}

export interface BurnBreakdown {
  bmr: number;
  neat: number;
  eat: number;
  tef: number;
  total: number;
}

export interface UserGoals {
  dailyCaloriesTarget: number; // kcal
  dailyCarbsTarget: number; // g
  dailyFiberTarget: number; // g
  dailyProteinTarget: number; // g
  dailyFatTarget: number; // g
  dailyCholesterolTarget?: number; // mg (e.g. 300)
}

export type StorageLocation = 'google_drive' | 'local_indexeddb';
export type ThemeMode = 'pure_black' | 'midnight_slate' | 'apple_dark';

export interface AppSettings {
  geminiApiKey: string;
  googleClientId?: string;
  storageLocation: StorageLocation;
  storagePromptDismissed: boolean;
  googleAccessToken?: string;
  googleFitConnected?: boolean;
  googleFitAccessToken?: string;
  googleFitTokenExpiry?: number;
  googleFitLastSync?: string;
  googleFitUserEmail?: string;
  includeRestingCalories?: boolean;
  themeMode?: ThemeMode;
  profile: UserProfile;
  goals: UserGoals;
}

export interface DailySummary {
  date: string;
  meals: MealRecord[];
  activity: DailyActivity;
  weightRecord?: WeightRecord;
  totals: {
    calories: number;
    carbs: number;
    fiber: number;
    netCarbs: number;
    protein: number;
    fat: number;
    unsaturatedFat?: number;
    saturatedFat?: number;
    transFat?: number;
    cholesterol?: number; // dietary cholesterol in mg
    tef?: number; // Thermic Effect of Food (TEF) dynamically calculated
  };
  burnBreakdown?: BurnBreakdown;
  netCalories: number; // Calories Consumed - Total Calories Burned
}

export interface GeminiAnalysisResult {
  title: string;
  mealType: MealType;
  items: Array<{
    name: string;
    portion: string;
    grams: number;
    carbs: number;
    fiber?: number;
    protein: number;
    fat: number;
    unsaturatedFat?: number;
    saturatedFat?: number;
    transFat?: number;
    cholesterol?: number; // dietary cholesterol in mg
    calories: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
  totalCarbs: number;
  totalFiber?: number;
  netCarbs?: number;
  totalProtein: number;
  totalFat: number;
  totalUnsaturatedFat?: number;
  totalSaturatedFat?: number;
  totalTransFat?: number;
  totalCholesterol?: number; // total dietary cholesterol in mg
  totalCalories: number;
  dietaryNotes?: string;
}

export interface WorkoutEstimationResult {
  title: string;
  caloriesBurned: number;
  durationMinutes?: number;
  intensity?: 'low' | 'moderate' | 'high' | 'vigorous';
  explanation?: string;
}

export interface ChronoNutritionInsight {
  firstMealTime?: string; // e.g. "14:15"
  lastMealTime?: string; // e.g. "21:45"
  eatingWindowHours?: number; // duration in hours
  timingDiagnosis: string; // deep analysis of when meals were eaten
  actionableAdjustment: string; // specific timing shift for tomorrow
}

export interface BehavioralPatternDiscovery {
  patternTitle: string; // concise title of hidden trend
  observation: string; // detailed observation
  underlyingDriver?: string; // probable behavioral cause
}

export interface CompensatoryRebalancePlan {
  status: 'on_track' | 'deficit_recovery' | 'surplus_moderation';
  headline: string; // what needs rebalancing
  dailyMicroAdjustment: string; // specific numbers/macros to adjust tomorrow
}

export interface RecommendedFood {
  foodName: string; // e.g. "Wild Atlantic Salmon"
  portionSuggestion: string; // e.g. "6 oz fillet with steamed greens"
  targetBenefit: string; // specific metabolic/biometric reason
  bestTiming: string; // e.g. "Lunch (12:30 PM)"
}

export interface DailyCoachInsight {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO string
  headline: string; // 1-2 sentence sharp behavioral diagnosis
  adherenceScore: number; // 0-100
  chronoNutrition: ChronoNutritionInsight;
  patternDiscovery: BehavioralPatternDiscovery;
  rebalancePlan: CompensatoryRebalancePlan;
  recommendedFoods: RecommendedFood[];
}

export interface WeeklyCoachInsight {
  weekKey: string; // e.g. "2026-W39"
  dateRange: string; // e.g. "Sep 22 – Sep 28, 2026"
  generatedAt: string; // ISO string
  weeklyScore: number; // 0-100
  executiveDiagnosis: string; // 2-sentence macro analysis
  metabolicTrajectory: {
    avgDailyConsumed: number;
    avgDailyBurned: number;
    weeklyNetCalories: number; // negative = deficit, positive = surplus
    projectedWeightShift: string; // e.g. "-0.7 lbs fat"
    actualWeightShift?: string; // e.g. "-0.8 lbs on scale"
  };
  macroAdherenceConsistency: string; // analysis of protein, carbs, fiber, cholesterol
  chronoPatternTrends: string; // analysis of eating windows across week
  topPatternsDetected: BehavioralPatternDiscovery[];
  weeklyRebalanceStrategy: {
    focusArea: string; // primary focus theme
    actionSteps: string[]; // concrete gameplan steps
  };
  recommendedFoods: RecommendedFood[];
}
