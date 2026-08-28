import { GeminiAnalysisResult } from '../types';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

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
          carbs: { type: 'NUMBER', description: 'Carbohydrates in grams' },
          protein: { type: 'NUMBER', description: 'Protein in grams' },
          fat: { type: 'NUMBER', description: 'Fat in grams' },
          calories: { type: 'NUMBER', description: 'Calories in kcal' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
        },
        required: ['name', 'portion', 'grams', 'carbs', 'protein', 'fat', 'calories']
      }
    },
    totalCarbs: { type: 'NUMBER', description: 'Sum of carbohydrates in grams' },
    totalProtein: { type: 'NUMBER', description: 'Sum of protein in grams' },
    totalFat: { type: 'NUMBER', description: 'Sum of fat in grams' },
    totalCalories: { type: 'NUMBER', description: 'Total calories in kcal' },
    dietaryNotes: { type: 'STRING', description: 'Brief health or nutrition note' }
  },
  required: ['title', 'mealType', 'items', 'totalCarbs', 'totalProtein', 'totalFat', 'totalCalories']
};

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

  const systemInstruction = `You are an expert nutritionist and visual food analyst.
Analyze the provided food photo with high precision:
1. Identify all visible dishes and components.
2. Estimate the realistic portion size and weight in grams for each item.
3. Calculate the macronutrients for each component: Carbohydrates (g), Protein (g), Fat (g), and Total Calories (kcal).
4. Sum the totals accurately (Total Calories = 4*Carbs + 4*Protein + 9*Fat approximately, adjusted for dietary fiber).
5. Suggest the most likely meal type (breakfast, lunch, dinner, snack) based on the food type.
${userNotes ? `User context/notes: "${userNotes}"` : ''}

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: NUTRITION_RESPONSE_SCHEMA
    }
  };

  return callGeminiWithFallbacks(requestBody, apiKey);
}

export async function analyzeFoodText(
  textDescription: string,
  apiKey: string
): Promise<GeminiAnalysisResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please add it in Settings.');
  }

  const systemInstruction = `You are an expert nutritionist and dietary calculator.
The user describes a meal they ate without a photo:
"${textDescription}"

1. Identify all ingredients, dishes, and portion descriptions mentioned.
2. Estimate the realistic weight in grams and portions for each component.
3. Calculate the macronutrients for each component: Carbohydrates (g), Protein (g), Fat (g), and Total Calories (kcal).
4. Sum the totals accurately (Total Calories = 4*Carbs + 4*Protein + 9*Fat approximately).
5. Suggest the most likely meal type (breakfast, lunch, dinner, snack).

Respond strictly in valid JSON matching the requested schema.`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: systemInstruction }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: NUTRITION_RESPONSE_SCHEMA
    }
  };

  return callGeminiWithFallbacks(requestBody, apiKey);
}

async function callGeminiWithFallbacks(requestBody: any, apiKey: string): Promise<GeminiAnalysisResult> {
  let lastError: Error | null = null;

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API (${model}) failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error(`No content returned from Gemini model ${model}`);
      }

      const parsed: GeminiAnalysisResult = JSON.parse(text);
      return parsed;
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed:`, err);
      lastError = err;
    }
  }

  throw lastError || new Error('Failed to analyze food with all available Gemini models');
}
