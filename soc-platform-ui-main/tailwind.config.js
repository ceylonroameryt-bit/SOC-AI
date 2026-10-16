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
                obsidian: {
                    bg: '#050608',
                    dark: '#07090E',
                    surface: '#0C0E14',
                    card: 'rgba(12, 14, 20, 0.85)',
                    hover: '#12151E',
                    border: 'rgba(255, 255, 255, 0.07)',
                    gold: '#F59E0B',
                    'gold-light': '#FBBF24',
                    'gold-dark': '#D97706',
                    'gold-subtle': 'rgba(245, 158, 11, 0.10)',
                    steel: '#64748B',
                    muted: '#94A3B8',
                },
                calm: {
                    bg: '#050608',
                    dark: '#07090E',
                    surface: '#0C0E14',
                    card: 'rgba(12, 14, 20, 0.85)',
                    border: 'rgba(255, 255, 255, 0.07)',
                    teal: '#F59E0B',
                    'teal-light': '#FBBF24',
                    'teal-dark': '#D97706',
                    'teal-subtle': 'rgba(245, 158, 11, 0.10)',
                    amber: '#F59E0B',
                    'amber-light': '#FBBF24',
                    'amber-subtle': 'rgba(245, 158, 11, 0.12)',
                    slate: '#1E293B',
                    muted: '#64748B',
                },
                ink: {
                    DEFAULT: '#F8FAFC',
                    light: '#E2E8F0',
                    muted: '#94A3B8',
                    subtle: '#64748B',
                },
                accent: {
                    DEFAULT: '#F59E0B',
                    light: '#FBBF24',
                    glow: '#FCD34D',
                    soft: 'rgba(245, 158, 11, 0.10)',
                    border: 'rgba(245, 158, 11, 0.25)',
                },
                navy: {
                    950: '#050608',
                    900: '#07090E',
                    850: '#0C0E14',
                    800: '#12151E',
                    700: '#1E293B',
                },
                surface: {
                    DEFAULT: '#0C0E14',
                    light: '#12151E',
                    subtle: '#050608',
                    border: 'rgba(255, 255, 255, 0.07)',
                    'border-dark': 'rgba(255, 255, 255, 0.14)',
                }
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
                'card-hover': '0 8px 24px rgba(245, 158, 11, 0.12), 0 2px 6px rgba(0,0,0,0.4)',
                'accent': '0 4px 14px rgba(245, 158, 11, 0.35)',
                'glow': '0 0 20px rgba(245, 158, 11, 0.35)',
                'amber-glow': '0 0 25px rgba(245, 158, 11, 0.40)',
                'gold-focal': '0 0 40px rgba(245, 158, 11, 0.25)',
            }
        },
    },
    plugins: [],
}
