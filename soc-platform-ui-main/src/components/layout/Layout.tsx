import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CollectionStatusBar from './CollectionStatusBar';
import SkipLink from './SkipLink';
import AccessibilityModal from './AccessibilityModal';
import { useAccessibility } from '../../context/AccessibilityContext';
import { API_BASE } from '../../config/api';

export const Layout: React.FC = () => {
    const { isModalOpen, setIsModalOpen } = useAccessibility();
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [isDemoEnabled, setIsDemoEnabled] = useState(false);

    useEffect(() => {
        fetch(`${API_BASE}/api/dashboard/snapshot`)
            .then(res => (res.ok ? res.json() : null))
            .then(s => {
                if (s?.environment?.isDemoEnabled) {
                    setIsDemoEnabled(true);
                }
            })
            .catch(() => {});
    }, []);

    // Close mobile drawer on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && mobileDrawerOpen) {
                setMobileDrawerOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mobileDrawerOpen]);

    return (
        <div className="flex h-screen bg-[#F7F9FC] text-[#0F172A] font-sans selection:bg-[#0665F9]/20 selection:text-[#0665F9] overflow-hidden">
            {/* WCAG Skip Link */}
            <SkipLink />

            {/* Accessibility Modal */}
            <AccessibilityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Left Sidebar (Desktop: Static 232px, Mobile: Drawer) */}
            <div className="hidden lg:block h-full">
                <Sidebar isDemoEnabled={isDemoEnabled} />
            </div>

            {/* Mobile Drawer Overlay */}
            {mobileDrawerOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden flex"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Navigation drawer"
                >
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setMobileDrawerOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Drawer Content */}
                    <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#101F35] shadow-xl z-50">
                        <Sidebar
                            onClose={() => setMobileDrawerOpen(false)}
                            isDemoEnabled={isDemoEnabled}
                        />
                    </div>
                </div>
            )}

            {/* Right Main Column (TopBar + Workspace + CollectionStatusBar) */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#F4F7FB]">
                {/* 64px Top Bar */}
                <TopBar
                    onMenuToggle={() => setMobileDrawerOpen(true)}
                    isDemoEnabled={isDemoEnabled}
                />

                {/* Main Viewport Content Area */}
                <main
                    id="main-content"
                    role="main"
                    tabIndex={-1}
                    className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative custom-scrollbar focus:outline-none"
                >
                    <Outlet />
                </main>

                {/* Bottom Measured Collection Status Bar */}
                <CollectionStatusBar />
            </div>
        </div>
    );
};

export default Layout;
