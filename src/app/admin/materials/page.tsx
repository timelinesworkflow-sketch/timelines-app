"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Material, MATERIAL_CATEGORIES, MaterialCategory } from "@/types";
import { getAllMaterials, getMaterialsByDateRange, calculateMaterialsSummary, getDateRanges, MaterialsSummary } from "@/lib/materials";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Package, Filter, Calendar, Users, DollarSign, Ruler, TrendingUp, Search, X } from "lucide-react";

type DateFilter = "all" | "today" | "week" | "month" | "custom";

export default function AdminMaterialsPage() {
    const { userData } = useAuth();
    const [materials, setMaterials] = useState<Material[]>([]);
    const [filteredMaterials, setFilteredMaterials] = useState<Material[]>([]);
    const [summary, setSummary] = useState<MaterialsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [staffFilter, setStaffFilter] = useState<string>("all");
    const [orderFilter, setOrderFilter] = useState<string>("");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    // Staff list for filter dropdown
    const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        loadMaterials();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [materials, dateFilter, categoryFilter, staffFilter, orderFilter, customStartDate, customEndDate]);

    const loadMaterials = async () => {
        try {
            const data = await getAllMaterials();
            setMaterials(data);

            // Extract unique staff
            const staffMap = new Map<string, string>();
            data.forEach(m => {
                if (m.laborStaffId && !staffMap.has(m.laborStaffId)) {
                    staffMap.set(m.laborStaffId, m.laborStaffName);
                }
            });
            setStaffList(Array.from(staffMap.entries()).map(([id, name]) => ({ id, name })));
        } catch (error) {
            console.error("Failed to load materials:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...materials];

        // Date filter
        if (dateFilter !== "all") {
            const ranges = getDateRanges();
            let start: Date | null = null;
            let end: Date | null = null;

            if (dateFilter === "today") {
                start = ranges.today.start;
                end = ranges.today.end;
            } else if (dateFilter === "week") {
                start = ranges.thisWeek.start;
                end = ranges.thisWeek.end;
            } else if (dateFilter === "month") {
                start = ranges.thisMonth.start;
                end = ranges.thisMonth.end;
            } else if (dateFilter === "custom" && customStartDate && customEndDate) {
                start = new Date(customStartDate);
                end = new Date(customEndDate);
                end.setHours(23, 59, 59);
            }

            if (start && end) {
                filtered = filtered.filter(m => {
                    const date = m.createdAt.toDate();
                    return date >= start! && date <= end!;
                });
            }
        }

        // Category filter
        if (categoryFilter !== "all") {
            filtered = filtered.filter(m => m.materialCategory === categoryFilter);
        }

        // Staff filter
        if (staffFilter !== "all") {
            filtered = filtered.filter(m => m.laborStaffId === staffFilter);
        }

        // Order ID filter
        if (orderFilter.trim()) {
            filtered = filtered.filter(m =>
                m.linkedOrderId.toLowerCase().includes(orderFilter.toLowerCase())
            );
        }

        setFilteredMaterials(filtered);
        setSummary(calculateMaterialsSummary(filtered));
    };

    const clearFilters = () => {
        setDateFilter("all");
        setCategoryFilter("all");
        setStaffFilter("all");
        setOrderFilter("");
        setCustomStartDate("");
        setCustomEndDate("");
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center space-x-3 mb-2">
                            <Package className="w-8 h-8 text-indigo-600" />
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                Materials & Inventory
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                            Track materials, lengths, costs, and staff accountability
                        </p>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
                                <div className="flex items-center space-x-3">
                                    <DollarSign className="w-10 h-10 text-green-600" />
                                    <div>
                                        <p className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Material Cost</p>
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-300">₹{summary.totalMaterialCost.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
                                <div className="flex items-center space-x-3">
                                    <Ruler className="w-10 h-10 text-blue-600" />
                                    <div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Total Length Used</p>
                                        <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.totalLengthUsed.toFixed(2)} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className="w-10 h-10 text-purple-600" />
                                    <div>
                                        <p className="text-xs text-purple-600 dark:text-purple-400 uppercase font-medium">Most Used Material</p>
                                        <p className="text-lg font-bold text-purple-700 dark:text-purple-300 truncate">{summary.mostUsedMaterial || "N/A"}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-800">
                                <div className="flex items-center space-x-3">
                                    <Package className="w-10 h-10 text-orange-600" />
                                    <div>
                                        <p className="text-xs text-orange-600 dark:text-orange-400 uppercase font-medium">Total Entries</p>
                                        <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{summary.materialCount}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Filters */}
                    <div className="card mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <Filter className="w-5 h-5 text-gray-500" />
                                <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                            </div>
                            <button onClick={clearFilters} className="text-sm text-indigo-600 hover:underline flex items-center space-x-1">
                                <X className="w-4 h-4" />
                                <span>Clear All</span>
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {/* Date Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    <Calendar className="w-3 h-3 inline mr-1" /> Date
                                </label>
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                                    className="input text-sm w-full"
                                >
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                            </div>

                            {/* Custom Date Range */}
                            {dateFilter === "custom" && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="input text-sm w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="input text-sm w-full"
                                        />
                                    </div>
                                </>
                            )}

                            {/* Category Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category</label>
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="input text-sm w-full"
                                >
                                    <option value="all">All Categories</option>
                                    {MATERIAL_CATEGORIES.map(cat => (
                                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Staff Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    <Users className="w-3 h-3 inline mr-1" /> Labor (Staff)
                                </label>
                                <select
                                    value={staffFilter}
                                    onChange={(e) => setStaffFilter(e.target.value)}
                                    className="input text-sm w-full"
                                >
                                    <option value="all">All Staff</option>
                                    {staffList.map(staff => (
                                        <option key={staff.id} value={staff.id}>{staff.name} ({staff.id})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Order ID Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    <Search className="w-3 h-3 inline mr-1" /> Order ID
                                </label>
                                <input
                                    type="text"
                                    value={orderFilter}
                                    onChange={(e) => setOrderFilter(e.target.value)}
                                    placeholder="Search..."
                                    className="input text-sm w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Staff-wise Usage */}
                    {summary && summary.staffWiseUsage.length > 0 && (
                        <div className="card mb-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                <span>Staff-wise Material Usage</span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {summary.staffWiseUsage.map((staff) => (
                                    <div key={staff.staffId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                        <p className="font-medium text-gray-900 dark:text-white text-sm">{staff.staffName}</p>
                                        <p className="text-xs text-gray-500">{staff.staffId}</p>
                                        <div className="mt-2 flex justify-between text-xs">
                                            <span className="text-blue-600">{staff.totalLength.toFixed(1)} m</span>
                                            <span className="text-green-600">₹{staff.totalCost.toFixed(0)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Materials Table */}
                    <div className="card">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                            Materials Table ({filteredMaterials.length} entries)
                        </h3>

                        {filteredMaterials.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No materials found matching your filters
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 dark:bg-gray-800">
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material Name</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Category</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Qty</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Meter (Length)</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Total Length</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">₹/Meter</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Total Cost</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Labor (Staff)</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Order</th>
                                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMaterials.map((material) => (
                                            <tr key={material.materialId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{material.materialName}</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 capitalize">{material.materialCategory}</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{material.quantity}</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{material.meter} m</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium text-blue-600">{material.totalLength.toFixed(2)} m</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">₹{material.costPerMeter}</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium text-green-600">₹{material.totalMaterialCost.toFixed(2)}</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs">
                                                    <span className="font-medium">{material.laborStaffName}</span>
                                                    <br />
                                                    <span className="text-gray-500">{material.laborStaffId}</span>
                                                </td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs font-mono">{material.linkedOrderId.slice(0, 8)}...</td>
                                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs">{material.createdAt.toDate().toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
