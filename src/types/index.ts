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

export interface FoodItem {
  id: string;
  name: string;
  portion: string;
  grams: number;
  carbs: number;
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
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  photoUrl?: string; // base64
}

export interface DailyActivity {
  date: string; // YYYY-MM-DD
  activeCaloriesBurned: number; // exercise / workout calories entered by user
  baseBmrCalories: number; // resting BMR base calories
  totalCaloriesBurned: number; // baseBmrCalories + activeCaloriesBurned
  notes?: string;
  lastUpdated: string;
}

export interface UserGoals {
  dailyCaloriesTarget: number; // kcal
  dailyCarbsTarget: number; // g
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
  profile: UserProfile;
  goals: UserGoals;
}

export interface DailySummary {
  date: string;
  meals: MealRecord[];
  activity: DailyActivity;
  totals: {
    calories: number;
    carbs: number;
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
    protein: number;
    fat: number;
    calories: number;
    confidence: 'high' | 'medium' | 'low';
  }>;
  totalCarbs: number;
  totalProtein: number;
  totalFat: number;
  totalCalories: number;
  dietaryNotes?: string;
}
