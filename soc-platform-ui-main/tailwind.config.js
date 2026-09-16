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
                ink: {
                    DEFAULT: '#0F172A',
                    light: '#334155',
                    muted: '#64748B',
                    subtle: '#94A3B8',
                },
                accent: {
                    DEFAULT: '#1E3A8A',
                    light: '#3B82F6',
                    glow: '#60A5FA',
                    soft: 'rgba(30, 58, 138, 0.08)',
                    border: 'rgba(30, 58, 138, 0.2)',
                },
                navy: {
                    950: '#060B17',
                    900: '#0B132B',
                    850: '#111C3D',
                    800: '#1C2541',
                    700: '#2A365F',
                },
                surface: {
                    DEFAULT: '#FFFFFF',
                    light: '#F8FAFC',
                    subtle: '#F1F5F9',
                    border: '#E2E8F0',
                    'border-dark': '#CBD5E1',
                }
            },
            boxShadow: {
                'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
                'card-hover': '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
                'accent': '0 4px 14px rgba(30, 58, 138, 0.3)',
                'glow': '0 0 20px rgba(59, 130, 246, 0.35)',
            }
        },
    },
    plugins: [],
}
