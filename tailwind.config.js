/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F7F8',
        surface: '#FFFFFF',
        ink: '#202725',
        muted: '#69716D',
        line: '#E5E9E6',
        primary: {
          DEFAULT: '#376451',
          dark: '#2C5243',
          soft: '#EAF2ED',
          faint: '#F3F7F4',
        },
        warning: {
          DEFAULT: '#B7791F',
          soft: '#FDF3E1',
        },
        danger: {
          DEFAULT: '#B4443C',
          soft: '#FBEDEC',
        },
        info: {
          DEFAULT: '#3E6B8A',
          soft: '#EDF4F8',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 20, 0.04)',
        pop: '0 12px 40px rgba(16, 24, 20, 0.14)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateX(24px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
