import { Search, Download, Mail, Menu } from 'lucide-react';
import { API_BASE } from '../../config/api';

interface TopBarProps {
    onMenuClick?: () => void;
}

const TopBar = ({ onMenuClick }: TopBarProps) => {
    const handleSendReport = () => {
        fetch(`${API_BASE}/api/notifications/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'poornasujampathi@gmail.com' })
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) alert('Report sent to poornasujampathi@gmail.com');
                else alert('Failed: Check Setup in server/services/emailService.js');
            })
            .catch(() => alert('Error connecting to server'));
    };

    return (
        <header className="h-16 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 z-20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 mr-2">
                {/* Mobile Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 lg:hidden flex-shrink-0 transition-colors"
                    aria-label="Open Navigation Menu"
                >
                    <Menu className="w-6 h-6 text-cyan-400" />
                </button>

                {/* Search Bar */}
                <div className="flex items-center flex-1 max-w-md min-w-0">
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search className="w-4 h-4 text-slate-500" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search Intelligence..."
                            className="w-full bg-slate-800/80 border border-slate-700/80 text-slate-200 text-xs sm:text-sm rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 block pl-9 pr-3 py-2 placeholder-slate-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Quick Actions Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                    onClick={handleSendReport}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 sm:px-3.5 py-2 rounded-xl border border-slate-700 transition-all font-medium text-xs sm:text-sm active:scale-95"
                    title="Send Email Report"
                >
                    <Mail className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="hidden md:inline">Email Report</span>
                </button>

                <a
                    href={`${API_BASE}/api/reports/daily`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 px-2.5 sm:px-3.5 py-2 rounded-xl border border-slate-700 hover:border-cyan-500/50 transition-all font-medium text-xs sm:text-sm active:scale-95"
                    title="Download Report"
                >
                    <Download className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden md:inline">Download</span>
                </a>
            </div>
        </header>
    );
};

export default TopBar;
