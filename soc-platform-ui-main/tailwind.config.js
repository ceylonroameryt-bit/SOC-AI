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
                    bg: '#090D16',
                    dark: '#070A12',
                    surface: '#0D1527',
                    card: 'rgba(13, 21, 39, 0.85)',
                    hover: '#131F38',
                    border: 'rgba(16, 185, 129, 0.14)',
                    emerald: '#10B981',
                    'emerald-light': '#34D399',
                    'emerald-dark': '#059669',
                    'emerald-subtle': 'rgba(16, 185, 129, 0.12)',
                    ocean: '#0EA5E9',
                    'ocean-light': '#38BDF8',
                    amber: '#F59E0B',
                    'amber-light': '#FBBF24',
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
                    DEFAULT: '#10B981',
                    light: '#34D399',
                    glow: '#6EE7B7',
                    soft: 'rgba(16, 185, 129, 0.12)',
                    border: 'rgba(16, 185, 129, 0.25)',
                },
                navy: {
                    950: '#090D16',
                    900: '#070A12',
                    850: '#0D1527',
                    800: '#131F38',
                    700: '#1E293B',
                },
                surface: {
                    DEFAULT: '#0D1527',
                    light: '#131F38',
                    subtle: '#090D16',
                    border: 'rgba(16, 185, 129, 0.14)',
                    'border-dark': 'rgba(16, 185, 129, 0.25)',
                }
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
                'card-hover': '0 8px 24px rgba(16, 185, 129, 0.14), 0 2px 6px rgba(0,0,0,0.4)',
                'accent': '0 4px 14px rgba(16, 185, 129, 0.35)',
                'glow': '0 0 20px rgba(16, 185, 129, 0.35)',
                'emerald-glow': '0 0 25px rgba(16, 185, 129, 0.40)',
                'ocean-glow': '0 0 25px rgba(14, 165, 233, 0.35)',
                'calm-focal': '0 0 40px rgba(16, 185, 129, 0.25)',
            }
        },
    },
    plugins: [],
}
