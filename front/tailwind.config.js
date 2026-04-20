/** @type {import('tailwindcss').Config} */
//
// Colors are defined as CSS variables (RGB triplets, no alpha) in styles.css
// and selected per theme via [data-theme="..."] on <html>.
// See styles.css → "── Theme variables ──" section.
//
const rgbVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

module.exports = {
  content: [
    './src/**/*.{html,ts,css}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50:  rgbVar('--primary-50'),
          100: rgbVar('--primary-100'),
          200: rgbVar('--primary-200'),
          300: rgbVar('--primary-300'),
          400: rgbVar('--primary-400'),
          500: rgbVar('--primary-500'),
          600: rgbVar('--primary-600'),
          700: rgbVar('--primary-700'),
          800: rgbVar('--primary-800'),
          900: rgbVar('--primary-900'),
          950: rgbVar('--primary-950')
        },
        surface: {
          50:  rgbVar('--surface-50'),
          100: rgbVar('--surface-100'),
          200: rgbVar('--surface-200'),
          300: rgbVar('--surface-300'),
          400: rgbVar('--surface-400'),
          500: rgbVar('--surface-500'),
          600: rgbVar('--surface-600'),
          700: rgbVar('--surface-700'),
          800: rgbVar('--surface-800'),
          850: rgbVar('--surface-850'),
          900: rgbVar('--surface-900'),
          950: rgbVar('--surface-950')
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
};
