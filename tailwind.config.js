/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        usam: {
          navy:  '#002E66',
          blue:  '#0047A0',
          surf:  '#005BBB',
          gold:  '#C8922A',
          light: '#F0B429',
        },
        'usam-navy':  '#002E66',
        'usam-blue':  '#0047A0',
        'usam-surf':  '#005BBB',
        'usam-gold':  '#C8922A',
        'usam-light': '#F0B429',
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
