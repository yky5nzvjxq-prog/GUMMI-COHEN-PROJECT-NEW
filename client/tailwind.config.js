/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 50: '#f0f4f8', 100: '#d6e6f5', 200: '#a8c8e8', 300: '#6fa3d4', 400: '#3d7fbf', 500: '#2e5f8a', 600: '#1b3a5c', 700: '#152d47', 800: '#0f2033', 900: '#091420' },
      }
    }
  },
  plugins: [],
};
