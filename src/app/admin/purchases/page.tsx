"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { PurchaseRequest, PurchaseType } from "@/types";
import { getAllPurchases } from "@/lib/purchases";
import { Package, ShoppingCart, Warehouse, Check, Clock, Calendar, ArrowLeft, XCircle } from "lucide-react";

export default function AdminPurchasesPage() {
    const [activeTab, setActiveTab] = useState<PurchaseType | "all">("all");
    const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPurchases();
    }, []);

    const loadPurchases = async () => {
        setLoading(true);
        try {
            const allPurchases = await getAllPurchases();
            setPurchases(allPurchases);
        } catch (error) {
            console.error("Failed to load purchases:", error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">Completed</span>;
            case "pending":
                return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-800">Pending</span>;
            case "in_progress":
                return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">In Progress</span>;
            case "cancelled":
                return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">Cancelled</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    const filteredPurchases = activeTab === "all"
        ? purchases
        : purchases.filter(p => p.purchaseType === activeTab);

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <a href="/admin" className="flex items-center text-indigo-600 hover:underline mb-2">
                                <ArrowLeft className="w-4 h-4 mr-1" />
                                Back to Admin
                            </a>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                Purchases Management
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                View all purchase requests (read-only)
                            </p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`px-4 py-3 border-b-2 transition-colors ${activeTab === "all"
                                    ? "border-gray-600 text-gray-900 dark:text-white"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"
                                }`}
                        >
                            All ({purchases.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("inventory")}
                            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === "inventory"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"
                                }`}
                        >
                            <Warehouse className="w-4 h-4" />
                            <span>Inventory</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("order")}
                            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === "order"
                                    ? "border-green-600 text-green-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"
                                }`}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Order-Based</span>
                        </button>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                        <div className="card text-center">
                            <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                {purchases.filter(p => p.status === "pending").length}
                            </div>
                            <div className="text-sm text-gray-500">Pending</div>
                        </div>
                        <div className="card text-center">
                            <div className="text-2xl font-bold text-blue-600">
                                {purchases.filter(p => p.status === "in_progress").length}
                            </div>
                            <div className="text-sm text-gray-500">In Progress</div>
                        </div>
                        <div className="card text-center">
                            <div className="text-2xl font-bold text-green-600">
                                {purchases.filter(p => p.status === "completed").length}
                            </div>
                            <div className="text-sm text-gray-500">Completed</div>
                        </div>
                        <div className="card text-center">
                            <div className="text-2xl font-bold text-red-600">
                                {purchases.filter(p => p.status === "cancelled").length}
                            </div>
                            <div className="text-sm text-gray-500">Cancelled</div>
                        </div>
                    </div>

                    {/* Loading state */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredPurchases.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">No purchases found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-gray-800">
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Type</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Measurement</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Due Date</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Requested By</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Status</th>
                                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Completed By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPurchases.map((purchase) => (
                                        <tr key={purchase.purchaseId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                <div className="font-medium">{purchase.materialName}</div>
                                                {purchase.colour && (
                                                    <div className="text-xs text-gray-500">{purchase.colour}</div>
                                                )}
                                                {purchase.orderId && (
                                                    <div className="text-xs text-green-600">Order: {purchase.orderId.slice(0, 8)}...</div>
                                                )}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs ${purchase.purchaseType === "inventory"
                                                        ? "bg-indigo-100 text-indigo-800"
                                                        : "bg-green-100 text-green-800"
                                                    }`}>
                                                    {purchase.purchaseType === "inventory" ? "Inventory" : "Order"}
                                                </span>
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                {purchase.measurement} {purchase.unit}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                {formatDate(purchase.dueDate)}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                <div>{purchase.requestedByStaffName}</div>
                                                <div className="text-xs text-gray-500">{purchase.requestedByRole}</div>
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                {getStatusBadge(purchase.status)}
                                            </td>
                                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                {purchase.completedByStaffName || "-"}
                                                {purchase.completedAt && (
                                                    <div className="text-xs text-gray-500">{formatDate(purchase.completedAt)}</div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
