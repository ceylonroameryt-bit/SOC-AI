import React, { useEffect, useRef } from 'react';
import {
    X,
    Eye,
    Type,
    ZapOff,
    Sparkles,
    RotateCcw,
    Keyboard,
    Sun,
    Moon,
    Contrast,
    Check
} from 'lucide-react';
import { useAccessibility, type FontSize } from '../../context/AccessibilityContext';

interface AccessibilityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AccessibilityModal: React.FC<AccessibilityModalProps> = ({ isOpen, onClose }) => {
    const {
        contrast,
        setContrast,
        fontSize,
        setFontSize,
        reducedMotion,
        setReducedMotion,
        highLegibility,
        setHighLegibility,
        resetAccessibility
    } = useAccessibility();

    const dialogRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    // Focus management on open and handle ESC key
    useEffect(() => {
        if (isOpen) {
            closeBtnRef.current?.focus();

            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            role="presentation"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="a11y-dialog-title"
                aria-describedby="a11y-dialog-desc"
                className="bg-white dark:bg-slate-900 high-contrast-bg w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 high-contrast-border overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 high-contrast-border bg-slate-50 dark:bg-slate-900/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                            <Eye className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2
                                id="a11y-dialog-title"
                                className="font-display text-lg font-bold text-slate-900 dark:text-white high-contrast-text tracking-tight"
                            >
                                Accessibility & Display Preferences
                            </h2>
                            <p id="a11y-dialog-desc" className="text-xs text-slate-500 dark:text-slate-400">
                                Customize contrast, text scaling, animations, and assistive viewing.
                            </p>
                        </div>
                    </div>
                    <button
                        ref={closeBtnRef}
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:ring-2 focus:ring-blue-600 focus:outline-none"
                        aria-label="Close accessibility preferences dialog"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                    {/* Contrast & Theme Mode */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 high-contrast-text flex items-center gap-1.5 font-mono">
                            <Contrast className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            <span>Visual Contrast & Theme</span>
                        </legend>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setContrast('default')}
                                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all text-left ${
                                    contrast === 'default'
                                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 font-semibold shadow-sm'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                }`}
                                aria-pressed={contrast === 'default'}
                            >
                                <Sun className="w-5 h-5 mb-1.5 text-amber-600" aria-hidden="true" />
                                <span className="text-xs font-bold">Standard Light</span>
                                <span className="text-[10px] text-slate-500">WCAG AA Compliant</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setContrast('high-contrast')}
                                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all text-left ${
                                    contrast === 'high-contrast'
                                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-bold shadow-sm ring-2 ring-blue-500/20'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                }`}
                                aria-pressed={contrast === 'high-contrast'}
                            >
                                <Contrast className="w-5 h-5 mb-1.5 text-blue-700" aria-hidden="true" />
                                <span className="text-xs font-bold">High Contrast</span>
                                <span className="text-[10px] text-blue-800 font-semibold">WCAG AAA Max Contrast</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setContrast('dark')}
                                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all text-left ${
                                    contrast === 'dark'
                                        ? 'border-blue-500 bg-slate-800 text-white font-semibold shadow-sm'
                                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                }`}
                                aria-pressed={contrast === 'dark'}
                            >
                                <Moon className="w-5 h-5 mb-1.5 text-indigo-400" aria-hidden="true" />
                                <span className="text-xs font-bold">Dark SOC Mode</span>
                                <span className="text-[10px] text-slate-400">Night & Low-light</span>
                            </button>
                        </div>
                    </fieldset>

                    {/* Text Scaling */}
                    <fieldset className="space-y-3">
                        <legend className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 high-contrast-text flex items-center gap-1.5 font-mono">
                            <Type className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            <span>Text Scaling</span>
                        </legend>
                        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Text Scaling Options">
                            {[
                                { key: 'normal', label: '100% (Normal)', sub: 'Default scale' },
                                { key: 'large',  label: '115% (Large)', sub: 'Enhanced size' },
                                { key: 'xlarge', label: '130% (Extra Large)', sub: 'Maximum readability' },
                            ].map(item => (
                                <button
                                    key={item.key}
                                    type="button"
                                    role="radio"
                                    aria-checked={fontSize === item.key}
                                    onClick={() => setFontSize(item.key as FontSize)}
                                    className={`p-3 rounded-xl border-2 text-center transition-all ${
                                        fontSize === item.key
                                            ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold shadow-sm'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                                    }`}
                                >
                                    <div className="text-xs font-bold">{item.label}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    {/* Motion & Legibility Toggles */}
                    <div className="space-y-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 high-contrast-text flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            <span>Sensory & Reading Comfort</span>
                        </span>

                        <div className="space-y-2.5">
                            {/* Reduced Motion Toggle */}
                            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                <div className="flex items-start gap-3">
                                    <ZapOff className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-white">Reduce Motion & Flashes</div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Disables pulsing radar pings, blinking indicators, and rapid animations.
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={reducedMotion}
                                    onChange={e => setReducedMotion(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    aria-label="Toggle reduced motion"
                                />
                            </label>

                            {/* High Legibility Toggle */}
                            <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                                <div className="flex items-start gap-3">
                                    <Type className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
                                    <div>
                                        <div className="text-xs font-bold text-slate-800 dark:text-white">High Legibility Spacing</div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            Expands letter-spacing and paragraph line-height for easier dyslexia reading.
                                        </div>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={highLegibility}
                                    onChange={e => setHighLegibility(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                    aria-label="Toggle high legibility spacing"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Keyboard Shortcuts Reference */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 mb-2">
                            <Keyboard className="w-4 h-4 text-blue-600" aria-hidden="true" />
                            <span>Quick Keyboard Shortcuts</span>
                        </div>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                            <li className="flex items-center justify-between">
                                <span>Accessibility Settings:</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Alt + A</kbd>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>Focus Global Search:</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">/</kbd>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>Skip to Main Content:</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Tab at top</kbd>
                            </li>
                            <li className="flex items-center justify-between">
                                <span>Close Modal / Drawer:</span>
                                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 font-mono text-[10px]">Esc</kbd>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
                    <button
                        type="button"
                        onClick={resetAccessibility}
                        className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium py-1 px-2 rounded-lg hover:bg-slate-200/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Reset Defaults</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn-accent px-5 py-2 text-xs flex items-center gap-1.5"
                    >
                        <Check className="w-4 h-4" aria-hidden="true" />
                        <span>Done</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AccessibilityModal;
