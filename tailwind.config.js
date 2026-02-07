/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  theme: {
    extend: {
      colors: {
        // Dune Theme Colors
        'spice-orange': '#D84315',
        'desert-sand': '#D7CCC8',
        'deep-sand': '#8D6E63',
        'arrakis-brown': '#4E342E',
        'stillsuit-black': '#1A1410',
        'fremen-blue': '#0277BD',
        'sandworm-tan': '#A1887F',
      },
      fontFamily: {
        mono: ['Rajdhani', 'monospace'],
        sans: ['Spectral', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        'dune-rise': ['DuneRise', 'Cinzel', 'serif'],
        'dune-tech': ['Orbitron', 'sans-serif'],
        dune: ['Cinzel', 'serif'],
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
        'dune-gradient': 'linear-gradient(135deg, #D84315 0%, #8D6E63 100%)',
        'desert-gradient': 'linear-gradient(180deg, #1A1410 0%, #4E342E 100%)',
      },
    },
  },
  plugins: [],
}
