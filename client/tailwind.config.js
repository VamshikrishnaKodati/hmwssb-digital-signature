/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        govt: {
          navy: '#0D1B2A',
          blue: '#1B2A4A',
          'blue-light': '#2A3F6A',
          saffron: '#FF9933',
          green: '#138808',
          'dark-green': '#0E6606',
          cream: '#FFF8E7',
          'light-bg': '#F0F2F5',
          border: '#D4D8DD',
          muted: '#6B7280',
        },
      },
      fontFamily: {
        govt: ['Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
