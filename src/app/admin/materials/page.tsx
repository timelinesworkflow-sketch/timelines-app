"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { InventoryItem, MaterialPurchase, MaterialUsage } from "@/types";
import {
    getAllInventory,
    getAllPurchases,
    getAllUsage,
    getInventorySummary,
    getStaffUsageSummary,
    getDateRanges,
    InventorySummary,
    StaffUsageSummary
} from "@/lib/inventory";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import {
    Package,
    Filter,
    Calendar,
    Users,
    DollarSign,
    Ruler,
    TrendingUp,
    Search,
    X,
    ShoppingCart,
    Warehouse,
    AlertTriangle
} from "lucide-react";

type DateFilter = "all" | "today" | "week" | "month" | "custom";
type ViewTab = "inventory" | "purchases" | "usage";

export default function AdminMaterialsPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<ViewTab>("inventory");
    const [loading, setLoading] = useState(true);

    // Data
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [purchases, setPurchases] = useState<MaterialPurchase[]>([]);
    const [usage, setUsage] = useState<MaterialUsage[]>([]);
    const [summary, setSummary] = useState<InventorySummary | null>(null);
    const [staffUsage, setStaffUsage] = useState<StaffUsageSummary[]>([]);

    // Filters
    const [dateFilter, setDateFilter] = useState<DateFilter>("all");
    const [categoryFilter, setCategoryFilter] = useState<string>("all");
    const [staffFilter, setStaffFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [customStartDate, setCustomStartDate] = useState<string>("");
    const [customEndDate, setCustomEndDate] = useState<string>("");

    // Filtered data
    const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
    const [filteredPurchases, setFilteredPurchases] = useState<MaterialPurchase[]>([]);
    const [filteredUsage, setFilteredUsage] = useState<MaterialUsage[]>([]);

    // Unique values for filters
    const [categories, setCategories] = useState<string[]>([]);
    const [staffList, setStaffList] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        loadAllData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [inventory, purchases, usage, dateFilter, categoryFilter, staffFilter, searchQuery, customStartDate, customEndDate]);

    const loadAllData = async () => {
        try {
            const [inv, pur, use, sum, staff] = await Promise.all([
                getAllInventory(),
                getAllPurchases(),
                getAllUsage(),
                getInventorySummary(),
                getStaffUsageSummary(),
            ]);

            setInventory(inv);
            setPurchases(pur);
            setUsage(use);
            setSummary(sum);
            setStaffUsage(staff);

            // Extract unique categories
            const cats = new Set<string>();
            inv.forEach(i => cats.add(i.category));
            pur.forEach(p => cats.add(p.category));
            setCategories(Array.from(cats).filter(c => c));

            // Extract unique staff
            const staffMap = new Map<string, string>();
            pur.forEach(p => staffMap.set(p.laborStaffId, p.laborStaffName));
            use.forEach(u => staffMap.set(u.laborStaffId, u.laborStaffName));
            setStaffList(Array.from(staffMap.entries()).map(([id, name]) => ({ id, name })));
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        const ranges = getDateRanges();
        let start: Date | null = null;
        let end: Date | null = new Date();

        if (dateFilter === "today") {
            start = ranges.today.start;
        } else if (dateFilter === "week") {
            start = ranges.thisWeek.start;
        } else if (dateFilter === "month") {
            start = ranges.thisMonth.start;
        } else if (dateFilter === "custom" && customStartDate && customEndDate) {
            start = new Date(customStartDate);
            end = new Date(customEndDate);
            end.setHours(23, 59, 59);
        }

        // Filter inventory
        let filtInv = [...inventory];
        if (categoryFilter !== "all") {
            filtInv = filtInv.filter(i => i.category === categoryFilter);
        }
        if (searchQuery) {
            filtInv = filtInv.filter(i =>
                i.materialId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                i.materialName.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredInventory(filtInv);

        // Filter purchases
        let filtPur = [...purchases];
        if (start && dateFilter !== "all") {
            filtPur = filtPur.filter(p => {
                const date = p.createdAt.toDate();
                return date >= start! && date <= end!;
            });
        }
        if (categoryFilter !== "all") {
            filtPur = filtPur.filter(p => p.category === categoryFilter);
        }
        if (staffFilter !== "all") {
            filtPur = filtPur.filter(p => p.laborStaffId === staffFilter);
        }
        if (searchQuery) {
            filtPur = filtPur.filter(p =>
                p.materialId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.materialName.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredPurchases(filtPur);

        // Filter usage
        let filtUse = [...usage];
        if (start && dateFilter !== "all") {
            filtUse = filtUse.filter(u => {
                const date = u.createdAt.toDate();
                return date >= start! && date <= end!;
            });
        }
        if (categoryFilter !== "all") {
            filtUse = filtUse.filter(u => u.category === categoryFilter);
        }
        if (staffFilter !== "all") {
            filtUse = filtUse.filter(u => u.laborStaffId === staffFilter);
        }
        if (searchQuery) {
            filtUse = filtUse.filter(u =>
                u.materialId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.materialName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.orderId.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredUsage(filtUse);
    };

    const clearFilters = () => {
        setDateFilter("all");
        setCategoryFilter("all");
        setStaffFilter("all");
        setSearchQuery("");
        setCustomStartDate("");
        setCustomEndDate("");
    };

    // Calculate filtered totals
    const filteredPurchaseTotal = filteredPurchases.reduce((sum, p) => sum + p.totalCost, 0);
    const filteredPurchaseLength = filteredPurchases.reduce((sum, p) => sum + p.totalLength, 0);
    const filteredUsageLength = filteredUsage.reduce((sum, u) => sum + u.totalLength, 0);

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
                            Track inventory, purchases, usage, and staff accountability
                        </p>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                                <div className="flex items-center space-x-3">
                                    <Warehouse className="w-8 h-8 text-blue-600" />
                                    <div>
                                        <p className="text-xs text-blue-600 uppercase font-medium">Inventory Items</p>
                                        <p className="text-xl font-bold text-blue-700">{summary.totalItems}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                                <div className="flex items-center space-x-3">
                                    <Ruler className="w-8 h-8 text-green-600" />
                                    <div>
                                        <p className="text-xs text-green-600 uppercase font-medium">Available Stock</p>
                                        <p className="text-xl font-bold text-green-700">{summary.totalAvailableLength.toFixed(1)} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className="w-8 h-8 text-purple-600" />
                                    <div>
                                        <p className="text-xs text-purple-600 uppercase font-medium">Total Used</p>
                                        <p className="text-xl font-bold text-purple-700">{summary.totalUsedLength.toFixed(1)} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                                <div className="flex items-center space-x-3">
                                    <DollarSign className="w-8 h-8 text-orange-600" />
                                    <div>
                                        <p className="text-xs text-orange-600 uppercase font-medium">Purchase Value</p>
                                        <p className="text-xl font-bold text-orange-700">₹{summary.totalPurchaseValue.toFixed(0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                                <div className="flex items-center space-x-3">
                                    <AlertTriangle className="w-8 h-8 text-red-600" />
                                    <div>
                                        <p className="text-xs text-red-600 uppercase font-medium">Low Stock</p>
                                        <p className="text-xl font-bold text-red-700">{summary.lowStockCount}</p>
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

                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {/* Date Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
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

                            {dateFilter === "custom" && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                                        <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="input text-sm w-full" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">End</label>
                                        <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="input text-sm w-full" />
                                    </div>
                                </>
                            )}

                            {/* Category Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                                <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input text-sm w-full">
                                    <option value="all">All Categories</option>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Staff Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    <Users className="w-3 h-3 inline mr-1" /> Staff
                                </label>
                                <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="input text-sm w-full">
                                    <option value="all">All Staff</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Search */}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                    <Search className="w-3 h-3 inline mr-1" /> Search
                                </label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="ID, Name, Order..."
                                    className="input text-sm w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Staff-wise Usage */}
                    {staffUsage.length > 0 && (
                        <div className="card mb-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                                <Users className="w-5 h-5 text-indigo-600" />
                                <span>Staff-wise Material Usage</span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {staffUsage.map((staff) => (
                                    <div key={staff.staffId} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                        <p className="font-medium text-gray-900 dark:text-white text-sm">{staff.staffName}</p>
                                        <p className="text-xs text-gray-500">{staff.staffId}</p>
                                        <div className="mt-2 flex justify-between text-xs">
                                            <span className="text-blue-600">{staff.totalLength.toFixed(1)} m used</span>
                                            <span className="text-gray-500">{staff.usageCount} orders</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex space-x-1 mb-4 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                        <button onClick={() => setActiveTab("inventory")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "inventory" ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm" : "text-gray-600"}`}>
                            <Warehouse className="w-4 h-4 inline mr-2" />Inventory ({filteredInventory.length})
                        </button>
                        <button onClick={() => setActiveTab("purchases")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "purchases" ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm" : "text-gray-600"}`}>
                            <ShoppingCart className="w-4 h-4 inline mr-2" />Purchases ({filteredPurchases.length})
                        </button>
                        <button onClick={() => setActiveTab("usage")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "usage" ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm" : "text-gray-600"}`}>
                            <TrendingUp className="w-4 h-4 inline mr-2" />Usage ({filteredUsage.length})
                        </button>
                    </div>

                    {/* Inventory Tab */}
                    {activeTab === "inventory" && (
                        <div className="card">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Current Inventory</h3>
                            {filteredInventory.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No inventory items found</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-800">
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material ID</th>
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Name</th>
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Category</th>
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Total Bought</th>
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Total Used</th>
                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Available</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredInventory.map((item) => (
                                                <tr key={item.inventoryId} className={`hover:bg-gray-50 ${item.availableLength < 5 ? 'bg-red-50' : ''}`}>
                                                    <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{item.materialId}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{item.materialName}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{item.category}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{item.totalBoughtLength.toFixed(2)} m</td>
                                                    <td className="border border-gray-300 px-3 py-2">{item.totalUsedLength.toFixed(2)} m</td>
                                                    <td className={`border border-gray-300 px-3 py-2 font-bold ${item.availableLength < 5 ? 'text-red-600' : 'text-green-600'}`}>
                                                        {item.availableLength.toFixed(2)} m
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Purchases Tab */}
                    {activeTab === "purchases" && (
                        <div className="card">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Purchase History</h3>
                                <div className="text-sm text-gray-600">
                                    Total: <span className="font-bold text-green-600">₹{filteredPurchaseTotal.toFixed(0)}</span> |
                                    <span className="font-bold text-blue-600 ml-2">{filteredPurchaseLength.toFixed(1)} m</span>
                                </div>
                            </div>
                            {filteredPurchases.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No purchases found</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-800">
                                                <th className="border border-gray-300 px-3 py-2 text-left">Date</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Material</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Category</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Qty × Meter</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Total Length</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">₹/Meter</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Total Cost</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Staff</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredPurchases.map((p) => (
                                                <tr key={p.purchaseId} className="hover:bg-gray-50">
                                                    <td className="border border-gray-300 px-3 py-2 text-xs">{p.createdAt.toDate().toLocaleDateString()}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{p.materialName}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{p.category}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{p.quantity} × {p.meter}m</td>
                                                    <td className="border border-gray-300 px-3 py-2 font-medium text-blue-600">{p.totalLength.toFixed(2)} m</td>
                                                    <td className="border border-gray-300 px-3 py-2">₹{p.costPerMeter}</td>
                                                    <td className="border border-gray-300 px-3 py-2 font-bold text-green-600">₹{p.totalCost.toFixed(0)}</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-xs">{p.laborStaffName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Usage Tab */}
                    {activeTab === "usage" && (
                        <div className="card">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Usage History</h3>
                                <div className="text-sm text-gray-600">
                                    Total Used: <span className="font-bold text-purple-600">{filteredUsageLength.toFixed(1)} m</span>
                                </div>
                            </div>
                            {filteredUsage.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No usage records found</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-800">
                                                <th className="border border-gray-300 px-3 py-2 text-left">Date</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Order ID</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Material</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Category</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Qty × Meter</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Total Length</th>
                                                <th className="border border-gray-300 px-3 py-2 text-left">Staff</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredUsage.map((u) => (
                                                <tr key={u.usageId} className="hover:bg-gray-50">
                                                    <td className="border border-gray-300 px-3 py-2 text-xs">{u.createdAt.toDate().toLocaleDateString()}</td>
                                                    <td className="border border-gray-300 px-3 py-2 font-mono text-xs">{u.orderId.slice(0, 8)}...</td>
                                                    <td className="border border-gray-300 px-3 py-2">{u.materialName}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{u.category}</td>
                                                    <td className="border border-gray-300 px-3 py-2">{u.quantity} × {u.meter}m</td>
                                                    <td className="border border-gray-300 px-3 py-2 font-medium text-purple-600">{u.totalLength.toFixed(2)} m</td>
                                                    <td className="border border-gray-300 px-3 py-2 text-xs">{u.laborStaffName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
