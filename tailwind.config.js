/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#2ecc71',
          dark: '#27ae60',
          navy: '#2c3e50',
          light: '#f4f7f6'
        }
      }
    },
  },
  plugins: [],
}