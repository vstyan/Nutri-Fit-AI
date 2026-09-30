# NutriFit AI — Baseline Reference Documentation (v1.8.19)

**Baseline Release Version**: `v1.8.19`  
**Git Tag**: `v1.8.19-baseline`  
**Git Branch**: `baseline-v1.8`  
**Date Established**: September 30, 2026  

---

## 1. Executive Summary & Purpose
This document marks the official **Reference Baseline** for the NutriFit AI progressive web application (PWA). All core user-facing features, multimodal AI diet and exercise analysis, metabolic energy calculation engines, lipid panel management, and responsive data visualizations are fully implemented, verified, and protected by an automated unit test suite.

If any regression or design drift occurs during future architectural phases (such as the Android Health Connect Capacitor Bridge), this baseline tag and branch serve as the rock-solid fallback and gold standard.

---

## 2. Implemented Feature Inventory

### A. Core Architecture & PWA
- **Stack**: React 18, TypeScript, Tailwind CSS, Vite, `vite-plugin-pwa` (Workbox Service Worker for offline capability), Lucide Icons, Chart.js / `react-chartjs-2`.
- **Client-Side Persistence**: Fully local data storage via `localStorage` with JSON export/import backup functionality and persistent storage permission prompts.
- **Onboarding & Legal Disclaimers**: Terms of Service & Health Disclaimer modal blocking initial use until explicitly accepted by user (`TERMS_VERSION`), accessible at any time from Settings.

### B. Nutrition Logging & Multimodal AI Analysis
- **Gemini 2.5 Flash Integration**: Itemized meal breakdowns from photo or text description.
- **Nutritional Fields**: Calories, Protein, Total Carbs, Dietary Fiber, Net Carbs, Total Fat, Saturated Fat, Unsaturated Fat (Mono + Poly), Trans Fat, Dietary Cholesterol, and confidence ratings.
- **Interactive Meal Review Modal**: Allows users to tweak portions, ingredients, and individual macronutrient values with real-time recalculation of net carbs and TEF.
- **Meal History & Quick Logging**: Meal categorization (breakfast, lunch, dinner, snack), favorites list, and yesterday copy.

### C. Exercise, BMR, and Calorie Engine
- **Metabolic Baseline (BMR)**: Mifflin-St Jeor equation customized by gender, age, height, and weight.
- **Non-Exercise Activity Thermogenesis (NEAT)**: Configurable 15% sedentary baseline floor when logging workouts manually.
- **Thermic Effect of Food (TEF)**: Dynamic macronutrient oxidation cost (25% protein, 8% carbs, 2% fat; 10% baseline fallback).
- **Total Daily Energy Expenditure (TDEE)**: Supports resting-included vs. active-only modes, as well as sensor-based activity tracking.
- **AI Workout Coach**: Natural language exercise logger estimating caloric burn, duration, and intensity.

### D. Google Fit REST API Integration
- **OAuth 2.0 PKCE / Implicit Flow**: Secure, client-side Google OAuth token authorization without backend servers.
- **Data Sync**: Reads burned calories, steps, and activity sessions from Google Fitness REST API.
- **Smart TDEE Merging**: When Google Fit is connected, NEAT is automatically zeroed to eliminate double-counting with device sensors.

### E. Blood Lipid Tracker & Cardiovascular Metrics
- **Biomarker Tracking**: Total Cholesterol, LDL, HDL, Triglycerides with date and notes.
- **Dual Unit Support**: Canonical storage in mg/dL with instantaneous conversion and toggle for mmol/L.
- **Clinical Ratios & Indicators**:
  - Total Cholesterol / HDL Ratio with optimal (<3.5), average (3.5–5.0), and elevated (>5.0) risk badges.
  - Non-HDL Cholesterol ($\text{Total} - \text{HDL}$) atherogenic particle assessment.
  - Gender-specific HDL thresholds (protective $\ge 60$, normal $\ge 40$ male / $\ge 50$ female).
- **Lab Panel History & Modal**: Comprehensive record history, latest reading cards, and edit/delete controls.

### F. Dietary Cholesterol 7-Day Tracking & Visualizations
- **7-Day Rolling Intake**: Sum of dietary cholesterol consumed across all logged meals in the last 7 days.
- **Cardiovascular Target**: 300 mg/day standard AHA target ($2100\text{ mg/week}$).
- **Historical Trends & Charts**:
  - Integrated 7-day bar chart showing daily cholesterol intake against a dotted weekly limit line.
  - Visual status chips showing remaining allowance or milligram excess.
  - Responsive multi-metric grid (Calories, Net Carbs, Protein, Fat, Lipids, Dietary Cholesterol).

### G. AI Metabolic Coach (Weekly Analysis)
- Aggregates 7-day rolling intake, burned energy, macro ratios, fiber consistency, and lipid markers.
- Evaluates metabolic trajectory and theoretical fat mass shift ($3500\text{ kcal/lb}$).
- Provides actionable recommendations via Gemini structured reasoning.

---

## 3. Mathematical Formulas & Calculation Standards

### 1. Basal Metabolic Rate (Mifflin-St Jeor)
$$\text{BMR}_{\text{male}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (yr)} + 5$$
$$\text{BMR}_{\text{female}} = 10 \times \text{weight (kg)} + 6.25 \times \text{height (cm)} - 5 \times \text{age (yr)} - 161$$
- **Safety Floor**: $\max(800, \text{BMR})$
- **Default Fallback (missing profile)**: $1700\text{ kcal}$

### 2. Thermic Effect of Food (TEF)
$$\text{TEF} = (\text{Protein kcal} \times 0.25) + (\text{Carb kcal} \times 0.08) + (\text{Fat kcal} \times 0.02)$$
- Where:
  - $\text{Protein kcal} = \text{Protein (g)} \times 4$
  - $\text{Carb kcal} = \text{Carbs (g)} \times 4$
  - $\text{Fat kcal} = \text{Fat (g)} \times 9$
- **Fallback**: $10\%$ of total calories if macronutrients are unpopulated.

### 3. Non-Exercise Activity Thermogenesis (NEAT)
- **Manual Mode**: $\text{NEAT} = \text{BMR} \times 0.15$
- **Google Fit Mode**: $\text{NEAT} = 0$ (prevent sensor double-counting)
- **Active Only Mode (`includeResting = false`)**: $\text{NEAT} = 0$

### 4. Total Daily Energy Expenditure (TDEE)
$$\text{TDEE}_{\text{manual}} = \text{BMR} + \text{NEAT} + \text{EAT} + \text{TEF}$$
$$\text{TDEE}_{\text{Google Fit}} = \text{Fit Active Calories} + \text{TEF}$$
$$\text{TDEE}_{\text{active-only}} = \text{EAT} + \text{TEF}$$

### 5. Net Carbohydrates
$$\text{Net Carbs} = \max(0, \text{Total Carbs (g)} - \text{Dietary Fiber (g)})$$
- Rounded to 1 decimal place.

### 6. Blood Lipid Conversions & Ratios
- **Cholesterol Factor**: $1\text{ mmol/L} = 38.67\text{ mg/dL}$
- **Triglycerides Factor**: $1\text{ mmol/L} = 88.57\text{ mg/dL}$
- **Cholesterol Ratio**: $\text{Ratio} = \frac{\text{Total Cholesterol}}{\text{HDL}}$
  - Optimal: $< 3.5$
  - Normal / Average: $3.5 - 5.0$
  - Elevated Risk: $> 5.0$
- **Non-HDL Cholesterol**: $\text{Non-HDL} = \text{Total Cholesterol} - \text{HDL}$
  - Optimal: $< 130\text{ mg/dL}$
  - Borderline: $130 - 159\text{ mg/dL}$
  - High: $\ge 160\text{ mg/dL}$

### 7. Dietary Cholesterol
- Daily intake = $\sum \text{meal.totalCholesterol}$
- Weekly rolling total = $\sum_{d=1}^{7} \text{day.cholesterolIntake}$
- Weekly target limit = $300\text{ mg/day} \times 7 = 2100\text{ mg}$

---

## 4. Automated Baseline Test Suite

The test suite is built on **Vitest** and guarantees the integrity of all calculation engines:

| Test Suite | File | Tests | Coverage |
| :--- | :--- | :--- | :--- |
| **BMR & Body Units** | [`src/__tests__/bmrCalculator.test.ts`](file:///home/vstyan/Projects/Antigravity/Diet-Exercise-PWA/src/__tests__/bmrCalculator.test.ts) | 7 | Mifflin-St Jeor, male/female, 800 kcal floor, 1700 fallback, metric/imperial conversions |
| **Calorie Engine & TDEE** | [`src/__tests__/calorieEngine.test.ts`](file:///home/vstyan/Projects/Antigravity/Diet-Exercise-PWA/src/__tests__/calorieEngine.test.ts) | 9 | NEAT sedentary floor, Google Fit de-duplication, dynamic TEF macro costs, TDEE modes |
| **Lipid Calculator** | [`src/__tests__/lipidCalculator.test.ts`](file:///home/vstyan/Projects/Antigravity/Diet-Exercise-PWA/src/__tests__/lipidCalculator.test.ts) | 34 | mg/dL $\leftrightarrow$ mmol/L conversions, clinical thresholds, Total/HDL ratio, Non-HDL |
| **Nutrition Math** | [`src/__tests__/nutritionMath.test.ts`](file:///home/vstyan/Projects/Antigravity/Diet-Exercise-PWA/src/__tests__/nutritionMath.test.ts) | 12 | Net carbs clamping, dietary cholesterol aggregation, 7-day limits, Atwater 4-4-9, metabolic fat shift |
| **Total** | **4 Suites** | **62 Tests** | **100% Pass Rate** |

### Running the Test Suite
```bash
# Run tests once
npm test

# Run tests in watch mode during development
npm run test:watch
```

---

## 5. Baseline Fallback Reference

To revert or inspect this exact baseline state at any future point:
```bash
# Checkout the tagged baseline commit
git checkout v1.8.19-baseline

# Or switch to the dedicated baseline branch
git checkout baseline-v1.8
```
