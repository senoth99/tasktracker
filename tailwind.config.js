/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        soft: '0 8px 24px -12px rgba(15,23,42,0.25)'
      }
    }
  },
  plugins: [],
};
