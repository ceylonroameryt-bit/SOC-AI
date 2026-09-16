import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useState } from 'react';

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-white text-slate-900 font-sans selection:bg-blue-600/20 selection:text-blue-900 overflow-hidden">
            {/* Mobile Sidebar Backdrop Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Container */}
            <div
                className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-white relative overflow-hidden">
                <TopBar onMenuClick={() => setSidebarOpen(true)} />
                {/* Scrollable page container for all screen sizes */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 relative custom-scrollbar bg-white">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
