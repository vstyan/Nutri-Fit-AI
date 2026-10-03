import { 
  DailySummary, 
  AppSettings, 
  MealRecord, 
  WeightRecord, 
  BloodLipidRecord,
  HistoryDayRecord
} from '../types';
import { getLocalDateString } from './dateUtils';
import { getEffectiveTrackingMode } from './calorieEngine';

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
    fiberConsumedSoFar: number;
    dailyFiberTarget: number;
    fiberRemainingToday: number;
    percentFiberConsumedSoFar: number;
    proteinConsumedSoFar: number;
    dailyProteinTarget: number;
    proteinRemainingToday: number;
    percentProteinConsumedSoFar: number;
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
    primaryGoals?: string[];
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
    activeBurnSource?: string;
    workoutsLogged: Array<{
      title: string;
      caloriesBurned: number;
      time?: string;
      durationMinutes?: number;
      intensity?: string;
      description?: string;
    }>;
    workoutSummary: string;
    hasSignificantWorkout: boolean;
  };
  timingMetrics: {
    mealCount: number;
    firstMealTime?: string;
    lastMealTime?: string;
    mostRecentMealTime?: string;
    eatingWindowHours?: number;
    eatingWindowStatus?: 'ongoing_open' | 'closed_day_completed';
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
    primaryGoals?: string[];
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
  historyData: HistoryDayRecord[] = [],
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

  // Recent 3 completed days protein/fiber gap calculation (exclude today if day is still in progress)
  const completedHistoryDays = isDayInProgress
    ? historyData.filter(d => d.date !== date && (d.caloriesIntake || 0) > 0).slice(-3)
    : historyData.filter(d => (d.caloriesIntake || 0) > 0).slice(-3);

  let recentProteinGap = 0;
  let recentFiberGap = 0;
  const targetFiber = settings.goals.dailyFiberTarget || 30;
  const targetProtein = settings.goals.dailyProteinTarget || 140;

  for (const d of completedHistoryDays) {
    recentFiberGap += ((d.fiberIntake || 0) - targetFiber);
    recentProteinGap += ((d.proteinIntake || 0) - targetProtein);
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

  const caloriesTarget = settings.goals.dailyCaloriesTarget || 2000;
  const caloriesRemainingToday = Math.max(0, caloriesTarget - totalCalories);
  const percentTargetConsumedSoFar = caloriesTarget > 0
    ? Math.round((totalCalories / caloriesTarget) * 100)
    : 0;

  const fiberConsumed = summary.totals.fiber || 0;
  const fiberRemainingToday = Math.max(0, Math.round((targetFiber - fiberConsumed) * 10) / 10);
  const percentFiberConsumedSoFar = targetFiber > 0
    ? Math.round((fiberConsumed / targetFiber) * 100)
    : 0;

  const proteinConsumed = summary.totals.protein || 0;
  const proteinRemainingToday = Math.max(0, Math.round((targetProtein - proteinConsumed) * 10) / 10);
  const percentProteinConsumedSoFar = targetProtein > 0
    ? Math.round((proteinConsumed / targetProtein) * 100)
    : 0;

  // Workout detection & detailed expenditure analysis
  const rawWorkouts = summary.activity.workouts || [];
  const workoutsLogged = rawWorkouts.map((w: any) => ({
    title: w.title || w.activityName || 'Workout',
    caloriesBurned: w.caloriesBurned,
    time: extractTimeFromTimestamp(w.timestamp),
    durationMinutes: w.durationMinutes,
    intensity: w.intensity,
    description: w.description
  }));

  const trackingMode = getEffectiveTrackingMode(settings);
  const isTrackerMode = trackingMode === 'tracker'
    || summary.activity.source === 'health_connect'
    || summary.activity.source === 'google_fit'
    || !!settings.healthConnectConnected
    || !!settings.googleFitConnected
    || summary.activity.sensorActiveCalories !== undefined
    || summary.activity.sensorRestingCalories !== undefined;

  const activeBurnSource = isTrackerMode
    ? (summary.activity.source === 'google_fit' || settings.googleFitConnected ? 'google_fit' : 'health_connect')
    : (summary.activity.source || 'manual');

  const baseBmr = summary.activity.baseBmrCalories || 0;
  const rawActiveField = summary.activity.activeCaloriesBurned || 0;

  // Compute the true ACTIVE calories burned today (movement, steps, and dedicated workouts - NEVER resting BMR!)
  const itemizedWorkoutBurn = workoutsLogged.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
  let trueActiveBurn = 0;

  if (isTrackerMode) {
    if (summary.activity.sensorActiveCalories !== undefined) {
      trueActiveBurn = Math.max(0, Math.round(summary.activity.sensorActiveCalories));
    } else {
      // In tracker mode without explicit sensorActiveCalories field, active movement is total tracker burn minus resting BMR
      trueActiveBurn = Math.max(0, Math.round(rawActiveField - baseBmr));
    }
    // If user logged itemized workouts on top, make sure trueActiveBurn reflects at least the workout burn
    if (itemizedWorkoutBurn > trueActiveBurn) {
      trueActiveBurn = itemizedWorkoutBurn;
    }
  } else if (settings.includeRestingCalories === false) {
    // Standalone mode where user entered full-day burn into the activeCaloriesBurned field
    trueActiveBurn = Math.max(0, Math.round(rawActiveField - baseBmr));
    if (itemizedWorkoutBurn > trueActiveBurn) {
      trueActiveBurn = itemizedWorkoutBurn;
    }
  } else {
    // Standard standalone manual mode: rawActiveField is pure workout/exercise burn
    trueActiveBurn = Math.max(itemizedWorkoutBurn, Math.round(rawActiveField));
  }

  let dedicatedWorkoutCalories = 0;
  let hasSignificantWorkout = false;
  let workoutSummary = '';

  if (workoutsLogged.length > 0) {
    dedicatedWorkoutCalories = itemizedWorkoutBurn;
    hasSignificantWorkout = true;
    const workoutParts = workoutsLogged.map(w => 
      `${w.title}${w.time ? ` at ${w.time}` : ''} (${w.caloriesBurned} kcal${w.durationMinutes ? `, ${w.durationMinutes} min` : ''})`
    );
    if (isTrackerMode) {
      workoutSummary = `Dedicated workouts logged: ${workoutParts.join('; ')} (Total workout burn: ${dedicatedWorkoutCalories} active kcal; Total daily active movement: ${trueActiveBurn} active kcal). Total day expenditure (including resting BMR): ${totalBurned} kcal.`;
    } else {
      workoutSummary = `Dedicated workouts logged: ${workoutParts.join('; ')} (Total dedicated workout burn: ${dedicatedWorkoutCalories} active kcal). Total day expenditure: ${totalBurned} kcal.`;
    }
  } else if (isTrackerMode) {
    // Fitness tracker mode without itemized workouts:
    // The active calories (e.g. 229 kcal) are from incidental steps & daily movement.
    // Resting metabolism (e.g. 841 kcal) is resting BMR. Total day burn is e.g. 1070 + TEF = 1279 kcal.
    dedicatedWorkoutCalories = 0;
    hasSignificantWorkout = false;
    workoutSummary = `Active movement recorded: ${trueActiveBurn} active kcal so far today (routine daily activity and steps from Health Connect / fitness tracker; resting metabolism: ${baseBmr} kcal). No dedicated high-intensity workout session was logged today. Total day expenditure (including resting BMR and TEF): ${totalBurned} kcal.`;
  } else if (trueActiveBurn >= 150) {
    // Manual standalone mode where user specifically typed workout calories (>= 150 kcal)
    dedicatedWorkoutCalories = trueActiveBurn;
    hasSignificantWorkout = true;
    workoutSummary = `Manual workout/exercise burn entered: ${dedicatedWorkoutCalories} active kcal today. Total day expenditure: ${totalBurned} kcal.`;
  } else {
    // Manual standalone mode with minimal or rest day activity (< 150 kcal)
    dedicatedWorkoutCalories = trueActiveBurn;
    hasSignificantWorkout = false;
    workoutSummary = `Baseline activity: ${trueActiveBurn > 0 ? `${trueActiveBurn} active kcal` : 'No heavy workouts logged today (rest/recovery day)'}. Total day expenditure: ${totalBurned} kcal.`;
  }

  const primaryGoals = settings.goals.primaryGoals || [];
  const goalsGuidance = primaryGoals.length > 0
    ? `USER'S PRIMARY GOALS: The user has selected the following top goals: [${primaryGoals.join(', ')}]. Tailor your diagnosis, nutrient timing, and food recommendations to directly advance these goals.`
    : `USER GOALS: General metabolic health, sustainable body composition, and balanced energy.`;

  let workoutGuidance = '';
  if (hasSignificantWorkout) {
    workoutGuidance = `WORKOUT & EXERCISE DETECTED: (${workoutSummary}). CRITICAL: You MUST acknowledge and celebrate this specific workout in 'workoutAnalysis.encouragement' citing ONLY the active workout burn (${dedicatedWorkoutCalories || trueActiveBurn} active kcal). NEVER cite resting BMR or total day burn as workout calories. In 'workoutAnalysis.fuelingAdvice', explain how their diet should adjust to properly recover from this workout (protein for muscle synthesis, carbs for glycogen repletion, fluid/electrolytes), keeping their primary goals (${primaryGoals.join(', ') || 'fitness & health'}) in mind.`;
  } else if (isTrackerMode) {
    workoutGuidance = `FITNESS TRACKER MONITORING (NO DEDICATED WORKOUT LOGGED): ${workoutSummary}. CRITICAL: Do NOT claim or hallucinate that the user burned ${totalBurned} kcal in a workout session! Their true active movement is ${trueActiveBurn} active kcal (from daily steps and routine movement). The remaining ${baseBmr} kcal is resting basal metabolism (energy burned at rest). When referring to physical activity, ONLY cite active movement (${trueActiveBurn} active kcal). In 'workoutAnalysis.activitySummary', state: 'Active movement: ~${trueActiveBurn} active kcal (daily activity/steps). Resting BMR: ~${baseBmr} kcal. Total day burn: ~${totalBurned} kcal.' In 'workoutAnalysis.encouragement', provide positive reinforcement for their active movement consistency (~${trueActiveBurn} active kcal) and steady pacing on a rest/recovery day. In 'workoutAnalysis.fuelingAdvice', explain baseline nutritional pacing for steady daily energy without suggesting heavy athletic refeeding.`;
  } else {
    workoutGuidance = `REST / RECOVERY DAY: Active burn is low (${trueActiveBurn} active kcal). In 'workoutAnalysis', provide positive reinforcement for rest/recovery and explain baseline fueling for rest days.`;
  }

  let fiberPacingGuidance = '';
  if (percentFiberConsumedSoFar >= 70) {
    fiberPacingGuidance = `FIBER PACING ALERT: The user has ALREADY consumed ${fiberConsumed}g of their ${targetFiber}g fiber target (~${percentFiberConsumedSoFar}% of daily goal)! This is an exceptional fiber start. You MUST NOT claim or imply the user has a 'fiber gap' or 'fiber deficiency' today. If addressing elevated LDL, praise their high total fiber intake and suggest only modest soluble-fiber sources (oats, chia, lentils) specifically for lipid clearance without calling it a deficit.`;
  } else if (isDayInProgress) {
    fiberPacingGuidance = `Fiber consumed so far: ${fiberConsumed}g of ${targetFiber}g (~${percentFiberConsumedSoFar}%). Remaining fiber to budget for today: ${fiberRemainingToday}g.`;
  }

  const guidanceForAI = isDayInProgress
    ? `DAY IN PROGRESS: Current local time is ${currentLocalTime} (${dayPhase}). The user is in the middle of their day. They have consumed ${totalCalories} of ${caloriesTarget} kcal (~${percentTargetConsumedSoFar}% of daily target). The interim net balance (${netEnergyBalance > 0 ? '+' : ''}${netEnergyBalance} kcal) reflects morning/afternoon expenditure recorded so far (${totalBurned} kcal), NOT 24-hour total burn. This is NOT a severe deficit or low intake. The user's eating window is STILL ACTIVELY OPEN: their latest meal was at ${lastMealTime || 'N/A'}, but upcoming meals (afternoon fuel, dinner, evening snacks) are still ahead. DO NOT state or imply that 'the eating window closed at ${lastMealTime || 'N/A'}'. You MUST advise on upcoming meals for TODAY to budget the remaining ${caloriesRemainingToday} kcal and remaining ${proteinRemainingToday}g protein. ${fiberPacingGuidance} ${goalsGuidance} ${workoutGuidance} 'actionableAdjustment' must give timing advice for remaining meals TODAY (not tomorrow)!`
    : `DAY COMPLETED: Full 24-hour evaluation for ${date}. Total intake: ${totalCalories} kcal, Total burned: ${totalBurned} kcal, Final net balance: ${netEnergyBalance > 0 ? '+' : ''}${netEnergyBalance} kcal. ${fiberPacingGuidance} ${goalsGuidance} ${workoutGuidance} 'actionableAdjustment' should suggest a timing tweak for tomorrow.`;

  const dayPacingContext = {
    isToday,
    isDayInProgress,
    currentLocalTime,
    dayPhase,
    caloriesConsumedSoFar: totalCalories,
    dailyCalorieTarget: caloriesTarget,
    caloriesRemainingToday,
    percentTargetConsumedSoFar,
    fiberConsumedSoFar: fiberConsumed,
    dailyFiberTarget: targetFiber,
    fiberRemainingToday,
    percentFiberConsumedSoFar,
    proteinConsumedSoFar: proteinConsumed,
    dailyProteinTarget: targetProtein,
    proteinRemainingToday,
    percentProteinConsumedSoFar,
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
      cholesterolMg: settings.goals.dailyCholesterolTarget || 300,
      primaryGoals
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
      bmrCalories: baseBmr,
      neatCalories: summary.activity.neatCalories || 0,
      activeCalories: trueActiveBurn,
      tefCalories: summary.activity.tefCalories || 0,
      totalBurned,
      netEnergyBalance,
      activeBurnSource,
      workoutsLogged,
      workoutSummary,
      hasSignificantWorkout
    },
    timingMetrics: {
      mealCount: summary.meals.length,
      firstMealTime,
      lastMealTime,
      mostRecentMealTime: lastMealTime,
      eatingWindowHours,
      eatingWindowStatus: isDayInProgress ? 'ongoing_open' : 'closed_day_completed',
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
  historyData: HistoryDayRecord[],
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
      dailyCholesterol: settings.goals.dailyCholesterolTarget || 300,
      primaryGoals: settings.goals.primaryGoals || []
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
