"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order } from "@/types";
import { DollarSign, TrendingUp, Package, Users } from "lucide-react";

export default function AdminReportsPage() {
    const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "year">("month");
    const [loading, setLoading] = useState(true);

    const [totalRevenue, setTotalRevenue] = useState(0);
    const [totalMaterialsCost, setTotalMaterialsCost] = useState(0);
    const [totalOrders, setTotalOrders] = useState(0);
    const [profit, setProfit] = useState(0);

    useEffect(() => {
        loadReports();
    }, [dateRange]);

    const getDateRangeStart = () => {
        const now = new Date();
        switch (dateRange) {
            case "today":
                return Timestamp.fromDate(new Date(now.setHours(0, 0, 0, 0)));
            case "week":
                return Timestamp.fromDate(new Date(now.setDate(now.getDate() - 7)));
            case "month":
                return Timestamp.fromDate(new Date(now.setMonth(now.getMonth() - 1)));
            case "year":
                return Timestamp.fromDate(new Date(now.setFullYear(now.getFullYear() - 1)));
            default:
                return Timestamp.fromDate(new Date(0));
        }
    };

    const loadReports = async () => {
        setLoading(true);
        try {
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("createdAt", ">=", getDateRangeStart())
            );

            const snapshot = await getDocs(q);
            const orders = snapshot.docs.map((doc) => doc.data() as Order);

            // Calculate metrics
            let revenue = 0;
            let materialsCost = 0;
            let billedOrders = 0;

            orders.forEach((order) => {
                if (order.billing) {
                    revenue += order.billing.finalAmount;
                    materialsCost += order.billing.materialsCost;
                    billedOrders++;
                }
            });

            setTotalRevenue(revenue);
            setTotalMaterialsCost(materialsCost);
            setTotalOrders(billedOrders);

            // Simple profit calculation (can be modified later)
            // Profit = Revenue - Materials Cost (excluding staff payments for now)
            setProfit(revenue - materialsCost);
        } catch (error) {
            console.error("Failed to load reports:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Reports & Analytics
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Revenue, costs, and profit analysis
                        </p>
                    </div>

                    {/* Date Range Filter */}
                    <div className="card mb-6">
                        <label className="label">Date Range</label>
                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value as any)}
                            className="input max-w-xs"
                        >
                            <option value="today">Today</option>
                            <option value="week">This Week</option>
                            <option value="month">This Month</option>
                            <option value="year">This Year</option>
                        </select>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                        </div>
                    ) : (
                        <>
                            {/* Metrics Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="card">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Revenue</p>
                                        <DollarSign className="w-5 h-5 text-green-600" />
                                    </div>
                                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                                        ₹{totalRevenue.toLocaleString()}
                                    </p>
                                </div>

                                <div className="card">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Materials Cost</p>
                                        <Package className="w-5 h-5 text-orange-600" />
                                    </div>
                                    <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                                        ₹{totalMaterialsCost.toLocaleString()}
                                    </p>
                                </div>

                                <div className="card">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
                                        <Users className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                        {totalOrders}
                                    </p>
                                </div>

                                <div className="card">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Basic Profit</p>
                                        <TrendingUp className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <p className={`text-3xl font-bold ${profit >= 0 ? "text-purple-600 dark:text-purple-400" : "text-red-600 dark:text-red-400"}`}>
                                        ₹{profit.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        (Revenue - Materials)
                                    </p>
                                </div>
                            </div>

                            {/* Detailed Breakdown */}
                            <div className="card">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Financial Summary
                                </h3>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                        <span className="font-medium text-gray-900 dark:text-white">Total Revenue</span>
                                        <span className="font-bold text-green-600 dark:text-green-400 text-lg">
                                            ₹{totalRevenue.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                        <span className="font-medium text-gray-900 dark:text-white">Materials Cost</span>
                                        <span className="font-bold text-orange-600 dark:text-orange-400 text-lg">
                                            - ₹{totalMaterialsCost.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="h-px bg-gray-200 dark:bg-gray-700"></div>

                                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            Basic Profit (Customizable)
                                        </span>
                                        <span className={`font-bold text-xl ${profit >= 0 ? "text-purple-600 dark:text-purple-400" : "text-red-600 dark:text-red-400"}`}>
                                            ₹{profit.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                    <p className="text-sm text-blue-800 dark:text-blue-400">
                                        <strong>Note:</strong> This is a basic profit calculation (Revenue - Materials Cost).
                                        Staff payments and other expenses can be factored in later by modifying the calculation logic.
                                        All formulas are in a single, easily modifiable function.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
