import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { CATEGORY_DEFINITIONS } from '../../types/categories';

interface CategoryNavigationProps {
    selectedCategoryId: string;
    onSelectCategory: (categoryId: string) => void;
    countsByCategory: Record<string, number>;
    totalRecordsCount?: number;
}

export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
    selectedCategoryId,
    onSelectCategory,
    countsByCategory,
    totalRecordsCount = countsByCategory['all'] || 0,
}) => {
    const [moreOpen, setMoreOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Initial 6 visible categories (including "All intelligence")
    const primaryCategories = CATEGORY_DEFINITIONS.slice(0, 6);
    // Remaining categories in the "More categories" menu
    const moreCategories = CATEGORY_DEFINITIONS.slice(6);

    const isSelectedInMore = moreCategories.some(c => c.id === selectedCategoryId);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setMoreOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getCount = (id: string) => {
        if (id === 'all') return totalRecordsCount;
        return countsByCategory[id] || 0;
    };

    return (
        <div className="w-full" role="tablist" aria-label="Threat Categories Navigation">
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 custom-scrollbar">
                {primaryCategories.map(cat => {
                    const Icon = cat.icon;
                    const isSelected = selectedCategoryId === cat.id;
                    const count = getCount(cat.id);

                    return (
                        <button
                            key={cat.id}
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => onSelectCategory(cat.id)}
                            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex-shrink-0 cursor-pointer ${
                                isSelected
                                    ? 'bg-[#147DFA] text-white shadow-xs font-semibold'
                                    : 'bg-white text-[#14263F] border border-[#E2EAF3] hover:border-[#CBD5E1] hover:bg-slate-50/80'
                            }`}
                        >
                            <Icon className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#586C86]'}`} />
                            <span className="whitespace-nowrap">{cat.displayName}</span>
                            <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                                    isSelected
                                        ? 'bg-white/25 text-white'
                                        : 'bg-[#F1F5F9] text-[#586C86]'
                                }`}
                            >
                                {count}
                            </span>
                        </button>
                    );
                })}

                {/* More Categories Dropdown */}
                <div className="relative flex-shrink-0" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setMoreOpen(!moreOpen)}
                        aria-expanded={moreOpen}
                        aria-haspopup="true"
                        className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                            isSelectedInMore
                                ? 'bg-[#147DFA] text-white shadow-xs font-semibold'
                                : 'bg-white text-[#14263F] border border-[#E2EAF3] hover:border-[#CBD5E1] hover:bg-slate-50/80'
                        }`}
                    >
                        <span className="whitespace-nowrap">
                            {isSelectedInMore
                                ? moreCategories.find(c => c.id === selectedCategoryId)?.displayName || 'More'
                                : 'More categories'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {moreOpen && (
                        <div
                            role="menu"
                            className="absolute right-0 mt-1.5 w-60 bg-white border border-[#E2EAF3] rounded-xl shadow-lg p-1.5 z-40 space-y-0.5"
                        >
                            {moreCategories.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = selectedCategoryId === cat.id;
                                const count = getCount(cat.id);

                                return (
                                    <button
                                        key={cat.id}
                                        role="menuitem"
                                        onClick={() => {
                                            onSelectCategory(cat.id);
                                            setMoreOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                                            isSelected
                                                ? 'bg-[#147DFA] text-white font-semibold'
                                                : 'text-[#14263F] hover:bg-[#F8FAFC]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate pr-2">
                                            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-[#586C86]'}`} />
                                            <span className="truncate">{cat.displayName}</span>
                                        </div>
                                        <span
                                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full font-semibold ${
                                                isSelected ? 'bg-white/25 text-white' : 'bg-[#F1F5F9] text-[#586C86]'
                                            }`}
                                        >
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CategoryNavigation;
