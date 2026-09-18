import React from 'react';

const SkipLink: React.FC = () => {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2.5 focus:bg-blue-800 focus:text-white focus:font-bold focus:text-sm focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-400 focus:border-2 focus:border-white transition-all"
        >
            Skip to main content (Press Enter)
        </a>
    );
};

export default SkipLink;
