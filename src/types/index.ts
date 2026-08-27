export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

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
  caloriesBurned: number; // kcal burned entered by user or tracker
  carbsBurned?: number; // optional grams
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
  netCalories: number; // Calories Consumed - Calories Burned
  netCarbs?: number;
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
