import { useLocation } from 'react-router-dom';
import NewsFeed from '../components/dashboard/NewsFeed';
import SeverityChart from '../components/dashboard/SeverityChart';

const Dashboard = () => {
    const location = useLocation();

    // Determine active tab based on URL path
    const getActiveTab = () => {
        const path = location.pathname;
        if (path === '/metrics') return 'metrics';
        if (path === '/critical') return 'critical';
        return 'news'; // Default to news for '/'
    };

    const activeTab = getActiveTab();

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Content Area */}
            <div className="flex-1 min-h-0">
                {activeTab === 'metrics' && (
                    <div className="h-full">
                        <SeverityChart />
                    </div>
                )}
                {activeTab === 'critical' && (
                    <div className="h-full">
                        <NewsFeed mode="critical" />
                    </div>
                )}
                {activeTab === 'news' && (
                    <div className="h-full">
                        <NewsFeed mode="timeline" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
