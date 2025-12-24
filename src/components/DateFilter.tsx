"use client";

import { useState } from "react";
import { Filter, ChevronDown } from "lucide-react";

export type DateFilterType = "all" | "today" | "week" | "month";

interface DateFilterProps {
    onFilterChange: (filter: DateFilterType) => void;
    className?: string;
}

export default function DateFilter({ onFilterChange, className = "" }: DateFilterProps) {
    const [activeFilter, setActiveFilter] = useState<DateFilterType>("all");
    const [showDropdown, setShowDropdown] = useState(false);

    const filterOptions: { value: DateFilterType; label: string }[] = [
        { value: "all", label: "All" },
        { value: "today", label: "Today" },
        { value: "week", label: "This Week" },
        { value: "month", label: "This Month" },
    ];

    const handleFilterChange = (filter: DateFilterType) => {
        setActiveFilter(filter);
        onFilterChange(filter);
        setShowDropdown(false);
    };

    const activeLabel = filterOptions.find(f => f.value === activeFilter)?.label || "All";

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
                <Filter className="w-4 h-4" />
                <span>{activeLabel}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
            </button>

            {showDropdown && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                        {filterOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => handleFilterChange(option.value)}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${activeFilter === option.value
                                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                    }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

// Helper functions for filtering by date
export function filterByDate<T>(
    items: T[],
    filter: DateFilterType,
    getDate: (item: T) => Date | null | undefined
): T[] {
    if (filter === "all") return items;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return items.filter(item => {
        const itemDate = getDate(item);
        if (!itemDate) return false;

        const date = new Date(itemDate);

        switch (filter) {
            case "today":
                return date >= startOfDay && date < new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
            case "week": {
                const dayOfWeek = now.getDay();
                const startOfWeek = new Date(startOfDay);
                startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(endOfWeek.getDate() + 7);
                return date >= startOfWeek && date < endOfWeek;
            }
            case "month": {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                return date >= startOfMonth && date <= endOfMonth;
            }
            default:
                return true;
        }
    });
}
