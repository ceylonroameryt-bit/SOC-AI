/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Syne', 'system-ui', '-apple-system', 'sans-serif'],
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            colors: {
                calm: {
                    bg: '#0F172A',
                    dark: '#0B132B',
                    surface: '#1E293B',
                    card: 'rgba(30, 41, 59, 0.75)',
                    border: 'rgba(148, 163, 184, 0.15)',
                    teal: '#0D9488',
                    'teal-light': '#14B8A6',
                    'teal-dark': '#0F766E',
                    'teal-subtle': 'rgba(13, 148, 136, 0.12)',
                    amber: '#D97706',
                    'amber-light': '#F59E0B',
                    'amber-subtle': 'rgba(217, 119, 6, 0.12)',
                    slate: '#334155',
                    muted: '#64748B',
                },
                ink: {
                    DEFAULT: '#0F172A',
                    light: '#334155',
                    muted: '#64748B',
                    subtle: '#94A3B8',
                },
                accent: {
                    DEFAULT: '#0D9488',
                    light: '#14B8A6',
                    glow: '#2DD4BF',
                    soft: 'rgba(13, 148, 136, 0.10)',
                    border: 'rgba(13, 148, 136, 0.25)',
                },
                navy: {
                    950: '#060B17',
                    900: '#0B132B',
                    850: '#0F172A',
                    800: '#1E293B',
                    700: '#334155',
                },
                surface: {
                    DEFAULT: '#1E293B',
                    light: '#F8FAFC',
                    subtle: '#0F172A',
                    border: '#334155',
                    'border-dark': '#475569',
                }
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
                'card-hover': '0 8px 24px rgba(13, 148, 136, 0.12), 0 2px 6px rgba(0,0,0,0.04)',
                'accent': '0 4px 14px rgba(13, 148, 136, 0.35)',
                'glow': '0 0 20px rgba(20, 184, 166, 0.35)',
                'amber-glow': '0 0 20px rgba(217, 119, 6, 0.35)',
            }
        },
    },
    plugins: [],
}
