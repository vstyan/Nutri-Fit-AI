import { 
  GeminiAnalysisResult, 
  UserProfile, 
  WorkoutEstimationResult,
  DailyCoachInsight,
  WeeklyCoachInsight 
} from '../types';
import { DailyCoachPayload, WeeklyCoachPayload } from '../utils/coachAggregator';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.0-flash',
];

const WORKOUT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Concise summary title of the workout, e.g. 30 Min Moderate Jog' },
    caloriesBurned: { type: 'NUMBER', description: 'Estimated active calories burned during this specific workout in kcal' },
    durationMinutes: { type: 'NUMBER', description: 'Estimated or stated duration in minutes' },
    intensity: { type: 'STRING', enum: ['low', 'moderate', 'high', 'vigorous'], description: 'Workout intensity level' },
    explanation: { type: 'STRING', description: 'Brief 1-2 sentence explanation citing MET value or exertion rationale for the user weight/height/age' }
  },
  required: ['title', 'caloriesBurned']
};

const NUTRITION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Concise, appetizing name of the meal' },
    mealType: {
      type: 'STRING',
      enum: ['breakfast', 'lunch', 'dinner', 'snack']
    },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Name of the ingredient/component' },
          portion: { type: 'STRING', description: 'Estimated portion description e.g. 1 bowl, 200g' },
          grams: { type: 'NUMBER', description: 'Estimated weight in grams' },
          carbs: { type: 'NUMBER', description: 'Total Carbohydrates in grams' },
          fiber: { type: 'NUMBER', description: 'Dietary fiber in grams' },
          protein: { type: 'NUMBER', description: 'Protein in grams' },
          fat: { type: 'NUMBER', description: 'Total fat in grams' },
          unsaturatedFat: { type: 'NUMBER', description: 'Estimated healthy unsaturated fats (monounsaturated + polyunsaturated) in grams' },
          saturatedFat: { type: 'NUMBER', description: 'Estimated saturated fats in grams' },
          transFat: { type: 'NUMBER', description: 'Estimated trans fats in grams' },
          cholesterol: { type: 'NUMBER', description: 'Estimated dietary cholesterol in milligrams (mg). Plant foods are strictly 0mg. Animal products (meat, poultry, seafood, eggs, dairy, butter) contain cholesterol.' },
          calories: { type: 'NUMBER', description: 'Calories in kcal' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
        },
        required: [
          'name',
          'portion',
          'grams',
          'carbs',
          'fiber',
          'protein',
          'fat',
          'unsaturatedFat',
          'saturatedFat',
          'cholesterol',
          'calories'
        ]
      }
    },
    totalCarbs: { type: 'NUMBER', description: 'Sum of total carbohydrates in grams' },
    totalFiber: { type: 'NUMBER', description: 'Sum of dietary fiber in grams' },
    totalProtein: { type: 'NUMBER', description: 'Sum of protein in grams' },
    totalFat: { type: 'NUMBER', description: 'Sum of total fat in grams' },
    totalUnsaturatedFat: { type: 'NUMBER', description: 'Sum of heart-healthy unsaturated fats in grams' },
    totalSaturatedFat: { type: 'NUMBER', description: 'Sum of saturated fats in grams' },
    totalTransFat: { type: 'NUMBER', description: 'Sum of trans fats in grams' },
    totalCholesterol: { type: 'NUMBER', description: 'Sum of dietary cholesterol in milligrams (mg)' },
    totalCalories: { type: 'NUMBER', description: 'Total calories in kcal' },
    dietaryNotes: { type: 'STRING', description: 'Brief health or nutrition note' }
  },
  required: [
    'title',
    'mealType',
    'items',
    'totalCarbs',
    'totalFiber',
    'totalProtein',
    'totalFat',
    'totalUnsaturatedFat',
    'totalSaturatedFat',
    'totalCholesterol',
    'totalCalories'
  ]
};

function formatNutritionResult(result: any): GeminiAnalysisResult {
  const items = Array.isArray(result.items)
    ? result.items.map((item: any) => {
        const carbs = Math.round((Number(item.carbs) || 0) * 10) / 10;
        const fiber = Math.round((Number(item.fiber) || 0) * 10) / 10;
        const protein = Math.round((Number(item.protein) || 0) * 10) / 10;
        const fat = Math.round((Number(item.fat) || 0) * 10) / 10;
        let saturatedFat = item.saturatedFat !== undefined ? Math.round((Number(item.saturatedFat) || 0) * 10) / 10 : undefined;
        let unsaturatedFat = item.unsaturatedFat !== undefined ? Math.round((Number(item.unsaturatedFat) || 0) * 10) / 10 : undefined;
        const transFat = item.transFat !== undefined ? Math.round((Number(item.transFat) || 0) * 10) / 10 : 0;
        const cholesterol = item.cholesterol !== undefined ? Math.round(Number(item.cholesterol) || 0) : 0;

        // Fallback calculation if model returned total fat but omitted sub-classification
        if (fat > 0 && saturatedFat === undefined && unsaturatedFat === undefined) {
          unsaturatedFat = Math.round(fat * 0.7 * 10) / 10;
          saturatedFat = Math.max(0, Math.round((fat - unsaturatedFat) * 10) / 10);
        } else if (fat > 0 && saturatedFat !== undefined && unsaturatedFat === undefined) {
          unsaturatedFat = Math.max(0, Math.round((fat - saturatedFat) * 10) / 10);
        } else if (fat > 0 && unsaturatedFat !== undefined && saturatedFat === undefined) {
          saturatedFat = Math.max(0, Math.round((fat - unsaturatedFat) * 10) / 10);
        }

        // Atwater energy calculation fallback if item calories missing or zero
        let calories = Math.round(Number(item.calories) || 0);
        if (calories <= 0 && (carbs > 0 || protein > 0 || fat > 0)) {
          calories = Math.round((carbs * 4) + (protein * 4) + (fat * 9));
        }

        return {
          name: item.name || 'Ingredient',
          portion: item.portion || `${item.grams || 100}g`,
          grams: Number(item.grams) || 100,
          carbs,
          fiber,
          protein,
          fat,
          unsaturatedFat: unsaturatedFat ?? 0,
          saturatedFat: saturatedFat ?? 0,
          transFat,
          cholesterol,
          calories,
          confidence: item.confidence || 'high'
        };
      })
    : [];

  const sumCarbs = items.reduce((s: number, it: any) => s + it.carbs, 0);
  const sumFiber = items.reduce((s: number, it: any) => s + it.fiber, 0);
  const sumProtein = items.reduce((s: number, it: any) => s + it.protein, 0);
  const sumFat = items.reduce((s: number, it: any) => s + it.fat, 0);
  const sumUnsaturatedFat = items.reduce((s: number, it: any) => s + (it.unsaturatedFat || 0), 0);
  const sumSaturatedFat = items.reduce((s: number, it: any) => s + (it.saturatedFat || 0), 0);
  const sumTransFat = items.reduce((s: number, it: any) => s + (it.transFat || 0), 0);
  const sumCholesterol = items.reduce((s: number, it: any) => s + (it.cholesterol || 0), 0);
  const sumCalories = items.reduce((s: number, it: any) => s + it.calories, 0);

  const totalCarbs = Math.round((result.totalCarbs !== undefined ? Number(result.totalCarbs) : sumCarbs) * 10) / 10;
  const totalFiber = Math.round((result.totalFiber !== undefined ? Number(result.totalFiber) : sumFiber) * 10) / 10;
  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const totalProtein = Math.round((result.totalProtein !== undefined ? Number(result.totalProtein) : sumProtein) * 10) / 10;
  const totalFat = Math.round((result.totalFat !== undefined ? Number(result.totalFat) : sumFat) * 10) / 10;

  const totalUnsaturatedFat = result.totalUnsaturatedFat !== undefined
    ? Math.round((Number(result.totalUnsaturatedFat) || 0) * 10) / 10
    : Math.round(sumUnsaturatedFat * 10) / 10;

  const totalSaturatedFat = result.totalSaturatedFat !== undefined
    ? Math.round((Number(result.totalSaturatedFat) || 0) * 10) / 10
    : Math.round(sumSaturatedFat * 10) / 10;

  const totalTransFat = result.totalTransFat !== undefined
    ? Math.round((Number(result.totalTransFat) || 0) * 10) / 10
    : Math.round(sumTransFat * 10) / 10;

  const totalCholesterol = result.totalCholesterol !== undefined
    ? Math.round(Number(result.totalCholesterol) || 0)
    : Math.round(sumCholesterol);

  let totalCalories = Math.round(result.totalCalories !== undefined ? Number(result.totalCalories) : sumCalories);
  if (totalCalories <= 0 && sumCalories > 0) {
    totalCalories = Math.round(sumCalories);
  }

  return {
    ...result,
    items,
    totalCarbs,
    totalFiber,
    netCarbs,
    totalProtein,
    totalFat,
    totalUnsaturatedFat,
    totalSaturatedFat,
    totalTransFat,
    totalCholesterol,
    totalCalories
  };
}

export async function analyzeFoodImage(
  imageBase64DataUrl: string,
  apiKey: string,
  userNotes?: string
): Promise<GeminiAnalysisResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please add it in Settings.');
  }

  const match = imageBase64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid image format. Expected base64 data URL.');
  }
  const mimeType = match[1];
  const base64Data = match[2];

  const systemInstruction = `You are a clinical dietitian, nutritional scientist, and expert visual food analyst.
Analyze the provided food photograph with high precision:

1. COMPONENT IDENTIFICATION:
   - Identify all distinct dishes, ingredients, sides, sauces, dressings, garnishes, and beverages visible.
   - Deconstruct complex composite items into realistic constituent components (e.g. burger = bun, patty, cheese, condiments).
   - If food is sautéed, stir-fried, or dressed, explicitly account for absorbed cooking fats/oils (typically 5-15g per serving).

2. SPATIAL & PORTION ESTIMATION:
   - Estimate realistic portion sizes and weights in grams using standard visual benchmarks:
     * Standard dinner plate diameter is ~26 cm (10 in); standard soup/cereal bowl is ~350-500 ml.
     * Hand references: fist ≈ 1 cup (~150-200g grains/vegetables); palm (no fingers) ≈ 85-115g (3-4 oz) cooked meat/fish; cupped hand ≈ 30g nuts/seeds; thumb tip ≈ 5g butter/oil.

3. MACRONUTRIENT & MICRONUTRIENT PRECISION:
   - Ground all estimates in USDA FoodData Central nutritional densities.
   - For every item, provide:
     * Carbohydrates (g), Dietary Fiber (g), Protein (g), Total Fat (g)
     * Healthy Unsaturated Fat (monounsaturated + polyunsaturated in g)
     * Saturated Fat (g)
     * Dietary Cholesterol (mg): Pure plant foods (grains, legumes, veggies, fruits, nuts, vegetable oils) MUST be 0 mg. Animal products (meat, poultry, seafood, eggs, dairy, butter) MUST have accurate cholesterol in mg based on portion weight (e.g. ~186mg per large egg, ~85mg per 100g poultry/meat, ~30mg per tbsp butter).
     * Calories (kcal): Adhere to the Atwater general factor formula: Calories ≈ (4 × Carbs) + (4 × Protein) + (9 × Fat). Total item calories must align with this balance.

4. ARITHMETIC INTEGRITY:
   - The root summary totals (totalCarbs, totalFiber, totalProtein, totalFat, totalUnsaturatedFat, totalSaturatedFat, totalCholesterol, totalCalories) must exactly equal the arithmetic sum of the itemized components.

5. MEAL TYPE:
   - Select the most appropriate meal type (breakfast, lunch, dinner, snack).

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          ...(userNotes ? [{ text: `User meal preparation context / notes: "${userNotes}"` }] : [])
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: NUTRITION_RESPONSE_SCHEMA
    }
  };

  const result = await callGeminiWithFallbacks(requestBody, apiKey);
  return formatNutritionResult(result);
}

export async function analyzeFoodText(
  textDescription: string,
  apiKey: string
): Promise<GeminiAnalysisResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please add it in Settings.');
  }

  const systemInstruction = `You are a clinical dietitian, nutritional scientist, and expert dietary calculator.
The user describes a meal they ate (typed or transcribed from voice).

1. COMPONENT IDENTIFICATION:
   - Parse all mentioned ingredients, quantities, preparation styles, and brand names.
   - Deconstruct complex composite items into realistic constituent components.
   - If food is sautéed, stir-fried, or dressed, explicitly account for absorbed cooking fats/oils (typically 5-15g per serving).

2. PORTION ESTIMATION:
   - Convert colloquial or volumetric measures (cups, tablespoons, pieces, slices, bowls) into realistic gram weights.
   - If portion sizes are unspecified, assume standard standard adult serving sizes (e.g. 1 medium apple ~180g, 1 slice bread ~35g, 1 cup cooked rice ~160g, 1 chicken breast ~150g).

3. MACRONUTRIENT & MICRONUTRIENT PRECISION:
   - Ground all estimates in USDA FoodData Central nutritional densities.
   - For every item, provide:
     * Carbohydrates (g), Dietary Fiber (g), Protein (g), Total Fat (g)
     * Healthy Unsaturated Fat (monounsaturated + polyunsaturated in g)
     * Saturated Fat (g)
     * Dietary Cholesterol (mg): Pure plant foods (grains, legumes, veggies, fruits, nuts, vegetable oils) MUST be 0 mg. Animal products (meat, poultry, seafood, eggs, dairy, butter) MUST have accurate cholesterol in mg based on portion weight (e.g. ~186mg per large egg, ~85mg per 100g poultry/meat, ~30mg per tbsp butter).
     * Calories (kcal): Adhere to the Atwater general factor formula: Calories ≈ (4 × Carbs) + (4 × Protein) + (9 × Fat). Total item calories must align with this balance.

4. ARITHMETIC INTEGRITY:
   - The root summary totals (totalCarbs, totalFiber, totalProtein, totalFat, totalUnsaturatedFat, totalSaturatedFat, totalCholesterol, totalCalories) must exactly equal the arithmetic sum of the itemized components.

5. MEAL TYPE:
   - Select the most appropriate meal type (breakfast, lunch, dinner, snack).

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `User Meal Description: "${textDescription.trim()}"` }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: NUTRITION_RESPONSE_SCHEMA
    }
  };

  const result = await callGeminiWithFallbacks<GeminiAnalysisResult>(requestBody, apiKey);
  return formatNutritionResult(result);
}

export async function estimateWorkoutCalories(
  description: string,
  profile: UserProfile,
  apiKey: string
): Promise<WorkoutEstimationResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please add it in Settings.');
  }

  const { age, gender, weightKg, heightCm } = profile;
  const weightLbs = Math.round(weightKg * 2.20462);

  const systemInstruction = `You are a certified exercise physiologist and sports science expert.
The user describes a workout or physical activity they performed (spoken via voice or typed):
"${description}"

User Biometrics for accurate metabolic calculation:
- Gender: ${gender || 'unspecified'}
- Age: ${age || 30} years old
- Weight: ${weightKg || 70} kg (~${weightLbs} lbs)
- Height: ${heightCm || 175} cm

Tasks:
1. Identify the exercise activity, estimated duration in minutes, and intensity level (low, moderate, high, vigorous).
2. Calculate the ACTIVE calories burned specifically for this workout session using standard Metabolic Equivalent of Task (MET) principles:
   Active Calories Burned = MET × Weight (kg) × (Duration in minutes / 60).
   Adjust realistically based on user's weight, height, age, and biological sex.
3. If the user did not explicitly state the duration, estimate a reasonable session length from the context (e.g., standard gym workout ~45 mins, typical run ~30 mins, casual walk ~25 mins) and state this in the explanation.
4. Calculate strictly the active calories burned during this session (do NOT include baseline resting BMR, as resting calories are handled separately in the app).
5. Provide a clear, concise workout title (e.g., "30-Min Brisk Walk", "45-Min Upper Body Strength", "25-Min HIIT Cycling").
6. Provide a 1-sentence analytical explanation of the calculation (including estimated duration/MET).

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `User Workout Description: "${description.trim()}"` }]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: WORKOUT_RESPONSE_SCHEMA
    }
  };

  const result = await callGeminiWithFallbacks<WorkoutEstimationResult>(requestBody, apiKey);
  return {
    title: result.title || 'Workout Session',
    caloriesBurned: Math.max(1, Math.round(Number(result.caloriesBurned) || 0)),
    durationMinutes: result.durationMinutes ? Math.round(Number(result.durationMinutes)) : undefined,
    intensity: result.intensity,
    explanation: result.explanation || ''
  };
}

function getThinkingConfig(model: string) {
  // Gemini 2.5 series: setting thinkingBudget to 0 explicitly disables thinking for lowest latency
  if (model.includes('2.5')) {
    return { thinkingBudget: 0 };
  }
  // Gemini 3.x series: 'minimal' is the lowest latency setting (near zero thinking tokens)
  if (model.includes('3.') || model.includes('3-')) {
    return { thinkingLevel: 'minimal' };
  }
  // Older models (e.g. Gemini 2.0 / legacy): do not support thinkingConfig
  return undefined;
}

async function callGeminiWithFallbacks<T = any>(requestBody: any, apiKey: string): Promise<T> {
  let lastError: Error | null = null;
  const errorSummaries: string[] = [];

  for (const model of FALLBACK_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 14000);
      const startTime = performance.now();

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const thinkingConfig = getThinkingConfig(model);
        const payload = {
          ...requestBody,
          generationConfig: {
            ...requestBody.generationConfig,
            ...(thinkingConfig ? { thinkingConfig } : {})
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            let cleanText = text.trim();
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }
            const parsed: T = JSON.parse(cleanText);
            const durationMs = Math.round(performance.now() - startTime);
            console.log(`[Gemini] Model ${model} responded successfully in ${durationMs}ms`);
            return parsed;
          }
        } else {
          const errorText = await response.text();

          let cleanErrMsg = errorText;
          try {
            const parsedJson = JSON.parse(errorText);
            if (parsedJson?.error?.message) {
              cleanErrMsg = parsedJson.error.message;
            }
          } catch {
            // keep errorText
          }

          // If transient error (503 Service Unavailable or 429 Rate Limit) and first attempt, back off and retry
          if ((response.status === 503 || response.status === 429) && attempt === 1) {
            console.warn(`[${model}] transient ${response.status}, retrying in 1.2s...`);
            await new Promise(resolve => setTimeout(resolve, 1200));
            continue;
          }

          // If 400 Bad Request and schema was supplied, try fallback without responseSchema or thinkingConfig
          if (response.status === 400 && requestBody.generationConfig?.responseSchema) {
            const simplifiedBody = {
              ...requestBody,
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json'
              }
            };
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 12000);
            try {
              const retryRes = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(simplifiedBody),
                signal: retryController.signal
              });
              clearTimeout(retryTimeoutId);
              if (retryRes.ok) {
                const data = await retryRes.json();
                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  let cleanText = text.trim();
                  if (cleanText.startsWith('```')) {
                    cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                  }
                  const parsed: T = JSON.parse(cleanText);
                  const durationMs = Math.round(performance.now() - startTime);
                  console.log(`[Gemini] Model ${model} (fallback retry) responded successfully in ${durationMs}ms`);
                  return parsed;
                }
              }
            } catch (retryErr) {
              clearTimeout(retryTimeoutId);
            }
          }

          throw new Error(`[${model}] ${response.status}: ${cleanErrMsg}`);
        }
      } catch (err: any) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError';
        const msg = isAbort ? `[${model}] Request timed out after 14s` : (err.message || String(err));
        console.warn(`Attempt with ${model} failed:`, msg);
        lastError = isAbort ? new Error(msg) : err;
        errorSummaries.push(msg);
        break; // Advance to next model on non-transient error or timeout
      }
    }
  }

  throw lastError || new Error(`Failed to process request with Gemini models. (${errorSummaries.join('; ')})`);
}

const DAILY_COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: {
      type: 'STRING',
      description: '1-2 sentence sharp behavioral & metabolic diagnosis written in plain, direct English. State what happened and the exact single action to take. Absolutely NO jargon like "mindful closure" or "carbohydrate concentration".'
    },
    adherenceScore: {
      type: 'NUMBER',
      description: 'Adherence score from 0 to 100 assessing how well nutritional timing and targets matched the user goal.'
    },
    chronoNutrition: {
      type: 'OBJECT',
      properties: {
        firstMealTime: { type: 'STRING', description: 'Detected time of first meal or note on fasting start' },
        lastMealTime: { type: 'STRING', description: 'Detected time of most recent meal logged' },
        eatingWindowHours: { type: 'NUMBER', description: 'Duration of eating window in hours' },
        timingDiagnosis: {
          type: 'STRING',
          description: 'Deep analysis of meal pacing and spacing in plain English. If day is in progress (isDayInProgress is true), note that the eating window is still ongoing/open and evaluate pacing up to now—DO NOT say the eating window has closed. If day is completed, evaluate full window.'
        },
        actionableAdjustment: {
          type: 'STRING',
          description: 'Concrete, plain-English action to take right now (e.g. "Close the kitchen for tonight; skip the remaining 100 kcal" or "Have a 30g protein snack by 3:00 PM"). Avoid vague or flowery phrases.'
        }
      },
      required: ['timingDiagnosis', 'actionableAdjustment']
    },
    patternDiscovery: {
      type: 'OBJECT',
      properties: {
        patternTitle: { type: 'STRING', description: 'Concise title of hidden trend detected' },
        observation: {
          type: 'STRING',
          description: 'Non-obvious trend or day-of-week pattern in plain English that a human would miss looking at raw numbers.'
        },
        underlyingDriver: { type: 'STRING', description: 'Probable behavioral cause' }
      },
      required: ['patternTitle', 'observation']
    },
    rebalancePlan: {
      type: 'OBJECT',
      properties: {
        status: { type: 'STRING', enum: ['on_track', 'deficit_recovery', 'surplus_moderation'] },
        headline: { type: 'STRING', description: 'What needs rebalancing over the next 24-48 hours' },
        dailyMicroAdjustment: {
          type: 'STRING',
          description: 'Specific, direct action advice in plain English. If day is in progress, state exactly what to eat or do for upcoming meals today. If day is completed, specify adjustments for tomorrow.'
        }
      },
      required: ['status', 'headline', 'dailyMicroAdjustment']
    },
    recommendedFoods: {
      type: 'ARRAY',
      description: '2 to 3 specific whole-food recommendations addressing the exact nutritional gaps or biometric context.',
      items: {
        type: 'OBJECT',
        properties: {
          foodName: { type: 'STRING', description: 'Exact whole food name, e.g. Wild Atlantic Salmon or Steel-Cut Oats with Chia Seeds' },
          portionSuggestion: { type: 'STRING', description: 'Realistic portion suggestion, e.g. 6 oz fillet with steamed broccoli' },
          targetBenefit: { type: 'STRING', description: 'Specific metabolic reason why this food fixes today/tomorrow gap' },
          bestTiming: { type: 'STRING', description: 'Recommended meal or time slot, e.g. Lunch (12:30 PM) or Post-Workout' }
        },
        required: ['foodName', 'portionSuggestion', 'targetBenefit', 'bestTiming']
      }
    }
  },
  required: ['headline', 'adherenceScore', 'chronoNutrition', 'patternDiscovery', 'rebalancePlan', 'recommendedFoods']
};

const WEEKLY_COACH_SCHEMA = {
  type: 'OBJECT',
  properties: {
    weeklyScore: { type: 'NUMBER', description: 'Weekly adherence score 0-100' },
    executiveDiagnosis: {
      type: 'STRING',
      description: '2-sentence macro analysis explaining the week’s metabolic trajectory and behavioral rhythm.'
    },
    metabolicTrajectory: {
      type: 'OBJECT',
      properties: {
        avgDailyConsumed: { type: 'NUMBER', description: 'Average daily calories consumed' },
        avgDailyBurned: { type: 'NUMBER', description: 'Average daily calories burned' },
        weeklyNetCalories: { type: 'NUMBER', description: 'Total weekly net energy balance (negative is deficit)' },
        projectedWeightShift: { type: 'STRING', description: 'Estimated theoretical fat loss/gain (e.g. -0.7 lbs fat)' },
        actualWeightShift: { type: 'STRING', description: 'Actual scale weight change over the 7 days if logged' }
      },
      required: ['avgDailyConsumed', 'avgDailyBurned', 'weeklyNetCalories', 'projectedWeightShift']
    },
    macroAdherenceConsistency: {
      type: 'STRING',
      description: 'Analysis of how consistently protein, carbs, fiber, and cholesterol targets were met across days.'
    },
    chronoPatternTrends: {
      type: 'STRING',
      description: 'Analysis of eating windows across the week (e.g. weekday consistency vs weekend drift, late dinners).'
    },
    topPatternsDetected: {
      type: 'ARRAY',
      description: '2 key hidden patterns observed across the 7-day period',
      items: {
        type: 'OBJECT',
        properties: {
          patternTitle: { type: 'STRING', description: 'Title of pattern' },
          observation: { type: 'STRING', description: 'Detailed trend observation' },
          underlyingDriver: { type: 'STRING', description: 'Root behavioral driver' }
        },
        required: ['patternTitle', 'observation']
      }
    },
    weeklyRebalanceStrategy: {
      type: 'OBJECT',
      properties: {
        focusArea: { type: 'STRING', description: 'Primary focal theme for next week' },
        actionSteps: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: '2 to 3 concrete strategic action steps for the upcoming week'
        }
      },
      required: ['focusArea', 'actionSteps']
    },
    recommendedFoods: {
      type: 'ARRAY',
      description: '2 to 3 whole food staples to prioritize next week to cure the observed nutritional deficiencies',
      items: {
        type: 'OBJECT',
        properties: {
          foodName: { type: 'STRING', description: 'Food name' },
          portionSuggestion: { type: 'STRING', description: 'Portion / meal idea' },
          targetBenefit: { type: 'STRING', description: 'Why this supports next week strategy' },
          bestTiming: { type: 'STRING', description: 'Strategic timing' }
        },
        required: ['foodName', 'portionSuggestion', 'targetBenefit', 'bestTiming']
      }
    }
  },
  required: ['weeklyScore', 'executiveDiagnosis', 'metabolicTrajectory', 'macroAdherenceConsistency', 'chronoPatternTrends', 'topPatternsDetected', 'weeklyRebalanceStrategy', 'recommendedFoods']
};

/**
 * Generates in-depth Daily AI Coach Insights focusing on chrono-nutrition,
 * hidden behavioral patterns, compensatory rebalancing, and whole-food recommendations.
 */
export async function generateDailyCoachInsight(
  payload: DailyCoachPayload,
  apiKey: string
): Promise<DailyCoachInsight> {
  const systemInstruction = `You are NutriFit AI Coach, an elite sports dietitian, chrono-nutrition specialist, and behavioral scientist.
Analyze the user's daily telemetry data provided in JSON format.

CRITICAL COACHING INSTRUCTIONS:
1. REAL-TIME DAY PACING (CRITICAL):
   - Check 'dayPacingContext':
   - If 'isDayInProgress' is true (e.g. current local time is ${payload.dayPacingContext.currentLocalTime}, phase: ${payload.dayPacingContext.dayPhase}):
     * The user is ACTIVELY in the middle of their day! Lunch, afternoon fuel, and dinner are still ahead.
     * Consuming ${payload.dayPacingContext.caloriesConsumedSoFar} kcal of ${payload.dayPacingContext.dailyCalorieTarget} kcal target (~${payload.dayPacingContext.percentTargetConsumedSoFar}%) is normal daytime pacing—this is NOT a "severe calorie deficit" or "very low intake".
     * The interim net balance (${payload.dayPacingContext.interimNetBalance > 0 ? '+' : ''}${payload.dayPacingContext.interimNetBalance} kcal) compares intake so far against morning burn so far (${payload.dayPacingContext.burnRecordedSoFar} kcal), NOT a final 24-hour balance.
     * Your advice MUST focus on the REMAINING MEALS FOR TODAY (how to allocate the remaining ${payload.dayPacingContext.caloriesRemainingToday} kcal and ${payload.dayPacingContext.proteinRemainingToday}g protein across lunch and dinner today).
     * NEVER tell the user to "eat more tomorrow" to fix an unfinished today! Advise them on what to eat for lunch right now and dinner tonight.
   - If 'isDayInProgress' is false:
     * Provide a full 24-hour retrospective and suggest micro-adjustments for tomorrow.

2. FIBER & MACRONUTRIENT PACING (CRITICAL ANTI-HALLUCINATION GUARDRAIL):
   - Inspect 'dayPacingContext.percentFiberConsumedSoFar', 'dayPacingContext.fiberConsumedSoFar', and 'dayPacingContext.fiberRemainingToday'.
   - If 'percentFiberConsumedSoFar' is >= 70%:
     * The user has ALREADY consumed nearly all or exceeded their daily fiber goal (e.g. ${payload.dayPacingContext.fiberConsumedSoFar}g of ${payload.dayPacingContext.dailyFiberTarget}g)!
     * You MUST NOT claim or diagnose that the user has a "fiber gap", "fiber deficit", or "low fiber intake" today.
     * Acknowledge their outstanding fiber intake.
     * If the user has elevated LDL ('isLdlElevated' is true), DO NOT call it a "fiber gap". Explicitly acknowledge that their overall fiber intake is already high, and simply advise emphasizing cardio-protective SOLUBLE/viscous fiber sources (e.g. beta-glucan from oats, chia seeds, lentils) for LDL particle clearance.
   - Inspect 'dayPacingContext.proteinRemainingToday' to realistically pace upcoming afternoon and evening protein portions.
   - NEVER confuse multi-day historical deficit calculations in 'rollingMultiDayContext' with today's immediate progress when today is already well on track!

3. RELY ON TIMESTAMPS, NOT MEAL LABELS:
   - Examine actual 24h meal timestamps (e.g., 08:15, 10:05, 13:20). Do NOT deduce behavior from meal labels like 'breakfast' or 'dinner'—users frequently eat multiple morning fuelings or log items under default tags. Evaluate the spacing and nutritional composition of meals chronologically.

4. DO NOT merely restate dashboard numbers (e.g. avoid "You ate 1800 kcal and burned 2200 kcal"). The user already sees those raw totals. Instead, diagnose cause-and-effect relationships and non-obvious patterns.

5. CHRONO-NUTRITION & MEAL TIMING:
   - Examine firstMealTime, lastMealTime (the most recent meal logged), eatingWindowHours, and caloriesAfter8PM.
   - If day is in progress (isDayInProgress is true):
     * The eating window is STILL OPEN! lastMealTime (${payload.timingMetrics.lastMealTime}) is merely the most recent meal logged so far today, NOT the end of their eating window. Dinner and evening fuel are still ahead.
     * NEVER state or imply that "your eating window closed at ${payload.timingMetrics.lastMealTime}".
     * In 'actionableAdjustment', advise on timing for the REMAINING MEALS OF TODAY (e.g., when to have their next snack or dinner).
   - If day is completed (isDayInProgress is false):
     * Assess the full day eating window and give timing tweaks for TOMORROW.

6. BEHAVIORAL & DAY-OF-WEEK PATTERNS:
   - Identify whether today (${payload.dayOfWeek}) or recent days reflect weekend drift, weekday slumps, or meal prep gaps.

7. COMPENSATORY REBALANCING:
   - If day is in progress, rebalance the REMAINING meals of today. If day is finished, check rolling multi-day deficit and protein/fiber gaps to calculate practical micro-adjustments for tomorrow without crash dieting.

8. WHOLE FOOD PRESCRIPTIONS:
   - Name 2 to 3 specific healthy whole foods (e.g. Wild Salmon, Greek Yogurt, Edamame, Steel-Cut Oats with Chia, Lentil Soup).
   - If the user has elevated LDL or cholesterol context (isLdlElevated is true), prioritize cardio-protective foods rich in soluble fiber and omega-3s, and avoid high-saturated-fat choices.
   - Include realistic serving suggestions and the optimal time of day to eat them.

9. TONE & PLAIN ENGLISH (CRITICAL):
   - Speak in clear, down-to-earth, direct English like an elite athletic coach speaking to a real person—NEVER use academic jargon, flowery expressions, or cryptic pseudo-intellectual phrases.
   - FORBIDDEN JARGON & PHRASING:
     * NEVER use "mindful closure" (instead say: "Close your kitchen for tonight", "Finish eating for the day", or "Stop eating for tonight").
     * NEVER use "carbohydrate concentration" (instead say: "a carb-heavy meal late at night" or "late-night carbs").
     * NEVER use vague or poetic fluff like "nourish your journey", "embrace mindful eating", or "intentional caloric distribution".
   - Make all advice 100% concrete and actionable:
     * Tell the user exactly what to do: e.g. "You're at 2,400 of your 2,500 kcal and have had plenty of carbs today. Don't worry about the remaining 100 kcal—close the kitchen for tonight, drink water, and get some rest."

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Daily Telemetry Payload:\n${JSON.stringify(payload, null, 2)}` }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: DAILY_COACH_SCHEMA
    }
  };

  const raw = await callGeminiWithFallbacks<any>(requestBody, apiKey);

  return {
    date: payload.date,
    generatedAt: new Date().toISOString(),
    headline: raw.headline || 'Daily Nutritional & Metabolic Diagnosis',
    adherenceScore: Math.min(100, Math.max(0, Math.round(Number(raw.adherenceScore) || 75))),
    chronoNutrition: {
      firstMealTime: raw.chronoNutrition?.firstMealTime || payload.timingMetrics.firstMealTime,
      lastMealTime: raw.chronoNutrition?.lastMealTime || payload.timingMetrics.lastMealTime,
      eatingWindowHours: raw.chronoNutrition?.eatingWindowHours ?? payload.timingMetrics.eatingWindowHours,
      timingDiagnosis: raw.chronoNutrition?.timingDiagnosis || 'Meals were distributed across your eating window.',
      actionableAdjustment: raw.chronoNutrition?.actionableAdjustment || 'Maintain a regular eating cadence.'
    },
    patternDiscovery: {
      patternTitle: raw.patternDiscovery?.patternTitle || 'Behavioral Trend',
      observation: raw.patternDiscovery?.observation || 'Consistency is the primary driver of body composition progress.',
      underlyingDriver: raw.patternDiscovery?.underlyingDriver
    },
    rebalancePlan: {
      status: raw.rebalancePlan?.status || 'on_track',
      headline: raw.rebalancePlan?.headline || 'Stay the course on current targets',
      dailyMicroAdjustment: raw.rebalancePlan?.dailyMicroAdjustment || 'Continue with current daily targets tomorrow.'
    },
    recommendedFoods: Array.isArray(raw.recommendedFoods)
      ? raw.recommendedFoods.map((f: any) => ({
          foodName: f.foodName || 'Whole Food Option',
          portionSuggestion: f.portionSuggestion || 'Standard serving',
          targetBenefit: f.targetBenefit || 'Supports nutrient goals',
          bestTiming: f.bestTiming || 'Lunch or Snack'
        }))
      : []
  };
}

/**
 * Generates in-depth Weekly AI Coach Insights focusing on 7-day pattern discovery,
 * weekday vs weekend trends, trajectory balance, and strategic next-week gameplan.
 */
export async function generateWeeklyCoachInsight(
  payload: WeeklyCoachPayload,
  apiKey: string
): Promise<WeeklyCoachInsight> {
  const systemInstruction = `You are NutriFit AI Coach, an elite sports dietitian and behavioral scientist.
Analyze the user's 7-day rolling performance data provided in JSON format.

CRITICAL COACHING INSTRUCTIONS:
1. Extract subtle patterns that a human cannot see on static charts:
   - Weekday vs weekend variances in calories, eating windows, and nutrient density.
   - Chrono-nutrition shifts (e.g. tight 8h weekday windows vs 13h weekend grazing).
   - Multi-day consistency of protein and fiber.
2. Compare the weekly cumulative energy balance (deficit or surplus) to actual scale weight shifts.
3. Formulate a 2-3 step strategic game plan for the upcoming week.
4. Recommend 2 to 3 whole food staples to prioritize next week to fix the week's biggest nutritional deficiencies.
5. TONE:
   - Analytical, inspiring, objective, and strategic.

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: `Weekly Telemetry Payload:\n${JSON.stringify(payload, null, 2)}` }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: WEEKLY_COACH_SCHEMA
    }
  };

  const raw = await callGeminiWithFallbacks<any>(requestBody, apiKey);

  return {
    weekKey: payload.weekKey,
    dateRange: payload.dateRange,
    generatedAt: new Date().toISOString(),
    weeklyScore: Math.min(100, Math.max(0, Math.round(Number(raw.weeklyScore) || 75))),
    executiveDiagnosis: raw.executiveDiagnosis || 'Weekly metabolic and nutritional trajectory analyzed.',
    metabolicTrajectory: {
      avgDailyConsumed: Math.round(Number(raw.metabolicTrajectory?.avgDailyConsumed) || payload.weeklyAverages.avgDailyConsumed),
      avgDailyBurned: Math.round(Number(raw.metabolicTrajectory?.avgDailyBurned) || payload.weeklyAverages.avgDailyBurned),
      weeklyNetCalories: Math.round(Number(raw.metabolicTrajectory?.weeklyNetCalories) || payload.weeklyAverages.totalWeeklyDeficitOrSurplus),
      projectedWeightShift: raw.metabolicTrajectory?.projectedWeightShift || 'On track with maintenance',
      actualWeightShift: raw.metabolicTrajectory?.actualWeightShift
    },
    macroAdherenceConsistency: raw.macroAdherenceConsistency || 'Macro adherence maintained across logged days.',
    chronoPatternTrends: raw.chronoPatternTrends || 'Meal timing patterns recorded across the week.',
    topPatternsDetected: Array.isArray(raw.topPatternsDetected)
      ? raw.topPatternsDetected.map((p: any) => ({
          patternTitle: p.patternTitle || 'Observed Trend',
          observation: p.observation || 'Pattern detected across recent days.',
          underlyingDriver: p.underlyingDriver
        }))
      : [],
    weeklyRebalanceStrategy: {
      focusArea: raw.weeklyRebalanceStrategy?.focusArea || 'Consistency & Nutrient Density',
      actionSteps: Array.isArray(raw.weeklyRebalanceStrategy?.actionSteps)
        ? raw.weeklyRebalanceStrategy.actionSteps
        : ['Maintain balanced meals throughout the day']
    },
    recommendedFoods: Array.isArray(raw.recommendedFoods)
      ? raw.recommendedFoods.map((f: any) => ({
          foodName: f.foodName || 'Whole Food Staple',
          portionSuggestion: f.portionSuggestion || 'Standard serving',
          targetBenefit: f.targetBenefit || 'Supports weekly goal',
          bestTiming: f.bestTiming || 'Lunch or Dinner'
        }))
      : []
  };
}
