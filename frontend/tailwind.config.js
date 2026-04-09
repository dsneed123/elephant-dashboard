/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#080b14',
          1: '#0d1117',
          2: '#161b27',
          3: '#1e2533',
        },
      },
    },
  },
  plugins: [],
}
