import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design System ZELTEK ERP — SDD sección 15.1 — estilo IMEI Checker, theming via CSS vars
        'app-bg':      'rgb(var(--app-bg) / <alpha-value>)',
        'app-surface': 'rgb(var(--app-surface) / <alpha-value>)',
        'app-sidebar': 'rgb(var(--app-sidebar) / <alpha-value>)',
        'app-border':  'rgb(var(--app-border) / <alpha-value>)',
        'brand':       '#6366F1',
        'brand-light': '#818CF8',

        // Reemplaza la paleta violeta por tonos índigo estilo IMEI Checker —
        // reskinea automáticamente todos los módulos que usan violet-* como acento
        violet: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
          950: '#1E1B4B',
        },
        'success':     '#34D399',
        'danger':      '#F43F5E',
        'warning':     '#FBBF24',
        'info':        '#60A5FA',

        // Escala neutra theming-aware: se invierte automáticamente en modo claro (ver index.css .light)
        slate: {
          50:  'rgb(var(--slate-50) / <alpha-value>)',
          100: 'rgb(var(--slate-100) / <alpha-value>)',
          200: 'rgb(var(--slate-200) / <alpha-value>)',
          300: 'rgb(var(--slate-300) / <alpha-value>)',
          400: 'rgb(var(--slate-400) / <alpha-value>)',
          500: 'rgb(var(--slate-500) / <alpha-value>)',
          600: 'rgb(var(--slate-600) / <alpha-value>)',
          700: 'rgb(var(--slate-700) / <alpha-value>)',
          800: 'rgb(var(--slate-800) / <alpha-value>)',
          900: 'rgb(var(--slate-900) / <alpha-value>)',
          950: 'rgb(var(--slate-950) / <alpha-value>)',
        },
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [animate],
};

export default config;
