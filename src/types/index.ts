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

export interface FoodItem {
  id: string;
  name: string;
  portion: string;
  grams: number;
  carbs: number;
  fiber: number; // dietary fiber in grams
  protein: number;
  fat: number;
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
  activeCaloriesBurned: number; // exercise / workout calories entered by user
  baseBmrCalories: number; // resting BMR base calories
  totalCaloriesBurned: number; // baseBmrCalories + activeCaloriesBurned
  workouts?: WorkoutEntry[];
  notes?: string;
  source?: 'manual' | 'google_fit';
  lastSyncedAt?: string;
  lastUpdated: string;
}

export interface UserGoals {
  dailyCaloriesTarget: number; // kcal
  dailyCarbsTarget: number; // g
  dailyFiberTarget: number; // g
  dailyProteinTarget: number; // g
  dailyFatTarget: number; // g
}

export type StorageLocation = 'google_drive' | 'local_indexeddb';

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
  };
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
    calories: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
  totalCarbs: number;
  totalFiber?: number;
  netCarbs?: number;
  totalProtein: number;
  totalFat: number;
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
