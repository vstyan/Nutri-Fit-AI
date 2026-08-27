# NutriFit AI - Food & Carb Tracker PWA 🥗⚡

A Progressive Web App (PWA) that allows you to take pictures of what you eat each day, uses **Google Gemini AI** to recognize foods and estimate macronutrients (Carbs, Protein, Fat, Calories), and compares your carbohydrate intake against your metabolic carbohydrate burn (via Google Fit & RER Substrate Oxidation modeling).

---

## ✨ Key Features

1. **📸 AI Food Photo Recognition:**
   * Snap photos using your smartphone camera or upload from gallery.
   * Analyzed with **Gemini 2.5 Flash** (with fallback to 2.0/1.5) using structured JSON output.
   * Detects dish name, ingredients, weight in grams, carbohydrates, protein, fat, and calories.

2. **⚡ Review & 1-Tap Quick Save:**
   * Instant **1-Tap Save** button to record AI estimations immediately.
   * Expandable **Review & Edit** interface to tweak portions, ingredients, or macros before saving.

3. **🔥 Carbs Consumed vs. Carbs Burned:**
   * Computes your daily net carb balance (**Deficit** vs. **Surplus**).
   * Transparent **Respiratory Exchange Ratio (RER)** estimation model explaining resting burn vs. exercise workout burn ($4\text{ kcal/gram}$).

4. **💾 Flexible Storage Options:**
   * **Google Drive:** Automatically syncs daily logs and photos into a private `Diet-Exercise-PWA/` folder in your Google Drive (immune to browser cache clearing).
   * **Local Device (IndexedDB):** 100% private, offline-first local storage with one-click JSON backup export/import.

5. **🏃 Google Fit Integration:**
   * Syncs daily steps, active exercise calories, and active minutes via Google Fitness API.
   * Manual fallback option to log activity if preferred.

---

## 🚀 Quick Start

### 1. Run Development Server
```bash
npm install
npm run dev
```

### 2. Access on Smartphone
Open the Network URL shown in the terminal (e.g. `http://192.168.1.x:5173`) in your smartphone browser (Chrome on Android, Safari on iOS).
* **Android:** Tap the 3-dots menu $\rightarrow$ **"Install App"** or **"Add to Home Screen"**.
* **iOS:** Tap the Share button $\rightarrow$ **"Add to Home Screen"**.

---

## 🔑 Setup & API Keys

### 1. Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Click **Create API Key**.
3. In NutriFit AI, click the **Settings ⚙️** icon in the top-right header and paste your key.

### 2. Google OAuth 2.0 (Google Drive & Fit Sync)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project and enable two APIs:
   * **Google Drive API**
   * **Fitness API**
3. Under **APIs & Services $\rightarrow$ Credentials**, click **Create Credentials $\rightarrow$ OAuth client ID** (Application type: **Web application**).
4. Add your origin (e.g. `http://localhost:5173` or your local IP / domain) to **Authorized JavaScript origins**.
5. Paste the **Client ID** into NutriFit AI Settings and click **Connect Google Account**.

---

## 🧪 Scientific Basis: Carbs Burned Calculation

Fitness trackers record Total Calories Burned. The app estimates carbohydrate substrate oxidation using:

$$\text{Carbs (g) Burned} = \frac{\text{Resting kcal} \times 35\%}{4\text{ kcal/g}} + \frac{\text{Active kcal} \times 70\%}{4\text{ kcal/g}}$$

* **Resting state (BMR):** The body metabolizes ~35% carbohydrates and ~65% fatty acids.
* **Active exercise:** Glycogen becomes the primary fuel source (~70%–80% carbohydrates).
