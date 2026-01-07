"use client";

import { useState, useEffect } from "react";
import TopBar from "@/components/TopBar";
import Toast from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";
import { PurchaseRequest, PurchaseType } from "@/types";
import { getPendingPurchases, completePurchase, completePurchaseWithQuantity } from "@/lib/purchases";
import { recordMaterialPurchase } from "@/lib/inventory";
import { Package, ShoppingCart, Warehouse, Check, AlertCircle, Calendar, X } from "lucide-react";
import DateFilter, { DateFilterType, filterByDate } from "@/components/DateFilter";

export default function PurchasePageContent() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<PurchaseType>("order");
    const [inventoryPurchases, setInventoryPurchases] = useState<PurchaseRequest[]>([]);
    const [orderPurchases, setOrderPurchases] = useState<PurchaseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilterType>("all");

    // Completion modal state (for order-based purchases)
    const [completeModal, setCompleteModal] = useState<{
        purchase: PurchaseRequest;
        actualQuantity: string;
    } | null>(null);

    useEffect(() => {
        loadPurchases();
    }, []);

    const loadPurchases = async () => {
        setLoading(true);
        try {
            // Fetch all pending purchases and split by type client-side
            const allPurchases = await getPendingPurchases();
            setInventoryPurchases(allPurchases.filter(p => p.purchaseType === "inventory"));
            setOrderPurchases(allPurchases.filter(p => p.purchaseType === "order"));
        } catch (error) {
            console.error("Failed to load purchases:", error);
            setToast({ message: "Failed to load purchases", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const handleCompletePurchase = async (purchase: PurchaseRequest) => {
        if (!userData) return;

        // For order-based purchases, show modal to enter actual quantity
        if (purchase.purchaseType === "order") {
            setCompleteModal({
                purchase,
                actualQuantity: purchase.measurement.toString(),
            });
            return;
        }

        // For inventory purchases, complete directly and add to inventory
        setCompletingId(purchase.purchaseId);
        try {
            await completePurchase(purchase.purchaseId, userData.staffId, userData.name);

            // Add to inventory
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

            setToast({ message: "Purchase completed and added to inventory!", type: "success" });
            loadPurchases();
        } catch (error) {
            console.error("Failed to complete purchase:", error);
            setToast({ message: "Failed to complete purchase", type: "error" });
        } finally {
            setCompletingId(null);
        }
    };

    // Handle order-based purchase completion with actual quantity
    const handleCompleteOrderPurchase = async () => {
        if (!userData || !completeModal) return;

        const { purchase, actualQuantity } = completeModal;
        const actualQty = parseFloat(actualQuantity);
        const requestedQty = purchase.measurement;

        if (isNaN(actualQty) || actualQty <= 0) {
            setToast({ message: "Please enter a valid quantity", type: "error" });
            return;
        }

        if (actualQty < requestedQty) {
            setToast({ message: `Actual quantity must be at least ${requestedQty} ${purchase.unit} (requested amount)`, type: "error" });
            return;
        }

        setCompletingId(purchase.purchaseId);
        try {
            // Calculate excess
            const excessQty = actualQty - requestedQty;

            // Complete purchase with actual quantity tracking
            await completePurchaseWithQuantity(
                purchase.purchaseId,
                userData.staffId,
                userData.name,
                actualQty,
                excessQty
            );

            // If there's excess, auto-add to inventory
            if (excessQty > 0) {
                await recordMaterialPurchase({
                    materialId: purchase.materialId,
                    materialName: purchase.materialName,
                    category: purchase.colour || "",
                    quantity: 1,
                    meter: excessQty,
                    costPerMeter: 0,
                    staffId: userData.staffId,
                    staffName: userData.name,
                });
                setToast({
                    message: `Purchase completed! ${excessQty.toFixed(2)} ${purchase.unit} excess auto-added to inventory.`,
                    type: "success"
                });
            } else {
                setToast({ message: "Purchase completed! Material assigned to order.", type: "success" });
            }

            setCompleteModal(null);
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
    const filteredPurchases = filterByDate(currentPurchases, dateFilter, (p) => p.dueDate?.toDate());

    return (
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
                        {/* Filter Header */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                {filteredPurchases.length} purchases (by due date)
                            </p>
                            <DateFilter onFilterChange={setDateFilter} />
                        </div>

                        {filteredPurchases.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                <p className="text-gray-600 dark:text-gray-400">
                                    No purchases match this filter
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredPurchases.map((purchase) => (
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
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded-full text-xs ${purchase.purchaseType === "inventory"
                                                            ? "bg-indigo-100 text-indigo-800"
                                                            : "bg-green-100 text-green-800"
                                                            }`}>
                                                            {purchase.purchaseType === "inventory" ? "Inventory" : "Order-Based"}
                                                        </span>
                                                        {purchase.sourceStage && (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs ${purchase.sourceStage === "intake"
                                                                ? "bg-orange-100 text-orange-800"
                                                                : "bg-purple-100 text-purple-800"
                                                                }`}>
                                                                Source: {purchase.sourceStage === "intake" ? "Intake" : "Materials"}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Order-specific info */}
                                                {purchase.purchaseType === "order" && purchase.orderId && (
                                                    <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                                                        <span className="text-gray-600 dark:text-gray-400">Order: </span>
                                                        <span className="font-mono">{purchase.orderId.slice(0, 8)}...</span>
                                                        {purchase.garmentType && (
                                                            <span className="ml-2 text-gray-500">
                                                                ({purchase.garmentType?.replace(/_/g, " ") || '—'})
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
                )}
            </div>

            {/* Completion Modal for Order-Based Purchases */}
            {completeModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" style={{ zIndex: 9998 }}>
                    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-200">
                                Complete Purchase
                            </h3>
                            <button onClick={() => setCompleteModal(null)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                            <p className="font-medium text-gray-900 dark:text-gray-200">{completeModal.purchase.materialName}</p>
                            {completeModal.purchase.colour && (
                                <p className="text-sm text-gray-600 dark:text-gray-400">Color: {completeModal.purchase.colour}</p>
                            )}
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Requested: <span className="font-semibold">{completeModal.purchase.measurement} {completeModal.purchase.unit}</span>
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Actual Purchased Quantity ({completeModal.purchase.unit})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min={completeModal.purchase.measurement}
                                value={completeModal.actualQuantity}
                                onChange={(e) => setCompleteModal({ ...completeModal, actualQuantity: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-200"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Enter the actual amount purchased (must be ≥ {completeModal.purchase.measurement} {completeModal.purchase.unit})
                            </p>
                        </div>

                        {/* Excess Calculation Preview */}
                        {parseFloat(completeModal.actualQuantity) > completeModal.purchase.measurement && (
                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300">
                                    <strong>Excess Material:</strong> {(parseFloat(completeModal.actualQuantity) - completeModal.purchase.measurement).toFixed(2)} {completeModal.purchase.unit}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                    ✅ This excess will be auto-added to inventory
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setCompleteModal(null)}
                                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCompleteOrderPurchase}
                                disabled={completingId === completeModal.purchase.purchaseId}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {completingId === completeModal.purchase.purchaseId ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Complete
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
