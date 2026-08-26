/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0F0F17',
          2: '#16161E',
          3: '#1E1E2E',
          4: '#26263A',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        pink: {
          400: '#f472b6',
          500: '#ec4899',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bounce-dot': 'bounceDot 1.2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'spin-slow': 'spin 3s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0.7)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139,92,246,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(139,92,246,0.6)' },
        },
      },
      boxShadow: {
        'glow-violet': '0 0 30px rgba(139,92,246,0.35)',
        'glow-violet-lg': '0 0 60px rgba(139,92,246,0.4)',
        'card': '0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
