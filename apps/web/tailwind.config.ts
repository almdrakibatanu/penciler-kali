import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        bn: ['"Noto Sans Bengali"', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        head: ['"Noto Serif Bengali"', '"Hind Siliguri"', 'serif'],
      },
      colors: {
        brand: {
          50:  '#f5f7fb',
          100: '#e7edf7',
          500: '#1e6fdc',
          600: '#1a5fbf',
          700: '#1551a3',
          900: '#0c2e5e',
        },
        ink: { 900: '#0f172a', 700: '#1f2937', 500: '#475569', 300: '#cbd5e1' },
      },
    },
  },
  plugins: [],
};
export default config;
