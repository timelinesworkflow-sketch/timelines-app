"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { PurchaseRequest, PurchaseType } from "@/types";
import { getPurchasesByType, completePurchase } from "@/lib/purchases";
import { recordMaterialPurchase } from "@/lib/inventory";
import { Package, ShoppingCart, Warehouse, Check, Clock, AlertCircle, Calendar } from "lucide-react";

export default function PurchasePage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<PurchaseType>("inventory");
    const [inventoryPurchases, setInventoryPurchases] = useState<PurchaseRequest[]>([]);
    const [orderPurchases, setOrderPurchases] = useState<PurchaseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    useEffect(() => {
        loadPurchases();
    }, []);

    const loadPurchases = async () => {
        setLoading(true);
        try {
            const [invPurchases, ordPurchases] = await Promise.all([
                getPurchasesByType("inventory"),
                getPurchasesByType("order"),
            ]);
            setInventoryPurchases(invPurchases.filter(p => p.status !== "completed" && p.status !== "cancelled"));
            setOrderPurchases(ordPurchases.filter(p => p.status !== "completed" && p.status !== "cancelled"));
        } catch (error) {
            console.error("Failed to load purchases:", error);
            setToast({ message: "Failed to load purchases", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCompletePurchase = async (purchase: PurchaseRequest) => {
        if (!userData) return;

        setCompletingId(purchase.purchaseId);
        try {
            await completePurchase(purchase.purchaseId, userData.staffId, userData.name);

            // For inventory purchases, add to inventory
            if (purchase.purchaseType === "inventory") {
                await recordMaterialPurchase({
                    materialId: purchase.materialId,
                    materialName: purchase.materialName,
                    category: "",
                    quantity: 1,
                    meter: purchase.measurement,
                    costPerMeter: 0,
                    staffId: userData.staffId,
                    staffName: userData.name,
                });
            }
            // For order purchases, the materials will be picked up by the materials stage

            setToast({ message: "Purchase completed successfully!", type: "success" });
            loadPurchases();
        } catch (error) {
            console.error("Failed to complete purchase:", error);
            setToast({ message: "Failed to complete purchase", type: "error" });
        } finally {
            setCompletingId(null);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "-";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    const isOverdue = (timestamp: any) => {
        if (!timestamp) return false;
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date < new Date();
    };

    const currentPurchases = activeTab === "inventory" ? inventoryPurchases : orderPurchases;

    return (
        <ProtectedRoute allowedRoles={["purchase", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Purchase Stage
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Manage material purchases for inventory and orders
                        </p>
                    </div>

                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button
                            onClick={() => setActiveTab("inventory")}
                            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === "inventory"
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"
                                }`}
                        >
                            <Warehouse className="w-5 h-5" />
                            <span>Inventory Purchases</span>
                            {inventoryPurchases.length > 0 && (
                                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-0.5 rounded-full">
                                    {inventoryPurchases.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab("order")}
                            className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${activeTab === "order"
                                    ? "border-green-600 text-green-600"
                                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400"
                                }`}
                        >
                            <ShoppingCart className="w-5 h-5" />
                            <span>Order Purchases</span>
                            {orderPurchases.length > 0 && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
                                    {orderPurchases.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Loading state */}
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : currentPurchases.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">
                                No pending {activeTab === "inventory" ? "inventory" : "order"} purchases
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {currentPurchases.map((purchase) => (
                                <div
                                    key={purchase.purchaseId}
                                    className={`card ${isOverdue(purchase.dueDate) ? "border-l-4 border-l-red-500" : ""}`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <Package className="w-5 h-5 text-indigo-600" />
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {purchase.materialName}
                                                </h3>
                                                {purchase.colour && (
                                                    <span className="text-sm text-gray-500">({purchase.colour})</span>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Measurement:</span>
                                                    <span className="ml-1 font-medium">{purchase.measurement} {purchase.unit}</span>
                                                </div>
                                                <div className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                                    <span className={isOverdue(purchase.dueDate) ? "text-red-600 font-medium" : ""}>
                                                        Due: {formatDate(purchase.dueDate)}
                                                    </span>
                                                    {isOverdue(purchase.dueDate) && (
                                                        <AlertCircle className="w-4 h-4 ml-1 text-red-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Requested by:</span>
                                                    <span className="ml-1">{purchase.requestedByStaffName}</span>
                                                </div>
                                                <div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs ${purchase.purchaseType === "inventory"
                                                            ? "bg-indigo-100 text-indigo-800"
                                                            : "bg-green-100 text-green-800"
                                                        }`}>
                                                        {purchase.purchaseType === "inventory" ? "Inventory" : "Order-Based"}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Order-specific info */}
                                            {purchase.purchaseType === "order" && purchase.orderId && (
                                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                                                    <span className="text-gray-600 dark:text-gray-400">Order: </span>
                                                    <span className="font-mono">{purchase.orderId.slice(0, 8)}...</span>
                                                    {purchase.garmentType && (
                                                        <span className="ml-2 text-gray-500">
                                                            ({purchase.garmentType.replace(/_/g, " ")})
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Complete button */}
                                        <button
                                            onClick={() => handleCompletePurchase(purchase)}
                                            disabled={completingId === purchase.purchaseId}
                                            className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {completingId === purchase.purchaseId ? (
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                            ) : (
                                                <>
                                                    <Check className="w-5 h-5" />
                                                    <span>Complete</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
