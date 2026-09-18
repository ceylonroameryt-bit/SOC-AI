import { Outlet } from 'react-router-dom';
import NavBar from './NavBar';
import TopBar from './TopBar';
import SkipLink from './SkipLink';
import AccessibilityModal from './AccessibilityModal';
import { useAccessibility } from '../../context/AccessibilityContext';

const Layout = () => {
    const { isModalOpen, setIsModalOpen } = useAccessibility();

    return (
        <div className="flex flex-col h-screen bg-white text-slate-900 font-sans selection:bg-blue-600/20 selection:text-blue-900 overflow-hidden">
            {/* WCAG Skip Navigation Link */}
            <SkipLink />

            {/* Accessibility Settings Modal */}
            <AccessibilityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />

            {/* Top Action Bar (Search, Download, Email, Accessibility) */}
            <TopBar />

            {/* Secondary Horizontal Navigation Bar */}
            <NavBar />

            {/* Main Content Area */}
            <main
                id="main-content"
                role="main"
                tabIndex={-1}
                className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative custom-scrollbar bg-white focus:outline-none"
            >
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
