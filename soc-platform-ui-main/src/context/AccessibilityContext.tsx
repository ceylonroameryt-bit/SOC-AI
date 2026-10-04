import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ContrastMode = 'default' | 'high-contrast' | 'dark';
export type FontSize = 'normal' | 'large' | 'xlarge';

interface AccessibilityContextType {
    contrast: ContrastMode;
    setContrast: (contrast: ContrastMode) => void;
    fontSize: FontSize;
    setFontSize: (size: FontSize) => void;
    reducedMotion: boolean;
    setReducedMotion: (enabled: boolean) => void;
    highLegibility: boolean;
    setHighLegibility: (enabled: boolean) => void;
    isModalOpen: boolean;
    setIsModalOpen: (open: boolean) => void;
    announceMessage: (msg: string, assertive?: boolean) => void;
    resetAccessibility: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

const PREF_CONTRAST_KEY = 'soc_a11y_contrast';
const PREF_FONT_KEY = 'soc_a11y_fontsize';
const PREF_MOTION_KEY = 'soc_a11y_motion';
const PREF_LEGIBILITY_KEY = 'soc_a11y_legibility';

export const AccessibilityProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Initial states with system and localStorage fallback
    const [contrast, setContrastState] = useState<ContrastMode>(() => {
        const saved = localStorage.getItem(PREF_CONTRAST_KEY);
        if (saved === 'high-contrast' || saved === 'dark' || saved === 'default') {
            return saved;
        }
        return 'default';
    });

    const [fontSize, setFontSizeState] = useState<FontSize>(() => {
        const saved = localStorage.getItem(PREF_FONT_KEY);
        if (saved === 'normal' || saved === 'large' || saved === 'xlarge') {
            return saved;
        }
        return 'normal';
    });

    const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
        const saved = localStorage.getItem(PREF_MOTION_KEY);
        if (saved !== null) {
            return saved === 'true';
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        }
        return false;
    });

    const [highLegibility, setHighLegibilityState] = useState<boolean>(() => {
        const saved = localStorage.getItem(PREF_LEGIBILITY_KEY);
        return saved === 'true';
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [liveMessage, setLiveMessage] = useState<string>('');
    const [isAssertive, setIsAssertive] = useState<boolean>(false);

    // Apply document-level classes and attributes for accessibility
    useEffect(() => {
        const root = document.documentElement;

        // Reset theme classes
        root.classList.remove('theme-high-contrast', 'theme-dark', 'theme-default');
        if (contrast === 'high-contrast') {
            root.classList.add('theme-high-contrast');
            root.setAttribute('data-contrast', 'high');
        } else if (contrast === 'dark') {
            root.classList.add('theme-dark');
            root.setAttribute('data-contrast', 'dark');
        } else {
            root.classList.add('theme-default');
            root.setAttribute('data-contrast', 'default');
        }
        localStorage.setItem(PREF_CONTRAST_KEY, contrast);
    }, [contrast]);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('text-scale-normal', 'text-scale-large', 'text-scale-xlarge');
        root.classList.add(`text-scale-${fontSize}`);
        localStorage.setItem(PREF_FONT_KEY, fontSize);
    }, [fontSize]);

    useEffect(() => {
        const root = document.documentElement;
        if (reducedMotion) {
            root.classList.add('reduced-motion');
        } else {
            root.classList.remove('reduced-motion');
        }
        localStorage.setItem(PREF_MOTION_KEY, String(reducedMotion));
    }, [reducedMotion]);

    useEffect(() => {
        const root = document.documentElement;
        if (highLegibility) {
            root.classList.add('high-legibility');
        } else {
            root.classList.remove('high-legibility');
        }
        localStorage.setItem(PREF_LEGIBILITY_KEY, String(highLegibility));
    }, [highLegibility]);

    // Keyboard shortcut for opening A11y modal: Alt+A
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault();
                setIsModalOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const setContrast = (mode: ContrastMode) => {
        setContrastState(mode);
        announceMessage(`Contrast mode changed to ${mode.replace('-', ' ')}`);
    };

    const setFontSize = (size: FontSize) => {
        setFontSizeState(size);
        announceMessage(`Text size adjusted to ${size === 'normal' ? 'standard 100%' : size === 'large' ? 'large 115%' : 'extra large 130%'}`);
    };

    const setReducedMotion = (enabled: boolean) => {
        setReducedMotionState(enabled);
        announceMessage(enabled ? 'Reduced motion enabled' : 'Reduced motion disabled');
    };

    const setHighLegibility = (enabled: boolean) => {
        setHighLegibilityState(enabled);
        announceMessage(enabled ? 'High legibility mode enabled' : 'High legibility mode disabled');
    };

    const announceMessage = (msg: string, assertive = false) => {
        setIsAssertive(assertive);
        setLiveMessage(msg);
        // Clear after announcement to allow repeat messages
        setTimeout(() => setLiveMessage(''), 3000);
    };

    const resetAccessibility = () => {
        setContrastState('default');
        setFontSizeState('normal');
        setReducedMotionState(false);
        setHighLegibilityState(false);
        announceMessage('Accessibility settings reset to defaults');
    };

    return (
        <AccessibilityContext.Provider
            value={{
                contrast,
                setContrast,
                fontSize,
                setFontSize,
                reducedMotion,
                setReducedMotion,
                highLegibility,
                setHighLegibility,
                isModalOpen,
                setIsModalOpen,
                announceMessage,
                resetAccessibility,
            }}
        >
            {children}
            {/* Screen Reader ARIA Live Region */}
            <div
                aria-live={isAssertive ? 'assertive' : 'polite'}
                aria-atomic="true"
                className="sr-only"
                id="a11y-live-announcer"
            >
                {liveMessage}
            </div>
        </AccessibilityContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAccessibility = (): AccessibilityContextType => {
    const context = useContext(AccessibilityContext);
    if (!context) {
        throw new Error('useAccessibility must be used within an AccessibilityProvider');
    }
    return context;
};
