/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Baloo 2', 'sans-serif'],
        body: ['Nunito', 'sans-serif'],
      },
      colors: {
        duo: {
          green: '#58cc02',
          greenDark: '#46a302',
          blue: '#1cb0f6',
          blueDark: '#1899d6',
          bg: '#f7f7f7',
          line: '#e5e5e5',
          text: '#4b4b4b',
        },
      },
      boxShadow: {
        soft: '0 8px 20px rgba(39, 39, 39, 0.12)',
      },
    },
  },
  plugins: [],
};
