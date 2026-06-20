/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        industrial: {
          dark: '#0f172a',
          base: '#1e293b',
          light: '#334155',
          accent: '#0ea5e9'
        }
      }
    },
  },
  plugins: [],
}
