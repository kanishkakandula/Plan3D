/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0e1013',
          900: '#14171c',
          850: '#191d23',
          800: '#1f242c',
          700: '#2b313b',
          600: '#3a4250',
          500: '#5b6474',
          400: '#8a93a3',
          300: '#b4bcc8',
          200: '#d7dce3',
          100: '#eef1f5',
        },
        blueprint: {
          DEFAULT: '#4d9fff',
          dim: '#2f6fbf',
        },
        accent: '#e0a33e',
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Inter',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs2: ['11px', '16px'],
      },
    },
  },
  plugins: [],
};
