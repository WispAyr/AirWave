/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        spacex: {
          dark: '#000000',
          darker: '#0a0a0a',
          blue: '#005288',
          'blue-light': '#0075c9',
          gray: '#2d2d2d',
          'gray-light': '#3d3d3d',
          accent: '#00d8ff',
          green: '#00ff41',
          orange: '#ff6b35',
          red: '#ff004d',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(100%)' },
        },
        glow: {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 20px rgba(0, 216, 255, 0.5)' },
          '50%': { opacity: 0.8, boxShadow: '0 0 30px rgba(0, 216, 255, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}

