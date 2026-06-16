import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
};
export default config;
