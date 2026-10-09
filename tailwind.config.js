/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './*.html',
    './assets/js/**/*.js',
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // Dashboard palette (qi-*)
        'qi-bg':     'var(--qi-bg)',
        'qi-panel':  'var(--qi-surface)',
        'qi-card':   'var(--qi-card)',
        'qi-border': 'var(--qi-border)',
        'qi-navy':   'var(--qi-navy)',
        'qi-cyan':   'var(--qi-cyan)',
        'qi-purple': 'var(--qi-purple)',
        'qi-green':  'var(--qi-green)',
        'qi-red':    'var(--qi-red)',
        'qi-gold':   'var(--qi-gold)',
        // Landing page palette (quantum-*)
        'quantum-dark':   'var(--qi-bg)',
        'quantum-navy':   'var(--qi-surface)',
        'quantum-card':   'var(--qi-card)',
        'quantum-cyan':   'var(--qi-cyan)',
        'quantum-purple': 'var(--qi-purple)',
        'quantum-green':  'var(--qi-green)',
        'quantum-amber':  'var(--qi-gold)',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'cyan-glow':   '0 0 25px rgba(0, 229, 255, 0.25)',
        'purple-glow': '0 0 25px rgba(124, 77, 255, 0.25)',
        'card-glow':   '0 10px 30px -10px rgba(0, 229, 255, 0.15)',
      },
      animation: {
        'ticker':      'ticker 35s linear infinite',
        'pulse-glow':  'pulseGlow 3s ease-in-out infinite',
      },
      keyframes: {
        ticker: {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', filter: 'drop-shadow(0 0 15px rgba(0, 229, 255, 0.4))' },
          '50%':      { opacity: '0.9', filter: 'drop-shadow(0 0 25px rgba(124, 77, 255, 0.8))' },
        },
      },
    },
  },
  plugins: [],
}
