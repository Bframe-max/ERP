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
        // Design System ZELTEK ERP — SDD sección 15.1
        'app-bg':      '#0F1117',
        'app-surface': '#1A1F2E',
        'app-sidebar': '#141824',
        'app-border':  '#1E293B',
        'brand':       '#7C3AED',
        'brand-light': '#818CF8',
        'success':     '#34D399',
        'danger':      '#F43F5E',
        'warning':     '#FBBF24',
        'info':        '#60A5FA',
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
