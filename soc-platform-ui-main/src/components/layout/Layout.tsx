import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CollectionStatusBar from './CollectionStatusBar';
import SkipLink from './SkipLink';
import AccessibilityModal from './AccessibilityModal';
import { AssistantDrawer } from './AssistantDrawer';
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
        <div className="flex h-screen bg-[#F3F4F6] text-[#0F1720] font-sans selection:bg-[#00E5FF]/20 selection:text-[#0B776C] overflow-hidden">
            {/* WCAG Skip Link */}
            <SkipLink />

            {/* Accessibility Modal */}
            <AccessibilityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Left 72px Icon Rail (Desktop: Static 72px, Mobile: Drawer) */}
            <div className="hidden lg:block h-full flex-shrink-0">
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                        onClick={() => setMobileDrawerOpen(false)}
                        aria-hidden="true"
                    />

                    {/* Drawer Content */}
                    <div className="relative flex-1 flex flex-col max-w-[72px] w-full bg-white shadow-2xl z-50">
                        <Sidebar
                            onClose={() => setMobileDrawerOpen(false)}
                            isDemoEnabled={isDemoEnabled}
                        />
                    </div>
                </div>
            )}

            {/* Right Main Column (TopBar + Workspace + CollectionStatusBar) */}
            <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#F3F4F6]">
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

                {/* Controlled Floating Assistant Drawer */}
                <AssistantDrawer />
            </div>
        </div>
    );
};

export default Layout;
