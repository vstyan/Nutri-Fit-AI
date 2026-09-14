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
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
        },
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
