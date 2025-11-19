/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        bg: {
          main: '#0a0a0a',     // Negru profund
          card: '#141414',     // Card background
          elevated: '#1a1a1a', // Hover states
        },
        border: {
          DEFAULT: '#2a2a2a',
          hover: '#404040',
        },
        text: {
          primary: '#ffffff',
          secondary: '#94a3b8', // Slate-400
          tertiary: '#71717a',
        },
        accent: {
          DEFAULT: '#8b5cf6', // Violet Enterprise
          soft: '#7c3aed',
          cyan: '#06b6d4',
        }
      },
      boxShadow: {
        'glow': '0 0 40px rgba(139, 92, 246, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}