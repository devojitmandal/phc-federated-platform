/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F3B3E',
          light: '#1B6E75',
          dark: '#082426',
        },
        accent: {
          DEFAULT: '#E8A33D',
          light: '#F2C275',
          dark: '#C9812A',
        },
        paper: '#FAF6EE',
        ink: '#2B2620',
        critical: '#C4453D',
      },
      fontFamily: {
        display: ['"EB Garamond"', 'serif'],
        body: ['Georgia', '"Charter"', 'serif'],
        devanagari: ['"Noto Serif Devanagari"', 'serif'],
        label: ['"Inter"', 'sans-serif'],
      },
      keyframes: {
        rise: {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(-160px)', opacity: '0' },
        },
      },
      animation: {
        rise: 'rise 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}