import type { Config } from 'tailwindcss';

// Les couleurs sont portées par des variables CSS (app/globals.css) : une seule source pour tout le thème.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './context/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Bleu pétrole : couleur d'action.
        primary: {
          DEFAULT: v('--p-700'),
          dark: v('--p-800'),
          darker: v('--p-900'),
          light: v('--p-500'),
          50: v('--p-50'),
          100: v('--p-100'),
          200: v('--p-200'),
          300: v('--p-300'),
          400: v('--p-400'),
          500: v('--p-500'),
          600: v('--p-600'),
          700: v('--p-700'),
          800: v('--p-800'),
          900: v('--p-900'),
        },
        // Neutres froids (porcelaine → encre), à la place des gris par défaut.
        gray: {
          50: v('--n-50'),
          100: v('--n-100'),
          200: v('--n-200'),
          300: v('--n-300'),
          400: v('--n-400'),
          500: v('--n-500'),
          600: v('--n-600'),
          700: v('--n-700'),
          800: v('--n-800'),
          900: v('--n-900'),
        },
        // Citron : « aujourd'hui », pastilles de notification.
        accent: { DEFAULT: v('--accent'), ink: v('--accent-ink') },
        danger: v('--danger'),
      },
      fontFamily: {
        sans: ['var(--font-ui)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-ui)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '10px',
        xl: '14px',
        '2xl': '20px',
        '3xl': '28px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--n-900) / 0.04), 0 8px 24px -12px rgb(var(--n-900) / 0.10)',
        float: '0 12px 40px -12px rgb(var(--n-900) / 0.28)',
      },
      transitionProperty: {
        width: 'width',
        sidebar: 'width, margin-left',
      },
    },
  },
  plugins: [],
};

export default config;
