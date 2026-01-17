/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        indigo: {
          50: '#f5f7ff',
          100: '#ebf0fe',
          200: '#ced9fd',
          300: '#adc0fb',
          400: '#8ca7fa',
          500: '#6b8ef9',
          600: '#4a75f8',
          700: '#295cf6',
          800: '#1d41ac',
          900: '#112767',
          950: '#0a173e',
        },
        slate: {
          950: '#020617',
        }
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3rem',
      }
    }
  },
  plugins: [],
}
