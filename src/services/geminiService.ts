import { GeminiAnalysisResult } from '../types';

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-pro',
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
          carbs: { type: 'NUMBER', description: 'Total Carbohydrates in grams' },
          fiber: { type: 'NUMBER', description: 'Dietary fiber in grams' },
          protein: { type: 'NUMBER', description: 'Protein in grams' },
          fat: { type: 'NUMBER', description: 'Fat in grams' },
          calories: { type: 'NUMBER', description: 'Calories in kcal' },
          confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] }
        },
        required: ['name', 'portion', 'grams', 'carbs', 'fiber', 'protein', 'fat', 'calories']
      }
    },
    totalCarbs: { type: 'NUMBER', description: 'Sum of total carbohydrates in grams' },
    totalFiber: { type: 'NUMBER', description: 'Sum of dietary fiber in grams' },
    totalProtein: { type: 'NUMBER', description: 'Sum of protein in grams' },
    totalFat: { type: 'NUMBER', description: 'Sum of fat in grams' },
    totalCalories: { type: 'NUMBER', description: 'Total calories in kcal' },
    dietaryNotes: { type: 'STRING', description: 'Brief health or nutrition note' }
  },
  required: ['title', 'mealType', 'items', 'totalCarbs', 'totalFiber', 'totalProtein', 'totalFat', 'totalCalories']
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
3. Calculate the macronutrients for each component: Carbohydrates (g), Dietary Fiber (g), Protein (g), Fat (g), and Total Calories (kcal).
4. Sum the totals accurately (Total Fiber, Total Carbs, Net Carbs = Carbs - Fiber, Protein, Fat, Calories).
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

  const result = await callGeminiWithFallbacks(requestBody, apiKey);
  const totalFiber = Number(result.totalFiber) || 0;
  const netCarbs = Math.max(0, Math.round(((result.totalCarbs || 0) - totalFiber) * 10) / 10);
  return {
    ...result,
    totalFiber,
    netCarbs
  };
}

export async function analyzeFoodText(
  textDescription: string,
  apiKey: string
): Promise<GeminiAnalysisResult> {
  if (!apiKey) {
    throw new Error('Gemini API key is required. Please add it in Settings.');
  }

  const systemInstruction = `You are an expert nutritionist and dietary calculator.
The user describes a meal they ate (or transcribed from voice):
"${textDescription}"

1. Identify all ingredients, dishes, and portion descriptions mentioned.
2. Estimate the realistic weight in grams and portions for each component.
3. Calculate the macronutrients for each component: Total Carbohydrates (g), Dietary Fiber (g), Protein (g), Fat (g), and Total Calories (kcal).
4. Sum the totals accurately (Total Carbs, Total Fiber, Net Carbs, Total Protein, Total Fat, Total Calories).
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

  const result = await callGeminiWithFallbacks(requestBody, apiKey);
  const totalFiber = Number(result.totalFiber) || 0;
  const netCarbs = Math.max(0, Math.round(((result.totalCarbs || 0) - totalFiber) * 10) / 10);
  return {
    ...result,
    totalFiber,
    netCarbs
  };
}

async function callGeminiWithFallbacks(requestBody: any, apiKey: string): Promise<GeminiAnalysisResult> {
  let lastError: Error | null = null;
  const errorSummaries: string[] = [];

  for (const model of FALLBACK_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          let cleanText = text.trim();
          if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          }
          const parsed: GeminiAnalysisResult = JSON.parse(cleanText);
          return parsed;
        }
      } else {
        const errorText = await response.text();
        
        // If 400 Bad Request and schema was supplied, try fallback without responseSchema
        if (response.status === 400 && requestBody.generationConfig?.responseSchema) {
          const simplifiedBody = {
            ...requestBody,
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          };
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(simplifiedBody)
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              let cleanText = text.trim();
              if (cleanText.startsWith('```')) {
                cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
              }
              const parsed: GeminiAnalysisResult = JSON.parse(cleanText);
              return parsed;
            }
          }
        }

        throw new Error(`[${model}] ${response.status}: ${errorText}`);
      }
    } catch (err: any) {
      console.warn(`Attempt with ${model} failed:`, err);
      lastError = err;
      errorSummaries.push(err.message || String(err));
    }
  }

  throw lastError || new Error(`Failed to analyze food with Gemini models. (${errorSummaries.join('; ')})`);
}
