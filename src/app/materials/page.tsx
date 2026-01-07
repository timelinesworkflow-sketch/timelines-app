"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
    OrderItem,
    InventoryItem,
    MaterialPurchase,
    PlannedMaterial,
    PlannedMaterialWithStatus,
    OrderPlannedMaterials,
    getGarmentDisplayName
} from "@/types";
import {
    getAllInventory as getInventory,
    recordMaterialUsage
} from "@/lib/inventory";
import {
    createPurchaseRequest
} from "@/lib/purchases";
import {
    getItemsForStage,
    updateItem,
    updateItemStage,
    getNextWorkflowStage
} from "@/lib/orderItems";
import {
    Package,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    Archive,
    Scissors,
    AlertTriangle,
    ShoppingCart
} from "lucide-react";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";
import StagePageContent from "@/components/StagePageContent";
import PlannedMaterialsInput from "@/components/PlannedMaterialsInput";

export default function MaterialsPage() {
    const { user, userData } = useAuth();
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [activeTab, setActiveTab] = useState<"items" | "inventory">("items");

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Load Items for Materials Stage
            const itemsData = await getItemsForStage("materials", user.uid);
            setItems(itemsData);

            // Load Inventory (renamed export in inventory.ts is getAllInventory but I imported getInventory, check exports)
            // inventory.ts exports: getAllInventory. I must import that or alias it.
            // I will fix imports below to use getAllInventory as getInventory or just use getAllInventory.
            const inventoryData = await getInventory();
            setInventory(inventoryData);
        } catch (error) {
            console.error("Error loading data:", error);
            toast.error("Failed to load materials data");
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------------
    // ITEM ACTIONS
    // -------------------------------------------------------------

    const handleUpdatePlannedMaterials = async (itemId: string, materials: PlannedMaterial[]) => {
        try {
            // Create proper OrderPlannedMaterials object
            const plannedMaterialsData: OrderPlannedMaterials = {
                items: materials,
                plannedByStaffId: user!.uid,
                plannedByStaffName: userData?.name || "Unknown",
                plannedAt: Timestamp.now()
            };

            await updateItem(itemId, {
                plannedMaterials: plannedMaterialsData
            });

            // Update local state
            setItems(prev => prev.map(item =>
                item.itemId === itemId
                    ? { ...item, plannedMaterials: plannedMaterialsData }
                    : item
            ));

            toast.success("Materials updated");
        } catch (error) {
            console.error("Error updating materials:", error);
            toast.error("Failed to update materials");
        }
    };

    const handleConfirmUsage = async (item: OrderItem) => {
        if (!item.plannedMaterials?.items || item.plannedMaterials.items.length === 0) {
            toast.error("No materials planned for this item");
            return;
        }

        // 1. Validate Stock again
        const statusMap = checkStockAvailability(item.plannedMaterials.items, inventory);
        const hasShortage = item.plannedMaterials.items.some(m => {
            const status = statusMap.get(m.materialName + m.colour);
            return status?.stockStatus === "not_in_stock";
        });

        if (hasShortage) {
            toast.error("Cannot confirm usage: Material shortage detected");
            return;
        }

        try {
            // 2. Deduct from Inventory & Record Usage
            for (const material of item.plannedMaterials.items) {
                if (material.materialSource === "customer") continue; // Skip customer materials

                const invItem = inventory.find(i =>
                    i.materialName.trim().toLowerCase() === material.materialName.trim().toLowerCase() &&
                    (i.category || "").includes(material.colour || "")
                );

                const targetInvItem = inventory.find(i => i.inventoryId === material.materialId) || invItem;

                if (targetInvItem) {
                    let deductLength = material.measurement;

                    // Record Usage (This also updates inventory stock in lib/inventory.ts)
                    await recordMaterialUsage({
                        orderId: item.orderId,
                        itemId: item.itemId,
                        materialId: targetInvItem.inventoryId,
                        materialName: targetInvItem.materialName,
                        category: targetInvItem.category,
                        quantity: 1,
                        meter: deductLength,
                        totalLength: deductLength,
                        laborStaffId: user!.uid,
                        laborStaffName: userData?.name || "Unknown",
                        createdAt: Timestamp.now()
                    } as any);
                }
            }

            // 3. Move Item to Next Stage
            const nextStage = getNextWorkflowStage(item);
            if (nextStage) {
                await updateItemStage(
                    item.itemId,
                    nextStage,
                    "in_progress", // Next stage triggers default status
                    user!.uid,
                    userData?.name || "Unknown"
                );

                toast.success(`Item moved to ${nextStage}`);
                setItems(prev => prev.filter(i => i.itemId !== item.itemId));
            } else {
                toast.success("Item completed!");
                await updateItemStage(
                    item.itemId,
                    "completed",
                    "completed",
                    user!.uid,
                    userData?.name || "Unknown"
                );
                setItems(prev => prev.filter(i => i.itemId !== item.itemId));
            }

        } catch (error) {
            console.error("Error confirming usage:", error);
            toast.error("Failed to process material usage");
        }
    };

    const handleRequestPurchase = async (item: OrderItem, material: PlannedMaterialWithStatus) => {
        try {
            await createPurchaseRequest({
                materialId: material.materialId || "unknown",
                materialName: material.materialName,
                colour: material.colour,
                measurement: material.shortageLength || material.measurement,
                unit: material.unit,
                dueDate: item.dueDate?.toDate() || new Date(),
                requestedByStaffId: user!.uid,
                requestedByStaffName: userData?.name || "Unknown",
                requestedByRole: "materials",
                purchaseType: "order",
                sourceStage: "materials",
                orderId: item.orderId,
                itemId: item.itemId,
                garmentType: item.garmentType
            });
            toast.success("Purchase requested successfully");
        } catch (error) {
            console.error("Error requesting purchase:", error);
            toast.error("Failed to request purchase");
        }
    };

    // -------------------------------------------------------------
    // STOCK CHECKING LOGIC
    // -------------------------------------------------------------

    const checkStockAvailability = (materials: PlannedMaterial[], inventory: InventoryItem[]) => {
        const statusMap = new Map<string, PlannedMaterialWithStatus>();

        materials.forEach(mat => {
            if (mat.materialSource === "customer") {
                statusMap.set(mat.materialName + mat.colour, {
                    ...mat,
                    stockStatus: "in_stock",
                    availableLength: 9999,
                    shortageLength: 0
                });
                return;
            }

            let invItem = inventory.find(i => i.inventoryId === mat.materialId);
            if (!invItem) {
                invItem = inventory.find(i =>
                    i.materialName.toLowerCase().includes(mat.materialName.toLowerCase())
                );
            }

            if (invItem) {
                const available = invItem.availableLength;
                const needed = mat.measurement;

                if (available >= needed) {
                    statusMap.set(mat.materialName + mat.colour, {
                        ...mat,
                        stockStatus: "in_stock",
                        availableLength: available,
                        shortageLength: 0
                    });
                } else {
                    statusMap.set(mat.materialName + mat.colour, {
                        ...mat,
                        stockStatus: "not_in_stock",
                        availableLength: available,
                        shortageLength: needed - available
                    });
                }
            } else {
                statusMap.set(mat.materialName + mat.colour, {
                    ...mat,
                    stockStatus: "not_in_stock",
                    availableLength: 0,
                    shortageLength: mat.measurement
                });
            }
        });

        return statusMap;
    };

    return (
        <StagePageContent stageName="materials" stageDisplayName="Materials">
            <div className="space-y-6">
                {/* TABS */}
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button
                        onClick={() => setActiveTab("items")}
                        className={`pb-4 px-6 text-sm font-medium transition-colors relative ${activeTab === "items"
                            ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            }`}
                    >
                        Active Items ({items.length})
                    </button>
                    <button
                        onClick={() => setActiveTab("inventory")}
                        className={`pb-4 px-6 text-sm font-medium transition-colors relative ${activeTab === "inventory"
                            ? "text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                            }`}
                    >
                        Inventory Management
                    </button>
                    <button
                        onClick={loadData}
                        className="ml-auto p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        title="Refresh"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* ITEMS LIST */}
                {activeTab === "items" && (
                    <div className="space-y-4">
                        {loading ? (
                            <div className="flex justify-center p-12">
                                <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                            </div>
                        ) : items.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/30 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No items pending materials</h3>
                                <p className="text-gray-500 dark:text-gray-400">All items are stocked or moved to marking.</p>
                            </div>
                        ) : (
                            items.map(item => {
                                const materials = item.plannedMaterials?.items || [];
                                const statusMap = checkStockAvailability(materials, inventory);
                                const hasShortage = Array.from(statusMap.values()).some(s => s.stockStatus !== "in_stock");

                                return (
                                    <div key={item.itemId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        {/* HEADER */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-start gap-4 bg-gray-50/50 dark:bg-gray-800/50">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 rounded uppercase">
                                                        {getGarmentDisplayName(item)}
                                                    </span>
                                                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                                                        {item.itemName || "Unnamed Item"}
                                                    </h3>
                                                </div>
                                                <p className="text-sm text-gray-500 flex items-center gap-2">
                                                    <span>Order #{item.orderId.substring(item.orderId.length - 6)}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Due: {item.dueDate?.toDate().toLocaleDateString()}
                                                    </span>
                                                </p>
                                            </div>

                                            {/* ACTIONS */}
                                            <div className="flex items-center gap-2">
                                                {materials.length > 0 && !hasShortage ? (
                                                    <button
                                                        onClick={() => handleConfirmUsage(item)}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                        Confirm & Send to Marking
                                                    </button>
                                                ) : materials.length === 0 ? (
                                                    <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                        <AlertCircle className="w-4 h-4" />
                                                        Plan Materials to Proceed
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                                        <AlertTriangle className="w-4 h-4" />
                                                        Shortage Detected
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* CONTENT */}
                                        <div className="p-4">
                                            <div className="mb-4">
                                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                                    <Scissors className="w-4 h-4 text-gray-400" />
                                                    Planned Materials
                                                </h4>

                                                <PlannedMaterialsInput
                                                    initialItems={item.plannedMaterials?.items || []}
                                                    onChange={(m) => handleUpdatePlannedMaterials(item.itemId, m)}
                                                    disabled={false}
                                                />
                                            </div>

                                            {/* STATUS DETAILS */}
                                            {materials.length > 0 && (
                                                <div className="mt-4 bg-gray-50 dark:bg-gray-900/40 rounded-lg p-3 border border-gray-100 dark:border-gray-800">
                                                    <h5 className="text-xs font-semibold uppercase text-gray-500 mb-2">Availability Check</h5>
                                                    <div className="space-y-2">
                                                        {materials.map((mat, idx) => {
                                                            const status = statusMap.get(mat.materialName + mat.colour);
                                                            return (
                                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className={`w-2 h-2 rounded-full ${status?.stockStatus === "in_stock" ? "bg-green-500" : "bg-red-500"
                                                                            }`} />
                                                                        <span className="text-gray-700 dark:text-gray-300">
                                                                            {mat.materialName} ({mat.colour})
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="text-gray-500">
                                                                            Needs: {mat.measurement} {mat.unit}
                                                                        </span>
                                                                        {status?.stockStatus !== "in_stock" && (
                                                                            <button
                                                                                onClick={() => status && handleRequestPurchase(item, status)}
                                                                                className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                                                                            >
                                                                                <ShoppingCart className="w-3 h-3" />
                                                                                Request Purchase
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}

                {activeTab === "inventory" && (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500">
                        <Archive className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Inventory Management System</p>
                        <p className="text-sm mt-2">Use the Purchase Manager workflow for detailed inventory operations.</p>
                    </div>
                )}
            </div>
        </StagePageContent>
    );
}
