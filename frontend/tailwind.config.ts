import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        panel: 'hsl(var(--panel))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        success: 'hsl(var(--success))',
        danger: 'hsl(var(--danger))',
        warning: 'hsl(var(--warning))',
      },
      boxShadow: {
        panel: '0 1px 2px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
