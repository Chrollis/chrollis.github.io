/**
 * Tailwind configuration
 * ------------------------------------------------------------------
 * Colors are sourced from the raw RGB channel variables in
 * src/styles/tokens.css and exposed as `rgb(var(--x) / <alpha-value>)`.
 * That combination keeps CSS-variable theming working while still
 * supporting Tailwind's opacity modifiers, e.g. border-ak-border/60.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,md}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    /*
     * `900px` rather than Tailwind's `md` (768px): the header's three columns need 806px,
     * and below that the navigation slid under the controls.
     */
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '900px': '900px',
    },
    extend: {
      colors: {
        ak: {
          bg: 'rgb(var(--ak-bg) / <alpha-value>)',
          surface: 'rgb(var(--ak-surface) / <alpha-value>)',
          surface2: 'rgb(var(--ak-surface-2) / <alpha-value>)',
          text: 'rgb(var(--ak-text) / <alpha-value>)',
          muted: 'rgb(var(--ak-muted) / <alpha-value>)',
          border: 'rgb(var(--ak-border) / <alpha-value>)',
          accent: 'rgb(var(--ak-accent) / <alpha-value>)',
          accent2: 'rgb(var(--ak-accent-2) / <alpha-value>)',
          danger: 'rgb(var(--ak-danger) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--ak-font-sans)'],
        mono: ['var(--ak-font-mono)'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        display: ['clamp(2.75rem, 9vw, 7.5rem)', { lineHeight: '0.92', letterSpacing: '-0.02em' }],
        headline: ['clamp(1.75rem, 4vw, 3rem)', { lineHeight: '1.05' }],
      },
      letterSpacing: {
        /*
         * Variables rather than literals, so tracking has one source of truth. The fallback
         * matters: an unresolved `var()` invalidates the whole declaration rather than
         * falling back. Tracking does not vary by locale - see `tokens.css`.
         */
        ak: 'var(--ak-tracking, 0.16em)',
        akwide: 'var(--ak-tracking-wide, 0.32em)',
      },
      spacing: {
        gutter: 'clamp(1.25rem, 5vw, 4.5rem)',
        section: 'clamp(4rem, 10vw, 9rem)',
      },
      zIndex: {
        grid: '0',
        content: '10',
        nav: '40',
        overlay: '60',
        cursor: '80',
      },
      transitionTimingFunction: {
        ak: 'cubic-bezier(0.22, 1, 0.36, 1)',
        aksnap: 'cubic-bezier(0.85, 0, 0.15, 1)',
      },
      transitionDuration: {
        ak: '160ms',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        sweep: {
          '0%': { transform: 'scaleX(0)', transformOrigin: 'left' },
          '50%': { transform: 'scaleX(1)', transformOrigin: 'left' },
          '51%': { transform: 'scaleX(1)', transformOrigin: 'right' },
          '100%': { transform: 'scaleX(0)', transformOrigin: 'right' },
        },
        'pulse-frame': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        /* Deliberately slow. The cover mark should read as a slow instrument
           turning, not as a loading spinner. */
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'spin-slow-reverse': {
          '0%': { transform: 'rotate(360deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        blink: 'blink 1.1s steps(1, end) infinite',
        sweep: 'sweep 2.4s cubic-bezier(0.85, 0, 0.15, 1) infinite',
        'pulse-frame': 'pulse-frame 2.6s ease-in-out infinite',
        'spin-slow': 'spin-slow 48s linear infinite',
        'spin-slow-reverse': 'spin-slow-reverse 68s linear infinite',
      },
    },
  },
  plugins: [],
}
