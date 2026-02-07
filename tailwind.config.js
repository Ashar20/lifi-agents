/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
    "./providers/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neon / Cyber Theme
        'spice-orange': '#43FF4D',
        'neon-green': '#43FF4D',
        'desert-sand': '#94a3b8',
        'deep-sand': '#64748b',
        'arrakis-brown': '#0f172a',
        'stillsuit-black': '#020617',
        'fremen-blue': '#06b6d4',
        'sandworm-tan': '#64748b',
      },
      fontFamily: {
        mono: ['Rajdhani', 'monospace'],
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'gradient-flow': 'gradient-flow 3s ease infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ripple': 'ripple 0.6s ease-out',
        'dust-float': 'dust-float 20s linear infinite',
      },
      keyframes: {
        'gradient-flow': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'ripple': {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(4)', opacity: '0' },
        },
        'dust-float': {
          '0%': { transform: 'translateY(0) translateX(0)', opacity: '0.3' },
          '50%': { transform: 'translateY(-20px) translateX(10px)', opacity: '0.6' },
          '100%': { transform: 'translateY(0) translateX(0)', opacity: '0.3' },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)",
        'dune-gradient': 'linear-gradient(135deg, #43FF4D 0%, #06b6d4 100%)',
        'desert-gradient': 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
      },
    },
  },
  plugins: [],
}
