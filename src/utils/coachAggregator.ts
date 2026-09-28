import { 
  DailySummary, 
  AppSettings, 
  MealRecord, 
  WeightRecord, 
  BloodLipidRecord 
} from '../types';
import { getLocalDateString } from './dateUtils';

export interface DailyCoachPayload {
  date: string;
  dayOfWeek: string;
  isWeekend: boolean;
  dayPacingContext: {
    isToday: boolean;
    isDayInProgress: boolean;
    currentLocalTime: string;
    dayPhase: 'early_morning' | 'morning' | 'midday_lunch' | 'afternoon' | 'evening_dinner' | 'night_wrapup';
    caloriesConsumedSoFar: number;
    dailyCalorieTarget: number;
    caloriesRemainingToday: number;
    percentTargetConsumedSoFar: number;
    burnRecordedSoFar: number;
    interimNetBalance: number;
    guidanceForAI: string;
  };
  userProfile: {
    gender: string;
    age: number;
    weightKg: number;
    weightLbs: number;
    unitSystem: string;
  };
  targets: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fiberGrams: number;
    fatGrams: number;
    cholesterolMg: number;
  };
  todayIntake: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    netCarbsGrams: number;
    fiberGrams: number;
    fatGrams: number;
    saturatedFatGrams?: number;
    cholesterolMg?: number;
    tefCalories?: number;
  };
  todayExpenditure: {
    bmrCalories: number;
    neatCalories: number;
    activeCalories: number;
    tefCalories: number;
    totalBurned: number;
    netEnergyBalance: number; // Consumed - Burned (negative = deficit)
  };
  timingMetrics: {
    mealCount: number;
    firstMealTime?: string;
    lastMealTime?: string;
    eatingWindowHours?: number;
    caloriesAfter8PM: number;
    percentCaloriesAfter8PM: number;
    mealsChronological: Array<{
      time: string;
      timeSlot: string;
      title: string;
      calories: number;
      protein: number;
      fiber?: number;
      cholesterol?: number;
    }>;
  };
  rollingMultiDayContext: {
    avgPast7DaysCaloriesConsumed: number;
    avgPast7DaysCaloriesBurned: number;
    cumulativeDeficitPast7Days: number;
    daysLoggedPastWeek: number;
    recentProteinGap: number; // Cumulative gap from target in past 3 days (negative = deficit)
    recentFiberGap: number; // Cumulative gap from target in past 3 days (negative = deficit)
  };
  biometrics: {
    currentWeight?: number;
    weightChangeRecent?: number;
    latestLipidPanel?: {
      date: string;
      totalCholesterol: number;
      ldl: number;
      hdl: number;
      triglycerides: number;
      totalHdlRatio: number;
      isLdlElevated: boolean;
    };
  };
}

export interface WeeklyCoachPayload {
  weekKey: string;
  dateRange: string;
  userProfile: {
    gender: string;
    age: number;
    weightKg: number;
    weightLbs: number;
  };
  targets: {
    dailyCalories: number;
    dailyProtein: number;
    dailyFiber: number;
    dailyCholesterol: number;
  };
  days: Array<{
    date: string;
    dayOfWeek: string;
    isWeekend: boolean;
    caloriesConsumed: number;
    caloriesBurned: number;
    netBalance: number;
    proteinConsumed?: number;
    fiberConsumed?: number;
    firstMealTime?: string;
    lastMealTime?: string;
    eatingWindowHours?: number;
    mealCount: number;
  }>;
  weeklyAverages: {
    avgDailyConsumed: number;
    avgDailyBurned: number;
    totalWeeklyDeficitOrSurplus: number;
    weekdayAvgConsumed: number;
    weekendAvgConsumed: number;
    weekendVsWeekdayDeltaCalories: number;
  };
  biometrics: {
    weightStartOfWeek?: number;
    weightEndOfWeek?: number;
    weightChangeWeek?: number;
    latestLipidPanel?: {
      totalCholesterol: number;
      ldl: number;
      hdl: number;
      triglycerides: number;
    };
  };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Extracts "HH:MM" (24h) from an ISO timestamp string
 */
function extractTimeFromTimestamp(timestamp?: string): string | undefined {
  if (!timestamp) return undefined;
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return undefined;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return undefined;
  }
}

/**
 * Calculates hours elapsed between two "HH:MM" times
 */
function calculateHoursBetween(startTime: string, endTime: string): number {
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  const mins1 = h1 * 60 + m1;
  const mins2 = h2 * 60 + m2;
  const diffMins = mins2 >= mins1 ? mins2 - mins1 : (1440 - mins1 + mins2);
  return Math.round((diffMins / 60) * 10) / 10;
}

/**
 * Builds the comprehensive, compacted Daily Coach payload
 */
export function buildDailyCoachPayload(
  date: string,
  summary: DailySummary,
  settings: AppSettings,
  historyData: Array<{
    date: string;
    carbsIntake: number;
    fiberIntake?: number;
    netCarbsIntake?: number;
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }> = [],
  weightHistory: WeightRecord[] = [],
  lipidHistory: BloodLipidRecord[] = []
): DailyCoachPayload {
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = DAY_NAMES[dateObj.getDay()];
  const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

  const weightKg = settings.profile.weightKg || 75;
  const weightLbs = Math.round(weightKg * 2.20462);

  // Sort today's meals chronologically by timestamp
  const mealsSorted = [...summary.meals].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const chronologicalMealSummaries: Array<{
    time: string;
    timeSlot: string;
    title: string;
    calories: number;
    protein: number;
    fiber?: number;
    cholesterol?: number;
  }> = [];

  let firstMealTime: string | undefined = undefined;
  let lastMealTime: string | undefined = undefined;
  let caloriesAfter8PM = 0;

  for (const meal of mealsSorted) {
    const timeStr = extractTimeFromTimestamp(meal.timestamp) || '12:00';
    if (!firstMealTime) firstMealTime = timeStr;
    lastMealTime = timeStr;

    // Check if meal was logged at or after 20:00 (8:00 PM)
    const hour = parseInt(timeStr.split(':')[0], 10);
    if (hour >= 20) {
      caloriesAfter8PM += meal.totalCalories || 0;
    }

    let timeSlot = 'Morning';
    if (hour >= 11 && hour < 15) timeSlot = 'Midday';
    else if (hour >= 15 && hour < 18) timeSlot = 'Afternoon';
    else if (hour >= 18 && hour < 22) timeSlot = 'Evening';
    else if (hour >= 22 || hour < 4) timeSlot = 'Late Night';

    chronologicalMealSummaries.push({
      time: timeStr,
      timeSlot: `${timeSlot} (${timeStr})`,
      title: meal.title,
      calories: meal.totalCalories,
      protein: meal.totalProtein,
      fiber: meal.totalFiber,
      cholesterol: meal.totalCholesterol
    });
  }

  const eatingWindowHours = firstMealTime && lastMealTime && mealsSorted.length > 1
    ? calculateHoursBetween(firstMealTime, lastMealTime)
    : mealsSorted.length === 1
      ? 1
      : 0;

  const totalCalories = summary.totals.calories || 0;
  const percentCaloriesAfter8PM = totalCalories > 0
    ? Math.round((caloriesAfter8PM / totalCalories) * 100)
    : 0;

  // Past 7 days rolling stats
  const validLoggedDays = historyData.filter(d => (d.caloriesIntake || 0) > 0);
  const daysLoggedPastWeek = validLoggedDays.length;
  const total7DayConsumed = historyData.reduce((acc, d) => acc + (d.caloriesIntake || 0), 0);
  const total7DayBurned = historyData.reduce((acc, d) => acc + (d.caloriesBurned || 0), 0);
  const avgPast7DaysCaloriesConsumed = daysLoggedPastWeek > 0
    ? Math.round(total7DayConsumed / daysLoggedPastWeek)
    : 0;
  const avgPast7DaysCaloriesBurned = historyData.length > 0
    ? Math.round(total7DayBurned / historyData.length)
    : 0;
  const cumulativeDeficitPast7Days = total7DayBurned - total7DayConsumed;

  // Recent 3 days protein/fiber gap calculation
  const past3Days = historyData.slice(-3);
  let recentProteinGap = 0;
  let recentFiberGap = 0;
  const targetFiber = settings.goals.dailyFiberTarget || 30;

  for (const d of past3Days) {
    if ((d.caloriesIntake || 0) > 0) {
      recentFiberGap += ((d.fiberIntake || 0) - targetFiber);
    }
  }

  // Biometrics context
  const sortedWeights = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const currentWeight = sortedWeights.length > 0
    ? (settings.profile.unitSystem === 'imperial'
        ? sortedWeights[sortedWeights.length - 1].weightLbs
        : sortedWeights[sortedWeights.length - 1].weightKg)
    : undefined;
  const weightChangeRecent = sortedWeights.length > 1
    ? Math.round(((sortedWeights[sortedWeights.length - 1].weightKg - sortedWeights[0].weightKg) * (settings.profile.unitSystem === 'imperial' ? 2.20462 : 1)) * 10) / 10
    : undefined;

  const sortedLipids = [...lipidHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latestLipid = sortedLipids.length > 0 ? sortedLipids[sortedLipids.length - 1] : undefined;
  const latestLipidPanel = latestLipid ? {
    date: latestLipid.date,
    totalCholesterol: latestLipid.totalCholesterol,
    ldl: latestLipid.ldl,
    hdl: latestLipid.hdl,
    triglycerides: latestLipid.triglycerides,
    totalHdlRatio: Math.round((latestLipid.totalCholesterol / latestLipid.hdl) * 10) / 10,
    isLdlElevated: latestLipid.ldl >= 130
  } : undefined;

  const totalBurned = summary.activity.totalCaloriesBurned || 2000;
  const netEnergyBalance = totalCalories - totalBurned;

  // Real-time day pacing calculation (ensures AI Coach does not treat in-progress days as complete)
  const now = new Date();
  const todayStr = getLocalDateString(now);
  const isToday = date === todayStr;
  const currentHour = now.getHours();
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentLocalTime = `${String(currentHour).padStart(2, '0')}:${currentMinutes}`;

  const isDayInProgress = isToday && (currentHour < 21 || (currentHour === 21 && now.getMinutes() < 30));

  let dayPhase: 'early_morning' | 'morning' | 'midday_lunch' | 'afternoon' | 'evening_dinner' | 'night_wrapup' = 'night_wrapup';
  if (currentHour >= 4 && currentHour < 9) dayPhase = 'early_morning';
  else if (currentHour >= 9 && currentHour < 12) dayPhase = 'morning';
  else if (currentHour >= 12 && currentHour < 15) dayPhase = 'midday_lunch';
  else if (currentHour >= 15 && currentHour < 18) dayPhase = 'afternoon';
  else if (currentHour >= 18 && currentHour < 22) dayPhase = 'evening_dinner';
  else dayPhase = 'night_wrapup';

  const caloriesTarget = settings.goals.dailyCaloriesTarget || 2000;
  const caloriesRemainingToday = Math.max(0, caloriesTarget - totalCalories);
  const percentTargetConsumedSoFar = caloriesTarget > 0
    ? Math.round((totalCalories / caloriesTarget) * 100)
    : 0;

  const guidanceForAI = isDayInProgress
    ? `DAY IN PROGRESS: Current local time is ${currentLocalTime} (${dayPhase}). The user is in the middle of their day. They have consumed ${totalCalories} of ${caloriesTarget} kcal (~${percentTargetConsumedSoFar}% of daily target). The interim net balance (${netEnergyBalance > 0 ? '+' : ''}${netEnergyBalance} kcal) reflects morning expenditure so far (${totalBurned} kcal recorded up to now), NOT 24-hour total burn. This is NOT a severe deficit or low intake. You MUST advise on upcoming meals for TODAY (lunch, dinner, afternoon/evening snacks) to budget the remaining ${caloriesRemainingToday} kcal and remaining protein/fiber. DO NOT tell the user to eat more tomorrow to fix an incomplete today!`
    : `DAY COMPLETED: Full 24-hour evaluation for ${date}. Total intake: ${totalCalories} kcal, Total burned: ${totalBurned} kcal, Final net balance: ${netEnergyBalance > 0 ? '+' : ''}${netEnergyBalance} kcal.`;

  const dayPacingContext = {
    isToday,
    isDayInProgress,
    currentLocalTime,
    dayPhase,
    caloriesConsumedSoFar: totalCalories,
    dailyCalorieTarget: caloriesTarget,
    caloriesRemainingToday,
    percentTargetConsumedSoFar,
    burnRecordedSoFar: totalBurned,
    interimNetBalance: netEnergyBalance,
    guidanceForAI
  };

  return {
    date,
    dayOfWeek,
    isWeekend,
    dayPacingContext,
    userProfile: {
      gender: settings.profile.gender,
      age: settings.profile.age,
      weightKg,
      weightLbs,
      unitSystem: settings.profile.unitSystem
    },
    targets: {
      calories: settings.goals.dailyCaloriesTarget,
      proteinGrams: settings.goals.dailyProteinTarget,
      carbsGrams: settings.goals.dailyCarbsTarget,
      fiberGrams: settings.goals.dailyFiberTarget,
      fatGrams: settings.goals.dailyFatTarget,
      cholesterolMg: settings.goals.dailyCholesterolTarget || 300
    },
    todayIntake: {
      calories: totalCalories,
      proteinGrams: summary.totals.protein || 0,
      carbsGrams: summary.totals.carbs || 0,
      netCarbsGrams: summary.totals.netCarbs || 0,
      fiberGrams: summary.totals.fiber || 0,
      fatGrams: summary.totals.fat || 0,
      saturatedFatGrams: summary.totals.saturatedFat,
      cholesterolMg: summary.totals.cholesterol,
      tefCalories: summary.totals.tef
    },
    todayExpenditure: {
      bmrCalories: summary.activity.baseBmrCalories || 0,
      neatCalories: summary.activity.neatCalories || 0,
      activeCalories: summary.activity.activeCaloriesBurned || 0,
      tefCalories: summary.activity.tefCalories || 0,
      totalBurned,
      netEnergyBalance
    },
    timingMetrics: {
      mealCount: summary.meals.length,
      firstMealTime,
      lastMealTime,
      eatingWindowHours,
      caloriesAfter8PM,
      percentCaloriesAfter8PM,
      mealsChronological: chronologicalMealSummaries
    },
    rollingMultiDayContext: {
      avgPast7DaysCaloriesConsumed,
      avgPast7DaysCaloriesBurned,
      cumulativeDeficitPast7Days,
      daysLoggedPastWeek,
      recentProteinGap: Math.round(recentProteinGap),
      recentFiberGap: Math.round(recentFiberGap)
    },
    biometrics: {
      currentWeight,
      weightChangeRecent,
      latestLipidPanel
    }
  };
}

/**
 * Builds the comprehensive Weekly Coach payload
 */
export function buildWeeklyCoachPayload(
  weekKey: string,
  dateRange: string,
  historyData: Array<{
    date: string;
    carbsIntake: number;
    fiberIntake?: number;
    netCarbsIntake?: number;
    carbsBurned: number;
    caloriesIntake: number;
    caloriesBurned: number;
  }>,
  recentMealsByDate: Record<string, MealRecord[]>,
  settings: AppSettings,
  weightHistory: WeightRecord[] = [],
  lipidHistory: BloodLipidRecord[] = []
): WeeklyCoachPayload {
  const weightKg = settings.profile.weightKg || 75;
  const weightLbs = Math.round(weightKg * 2.20462);

  let totalConsumed = 0;
  let totalBurned = 0;
  let weekdayConsumed = 0;
  let weekdayCount = 0;
  let weekendConsumed = 0;
  let weekendCount = 0;

  const daySummaries = historyData.map(d => {
    const dt = new Date(d.date + 'T00:00:00');
    const dayOfWeek = DAY_NAMES[dt.getDay()];
    const isWeekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';

    const mealsForDay = recentMealsByDate[d.date] || [];
    const mealsSorted = [...mealsForDay].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    let firstMealTime: string | undefined = undefined;
    let lastMealTime: string | undefined = undefined;
    if (mealsSorted.length > 0) {
      firstMealTime = extractTimeFromTimestamp(mealsSorted[0].timestamp);
      lastMealTime = extractTimeFromTimestamp(mealsSorted[mealsSorted.length - 1].timestamp);
    }

    const eatingWindowHours = firstMealTime && lastMealTime && mealsSorted.length > 1
      ? calculateHoursBetween(firstMealTime, lastMealTime)
      : mealsSorted.length === 1
        ? 1
        : undefined;

    const netBalance = (d.caloriesIntake || 0) - (d.caloriesBurned || 0);

    totalConsumed += (d.caloriesIntake || 0);
    totalBurned += (d.caloriesBurned || 0);

    if ((d.caloriesIntake || 0) > 0) {
      if (isWeekend) {
        weekendConsumed += d.caloriesIntake;
        weekendCount += 1;
      } else {
        weekdayConsumed += d.caloriesIntake;
        weekdayCount += 1;
      }
    }

    const proteinConsumed = mealsForDay.reduce((acc, m) => acc + (m.totalProtein || 0), 0);
    const fiberConsumed = mealsForDay.reduce((acc, m) => acc + (m.totalFiber || 0), 0);

    return {
      date: d.date,
      dayOfWeek,
      isWeekend,
      caloriesConsumed: d.caloriesIntake || 0,
      caloriesBurned: d.caloriesBurned || 0,
      netBalance,
      proteinConsumed: proteinConsumed > 0 ? Math.round(proteinConsumed) : undefined,
      fiberConsumed: fiberConsumed > 0 ? Math.round(fiberConsumed) : undefined,
      firstMealTime,
      lastMealTime,
      eatingWindowHours,
      mealCount: mealsForDay.length
    };
  });

  const avgDailyConsumed = historyData.length > 0 ? Math.round(totalConsumed / historyData.length) : 0;
  const avgDailyBurned = historyData.length > 0 ? Math.round(totalBurned / historyData.length) : 0;
  const weekdayAvgConsumed = weekdayCount > 0 ? Math.round(weekdayConsumed / weekdayCount) : 0;
  const weekendAvgConsumed = weekendCount > 0 ? Math.round(weekendConsumed / weekendCount) : 0;
  const weekendVsWeekdayDeltaCalories = weekendAvgConsumed > 0 && weekdayAvgConsumed > 0
    ? weekendAvgConsumed - weekdayAvgConsumed
    : 0;

  // Weight trajectory
  const sortedWeights = [...weightHistory].sort((a, b) => a.date.localeCompare(b.date));
  const weightStart = sortedWeights.length > 0 ? sortedWeights[0].weightLbs : undefined;
  const weightEnd = sortedWeights.length > 0 ? sortedWeights[sortedWeights.length - 1].weightLbs : undefined;
  const weightChangeWeek = (weightStart !== undefined && weightEnd !== undefined)
    ? Math.round((weightEnd - weightStart) * 10) / 10
    : undefined;

  const sortedLipids = [...lipidHistory].sort((a, b) => a.date.localeCompare(b.date));
  const latestLipid = sortedLipids.length > 0 ? sortedLipids[sortedLipids.length - 1] : undefined;

  return {
    weekKey,
    dateRange,
    userProfile: {
      gender: settings.profile.gender,
      age: settings.profile.age,
      weightKg,
      weightLbs
    },
    targets: {
      dailyCalories: settings.goals.dailyCaloriesTarget,
      dailyProtein: settings.goals.dailyProteinTarget,
      dailyFiber: settings.goals.dailyFiberTarget,
      dailyCholesterol: settings.goals.dailyCholesterolTarget || 300
    },
    days: daySummaries,
    weeklyAverages: {
      avgDailyConsumed,
      avgDailyBurned,
      totalWeeklyDeficitOrSurplus: totalConsumed - totalBurned,
      weekdayAvgConsumed,
      weekendAvgConsumed,
      weekendVsWeekdayDeltaCalories
    },
    biometrics: {
      weightStartOfWeek: weightStart,
      weightEndOfWeek: weightEnd,
      weightChangeWeek,
      latestLipidPanel: latestLipid ? {
        totalCholesterol: latestLipid.totalCholesterol,
        ldl: latestLipid.ldl,
        hdl: latestLipid.hdl,
        triglycerides: latestLipid.triglycerides
      } : undefined
    }
  };
}
