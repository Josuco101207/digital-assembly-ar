/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dicrejart: {
          violet: '#330066',
          red: '#FF3300',
          blue: '#0099CC',
          orange: '#FF9933',
          yellow: '#FFCC00',
          magenta: '#990099',
          purple: '#9933FF',
          dark: '#1e003b' // Variación oscura para fondos
        }
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro', 'sans-serif'],
        heading: ['Outfit', 'sans-serif']
      }
    },
  },
  plugins: [],
}
