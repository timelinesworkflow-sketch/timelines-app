"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { Order, PlannedMaterialWithStatus, MaterialUsage, InventoryItem, MaterialPurchase } from "@/types";
import { getOrdersForStage, updateOrder, addTimelineEntry, logStaffWork, getNextStage } from "@/lib/orders";
import {
    checkStockStatus,
    getAllInventory,
    addPurchase,
    recordMaterialUsage,
    getInventorySummary,
    InventorySummary
} from "@/lib/inventory";
import { Timestamp } from "firebase/firestore";
import {
    Package,
    ArrowLeft,
    ArrowRight,
    Check,
    AlertTriangle,
    CheckCircle,
    XCircle,
    Plus,
    ShoppingCart,
    Warehouse,
    Eye
} from "lucide-react";
import Toast from "@/components/Toast";

type TabType = "orders" | "inventory";

export default function MaterialsPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("orders");
    const [orders, setOrders] = useState<Order[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Order materials with stock status
    const [materialsWithStatus, setMaterialsWithStatus] = useState<PlannedMaterialWithStatus[]>([]);

    // Inventory state
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);

    // Purchase form state
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [purchaseForm, setPurchaseForm] = useState({
        materialId: "",
        materialName: "",
        category: "",
        quantity: 0,
        meter: 0,
        costPerMeter: 0,
        supplier: "",
    });

    useEffect(() => {
        loadOrders();
        loadInventory();
    }, []);

    useEffect(() => {
        if (orders[currentIndex]?.plannedMaterials?.items) {
            loadMaterialsWithStatus(orders[currentIndex].plannedMaterials.items);
        } else {
            setMaterialsWithStatus([]);
        }
    }, [currentIndex, orders]);

    const loadOrders = async () => {
        try {
            const data = await getOrdersForStage("materials");
            setOrders(data);
        } catch (error) {
            console.error("Failed to load orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadInventory = async () => {
        try {
            const [inv, summary] = await Promise.all([
                getAllInventory(),
                getInventorySummary(),
            ]);
            setInventory(inv);
            setInventorySummary(summary);
        } catch (error) {
            console.error("Failed to load inventory:", error);
        }
    };

    const loadMaterialsWithStatus = async (plannedItems: any[]) => {
        try {
            const withStatus = await checkStockStatus(plannedItems);
            setMaterialsWithStatus(withStatus);
        } catch (error) {
            console.error("Failed to check stock status:", error);
        }
    };

    const currentOrder = orders[currentIndex];

    const handleConfirmUsage = async () => {
        if (!currentOrder || !userData) return;

        const hasShortage = materialsWithStatus.some(m => m.stockStatus !== "in_stock");
        if (hasShortage) {
            setToast({ message: "Cannot confirm: Some materials are not in stock. Please add purchases first.", type: "error" });
            return;
        }

        setActionLoading(true);

        try {
            // Record usage for each material
            const usageItems: MaterialUsage[] = [];
            for (const material of materialsWithStatus) {
                const usageId = await recordMaterialUsage({
                    orderId: currentOrder.orderId,
                    materialId: material.materialId,
                    materialName: material.materialName,
                    category: material.category,
                    quantity: material.quantity,
                    meter: material.meter,
                    laborStaffId: userData.staffId,
                    laborStaffName: userData.name,
                });
                usageItems.push({
                    usageId,
                    orderId: currentOrder.orderId,
                    materialId: material.materialId,
                    materialName: material.materialName,
                    category: material.category,
                    quantity: material.quantity,
                    meter: material.meter,
                    totalLength: material.totalLength,
                    laborStaffId: userData.staffId,
                    laborStaffName: userData.name,
                    createdAt: Timestamp.now(),
                });
            }

            const nextStage = getNextStage("materials", currentOrder.activeStages);

            // Update order
            await updateOrder(currentOrder.orderId, {
                currentStage: nextStage || "completed",
                status: nextStage ? "in_progress" : "completed",
                materials: {
                    usedItems: usageItems,
                    totalLengthUsed: materialsWithStatus.reduce((sum, m) => sum + m.totalLength, 0),
                    completedByStaffId: userData.staffId,
                    completedByStaffName: userData.name,
                    completedAt: Timestamp.now(),
                },
            });

            await addTimelineEntry(currentOrder.orderId, {
                staffId: userData.staffId,
                role: userData.role,
                stage: "materials",
                action: "completed",
            });

            await logStaffWork({
                staffId: userData.staffId,
                firebaseUid: userData.email,
                email: userData.email,
                role: userData.role,
                orderId: currentOrder.orderId,
                stage: "materials",
                action: "completed",
            });

            setToast({ message: "Materials stage completed!", type: "success" });

            // Reload data
            await loadOrders();
            await loadInventory();
        } catch (error) {
            console.error("Failed to confirm usage:", error);
            setToast({ message: "Failed to confirm usage", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const handleAddPurchase = async () => {
        if (!userData) return;

        if (!purchaseForm.materialId || !purchaseForm.materialName || purchaseForm.quantity <= 0 || purchaseForm.meter <= 0) {
            setToast({ message: "Please fill all required fields", type: "error" });
            return;
        }

        setActionLoading(true);

        try {
            await addPurchase({
                materialId: purchaseForm.materialId,
                materialName: purchaseForm.materialName,
                category: purchaseForm.category,
                quantity: purchaseForm.quantity,
                meter: purchaseForm.meter,
                costPerMeter: purchaseForm.costPerMeter,
                supplier: purchaseForm.supplier,
                laborStaffId: userData.staffId,
                laborStaffName: userData.name,
            });

            setToast({ message: "Purchase added successfully!", type: "success" });
            setShowPurchaseForm(false);
            setPurchaseForm({
                materialId: "",
                materialName: "",
                category: "",
                quantity: 0,
                meter: 0,
                costPerMeter: 0,
                supplier: "",
            });

            // Reload data
            await loadInventory();
            if (currentOrder?.plannedMaterials?.items) {
                await loadMaterialsWithStatus(currentOrder.plannedMaterials.items);
            }
        } catch (error) {
            console.error("Failed to add purchase:", error);
            setToast({ message: "Failed to add purchase", type: "error" });
        } finally {
            setActionLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "in_stock":
                return <CheckCircle className="w-5 h-5 text-green-600" />;
            case "partial_stock":
                return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
            case "not_in_stock":
                return <XCircle className="w-5 h-5 text-red-600" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "in_stock":
                return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">✅ In Stock</span>;
            case "partial_stock":
                return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">⚠️ Partial Stock</span>;
            case "not_in_stock":
                return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">❌ Not in Stock</span>;
            default:
                return null;
        }
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["materials", "supervisor", "admin"]}>
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
        <ProtectedRoute allowedRoles={["materials", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="page-content">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center space-x-3 mb-2">
                            <Package className="w-8 h-8 text-indigo-600" />
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                Materials
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                            Manage order materials and inventory
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
                        <button
                            onClick={() => setActiveTab("orders")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${activeTab === "orders"
                                ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                                }`}
                        >
                            <ShoppingCart className="w-4 h-4" />
                            <span>Order Materials ({orders.length})</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("inventory")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${activeTab === "inventory"
                                ? "bg-white dark:bg-gray-700 text-indigo-600 shadow-sm"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
                                }`}
                        >
                            <Warehouse className="w-4 h-4" />
                            <span>Inventory</span>
                        </button>
                    </div>

                    {/* ORDER-BASED MATERIALS TAB */}
                    {activeTab === "orders" && (
                        <>
                            {orders.length === 0 ? (
                                <div className="card text-center py-12">
                                    <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">No orders in materials stage</p>
                                </div>
                            ) : (
                                <div className="card">
                                    {/* Order Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                                Order #{currentOrder?.customerId}
                                            </h2>
                                            <p className="text-sm text-gray-500">
                                                {currentIndex + 1} of {orders.length} orders
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Due: {currentOrder?.dueDate?.toDate().toLocaleDateString()}
                                            </p>
                                            <p className="text-xs text-gray-500 capitalize">
                                                {currentOrder?.garmentType}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Planned Materials with Stock Status */}
                                    <div className="mb-6">
                                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                                            <Eye className="w-5 h-5" />
                                            <span>Materials Required (from Intake)</span>
                                        </h3>

                                        {materialsWithStatus.length === 0 ? (
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    No materials were planned at intake
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Shortage Alert */}
                                                {materialsWithStatus.some(m => m.stockStatus !== "in_stock") && (
                                                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-2">
                                                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="font-medium text-red-700 dark:text-red-400">Purchase Required</p>
                                                            <p className="text-sm text-red-600 dark:text-red-500">
                                                                Some materials are not in stock. Add purchases before confirming.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="overflow-x-auto">
                                                    <table className="w-full border-collapse text-sm">
                                                        <thead>
                                                            <tr className="bg-gray-100 dark:bg-gray-800">
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material ID</th>
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Name</th>
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Category</th>
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Required</th>
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Available</th>
                                                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {materialsWithStatus.map((material, idx) => (
                                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-mono text-xs">
                                                                        {material.materialId}
                                                                    </td>
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                                        {material.materialName}
                                                                    </td>
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                                        {material.category}
                                                                    </td>
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium">
                                                                        {material.totalLength.toFixed(2)} m
                                                                    </td>
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                                        {material.availableLength.toFixed(2)} m
                                                                    </td>
                                                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                                        {getStatusBadge(material.stockStatus)}
                                                                        {material.shortageLength > 0 && (
                                                                            <p className="text-xs text-red-600 mt-1">
                                                                                Need: {material.shortageLength.toFixed(2)} m more
                                                                            </p>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Quick Purchase Button */}
                                    <div className="mb-6">
                                        <button
                                            onClick={() => setShowPurchaseForm(true)}
                                            className="btn btn-outline flex items-center space-x-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Add Purchase</span>
                                        </button>
                                    </div>

                                    {/* Confirm Usage Button */}
                                    <button
                                        onClick={handleConfirmUsage}
                                        disabled={actionLoading || materialsWithStatus.length === 0 || materialsWithStatus.some(m => m.stockStatus !== "in_stock")}
                                        className="w-full btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
                                    >
                                        <Check className="w-5 h-5" />
                                        <span>{actionLoading ? "Processing..." : "Confirm Usage & Complete Stage"}</span>
                                    </button>

                                    {/* Navigation */}
                                    <div className="flex justify-between mt-6 pt-4 border-t">
                                        <button
                                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                                            disabled={currentIndex === 0}
                                            className="btn btn-outline flex items-center space-x-2 disabled:opacity-50"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            <span>Previous</span>
                                        </button>
                                        <button
                                            onClick={() => setCurrentIndex(Math.min(orders.length - 1, currentIndex + 1))}
                                            disabled={currentIndex === orders.length - 1}
                                            className="btn btn-outline flex items-center space-x-2 disabled:opacity-50"
                                        >
                                            <span>Next</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* INVENTORY TAB */}
                    {activeTab === "inventory" && (
                        <>
                            {/* Summary Cards */}
                            {inventorySummary && (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                    <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                                        <p className="text-xs text-blue-600 uppercase font-medium">Total Items</p>
                                        <p className="text-2xl font-bold text-blue-700">{inventorySummary.totalItems}</p>
                                    </div>
                                    <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                                        <p className="text-xs text-green-600 uppercase font-medium">Available Stock</p>
                                        <p className="text-2xl font-bold text-green-700">{inventorySummary.totalAvailableLength.toFixed(1)} m</p>
                                    </div>
                                    <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                                        <p className="text-xs text-purple-600 uppercase font-medium">Total Used</p>
                                        <p className="text-2xl font-bold text-purple-700">{inventorySummary.totalUsedLength.toFixed(1)} m</p>
                                    </div>
                                    <div className="card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20">
                                        <p className="text-xs text-red-600 uppercase font-medium">Low Stock</p>
                                        <p className="text-2xl font-bold text-red-700">{inventorySummary.lowStockCount}</p>
                                    </div>
                                </div>
                            )}

                            {/* Add Purchase Button */}
                            <div className="mb-4">
                                <button
                                    onClick={() => setShowPurchaseForm(true)}
                                    className="btn btn-primary flex items-center space-x-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Bulk Purchase</span>
                                </button>
                            </div>

                            {/* Inventory Table */}
                            <div className="card">
                                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                                    Inventory ({inventory.length} items)
                                </h3>

                                {inventory.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        No inventory items. Add a purchase to get started.
                                    </div>
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
                                                    <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Last Updated</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {inventory.map((item) => (
                                                    <tr key={item.inventoryId} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${item.availableLength < 5 ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-mono text-xs">
                                                            {item.materialId}
                                                        </td>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                            {item.materialName}
                                                        </td>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                            {item.category}
                                                        </td>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                            {item.totalBoughtLength.toFixed(2)} m
                                                        </td>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                                            {item.totalUsedLength.toFixed(2)} m
                                                        </td>
                                                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold ${item.availableLength < 5 ? 'text-red-600' : 'text-green-600'}`}>
                                                            {item.availableLength.toFixed(2)} m
                                                            {item.availableLength < 5 && <span className="ml-2 text-xs">⚠️ Low</span>}
                                                        </td>
                                                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs">
                                                            {item.lastUpdatedAt?.toDate().toLocaleDateString()}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Purchase Form Modal */}
                    {showPurchaseForm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Add Bulk Purchase
                                </h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="label">Material ID *</label>
                                        <input
                                            type="text"
                                            value={purchaseForm.materialId}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, materialId: e.target.value })}
                                            className="input"
                                            placeholder="e.g., FAB001"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Material Name *</label>
                                        <input
                                            type="text"
                                            value={purchaseForm.materialName}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, materialName: e.target.value })}
                                            className="input"
                                            placeholder="Cotton Fabric"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Category</label>
                                        <input
                                            type="text"
                                            value={purchaseForm.category}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, category: e.target.value })}
                                            className="input"
                                            placeholder="Fabric"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Quantity *</label>
                                            <input
                                                type="number"
                                                value={purchaseForm.quantity || ""}
                                                onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseFloat(e.target.value) || 0 })}
                                                className="input"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Meter per Qty *</label>
                                            <input
                                                type="number"
                                                value={purchaseForm.meter || ""}
                                                onChange={(e) => setPurchaseForm({ ...purchaseForm, meter: parseFloat(e.target.value) || 0 })}
                                                className="input"
                                                placeholder="0"
                                                min="0"
                                                step="0.1"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">Cost per Meter (₹)</label>
                                        <input
                                            type="number"
                                            value={purchaseForm.costPerMeter || ""}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, costPerMeter: parseFloat(e.target.value) || 0 })}
                                            className="input"
                                            placeholder="0"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Supplier (Optional)</label>
                                        <input
                                            type="text"
                                            value={purchaseForm.supplier}
                                            onChange={(e) => setPurchaseForm({ ...purchaseForm, supplier: e.target.value })}
                                            className="input"
                                            placeholder="Supplier name"
                                        />
                                    </div>

                                    {/* Calculated Total */}
                                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                                        <div className="flex justify-between text-sm">
                                            <span>Total Length:</span>
                                            <span className="font-bold">{(purchaseForm.quantity * purchaseForm.meter).toFixed(2)} m</span>
                                        </div>
                                        <div className="flex justify-between text-sm mt-1">
                                            <span>Total Cost:</span>
                                            <span className="font-bold text-green-600">₹{(purchaseForm.quantity * purchaseForm.meter * purchaseForm.costPerMeter).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Staff Info */}
                                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                                        <strong>Staff:</strong> {userData?.name} ({userData?.staffId})
                                        <span className="text-xs block text-gray-500">(Auto-filled, cannot be changed)</span>
                                    </div>
                                </div>

                                <div className="flex space-x-3 mt-6">
                                    <button
                                        onClick={() => setShowPurchaseForm(false)}
                                        className="flex-1 btn btn-outline"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddPurchase}
                                        disabled={actionLoading}
                                        className="flex-1 btn btn-primary"
                                    >
                                        {actionLoading ? "Adding..." : "Add Purchase"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
