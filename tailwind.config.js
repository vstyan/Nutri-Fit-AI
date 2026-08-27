/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        carb: {
          light: '#38bdf8',
          DEFAULT: '#0284c7',
          dark: '#0369a1',
        },
        protein: {
          light: '#fb7185',
          DEFAULT: '#e11d48',
          dark: '#be123c',
        },
        fat: {
          light: '#fde047',
          DEFAULT: '#ca8a04',
          dark: '#a16207',
        },
        burn: {
          light: '#4ade80',
          DEFAULT: '#16a34a',
          dark: '#15803d',
        }
      }
    },
  },
  plugins: [],
}
