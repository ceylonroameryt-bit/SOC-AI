import { Search, Download, Mail, Menu, ExternalLink } from 'lucide-react';
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
        <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-[#E2E8F0] flex items-center justify-between px-3 sm:px-4 lg:px-6 flex-shrink-0 z-20">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 mr-2">
                {/* Mobile Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden flex-shrink-0 transition-colors border border-[#E2E8F0]"
                    aria-label="Open Navigation Menu"
                >
                    <Menu className="w-5 h-5 text-blue-600" />
                </button>

                {/* Search Bar with Portfolio Style */}
                <div className="flex items-center flex-1 max-w-md min-w-0">
                    <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </span>
                        <input
                            type="text"
                            placeholder="Search threat intelligence, IOCs, CVEs..."
                            className="w-full bg-slate-50 focus:bg-white border border-[#E2E8F0] text-slate-800 text-xs sm:text-sm rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 block pl-10 pr-12 py-2 placeholder-slate-400 transition-all shadow-sm"
                        />
                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[10px] font-mono font-semibold text-slate-400 bg-slate-100 my-1.5 mr-1.5 px-1.5 rounded border border-[#E2E8F0]">
                            /
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Actions Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
                <a
                    href="https://sujampathirathnayaka.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:inline-flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-2 rounded-xl border border-blue-200 text-xs font-semibold transition-all shadow-sm"
                    title="Poorna Sujampathi Portfolio"
                >
                    <span>Portfolio</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                    onClick={handleSendReport}
                    className="btn-secondary flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs sm:text-sm active:scale-95"
                    title="Send Email Report"
                >
                    <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span className="hidden md:inline">Email Report</span>
                </button>

                <a
                    href={`${API_BASE}/api/reports/daily`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-accent flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm active:scale-95"
                    title="Download Report"
                >
                    <Download className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Download Report</span>
                </a>
            </div>
        </header>
    );
};

export default TopBar;
