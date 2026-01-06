"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, PlannedMaterial } from "@/types";
import { updateOrder } from "@/lib/orders";
import { canEditOrder } from "@/lib/customers";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Calendar, Phone, Edit, X, Save, AlertCircle, DollarSign, List } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import Toast from "@/components/Toast";
import PlannedMaterialsInput from "@/components/PlannedMaterialsInput";
import DateFilter, { DateFilterType, filterByDate } from "@/components/DateFilter";

export default function OrdersList() {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const [dateFilter, setDateFilter] = useState<DateFilterType>("all");

    // Edit form state
    const [editCustomerName, setEditCustomerName] = useState("");
    const [editCustomerPhone, setEditCustomerPhone] = useState("");
    const [editCustomerAddress, setEditCustomerAddress] = useState("");
    const [editDesignNotes, setEditDesignNotes] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editPrice, setEditPrice] = useState<number>(0);
    const [editAdvanceAmount, setEditAdvanceAmount] = useState<number>(0);
    const [editMaterialCost, setEditMaterialCost] = useState<number>(0);
    const [editLabourCost, setEditLabourCost] = useState<number>(0);
    const [editPlannedMaterials, setEditPlannedMaterials] = useState<PlannedMaterial[]>([]);

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("status", "in", ["draft", "otp_sent", "confirmed_locked", "in_progress"]),
                orderBy("createdAt", "desc")
            );

            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map((doc) => doc.data() as Order);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const canEdit = (order: Order): boolean => {
        // Only intake and admin can edit
        if (!userData || !["intake", "admin", "supervisor"].includes(userData.role)) {
            return false;
        }
        return canEditOrder(order);
    };

    const startEditing = (order: Order) => {
        setEditingOrder(order);
        setEditCustomerName(order.customerName);
        setEditCustomerPhone(order.customerPhone);
        setEditCustomerAddress(order.customerAddress || "");
        setEditDesignNotes(order.designNotes || "");
        setEditDueDate(order.dueDate?.toDate().toISOString().split("T")[0] || "");
        setEditPrice(order.price || 0);
        setEditAdvanceAmount(order.advanceAmount || 0);
        setEditMaterialCost(order.materialCost || 0);
        setEditLabourCost(order.labourCost || 0);
        setEditPlannedMaterials(order.plannedMaterials?.items || []);
    };

    const cancelEditing = () => {
        setEditingOrder(null);
    };

    const saveChanges = async () => {
        if (!editingOrder || !userData) return;

        setSaving(true);
        try {
            // Filter valid planned materials
            const validPlannedMaterials = editPlannedMaterials.filter(
                m => m.materialId.trim() !== "" || m.materialName.trim() !== ""
            );

            // Build update object, filtering out undefined values
            const updateData: Record<string, any> = {};

            // Only add fields that have actual values (not undefined)
            if (editCustomerName !== undefined) updateData.customerName = editCustomerName;
            if (editCustomerPhone !== undefined) updateData.customerPhone = editCustomerPhone;
            if (editCustomerAddress !== undefined) updateData.customerAddress = editCustomerAddress || "";
            if (editDesignNotes !== undefined) updateData.designNotes = editDesignNotes || "";
            if (editDueDate) updateData.dueDate = Timestamp.fromDate(new Date(editDueDate));
            if (editPrice !== undefined) updateData.price = editPrice || 0;
            if (editAdvanceAmount !== undefined) updateData.advanceAmount = editAdvanceAmount || 0;
            if (editMaterialCost !== undefined) updateData.materialCost = editMaterialCost || 0;
            if (editLabourCost !== undefined) updateData.labourCost = editLabourCost || 0;

            // Handle planned materials - only set if there are valid items
            if (validPlannedMaterials.length > 0) {
                updateData.plannedMaterials = {
                    items: validPlannedMaterials,
                    plannedByStaffId: userData.staffId,
                    plannedByStaffName: userData.name,
                    plannedAt: Timestamp.now(),
                };
            }

            // Add to change history
            updateData.changeHistory = [
                ...(editingOrder.changeHistory || []),
                {
                    changedAt: Timestamp.now(),
                    changedByStaffId: userData.staffId,
                    fieldsChanged: Object.keys(updateData),
                    oldValues: {
                        customerName: editingOrder.customerName || "",
                        price: editingOrder.price || 0,
                    },
                    newValues: {
                        customerName: editCustomerName || "",
                        price: editPrice || 0,
                    },
                    verifiedByOtp: false,
                }
            ];

            await updateOrder(editingOrder.orderId, updateData);

            setToast({ message: "Order updated successfully!", type: "success" });
            setEditingOrder(null);
            await loadOrders();
        } catch (error) {
            console.error("Failed to update order:", error);
            setToast({ message: "Failed to update order", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="card text-center py-12">
                <Package className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No orders yet</p>
            </div>
        );
    }

    // Edit Modal
    if (editingOrder) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                    {/* Modal Header */}
                    <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
                        <div className="flex items-center space-x-3">
                            <Edit className="w-6 h-6 text-indigo-600" />
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                Edit Order #{editingOrder.orderId.slice(0, 8)}...
                            </h2>
                        </div>
                        <button
                            onClick={cancelEditing}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Customer Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Customer Name *</label>
                                <input
                                    type="text"
                                    value={editCustomerName}
                                    onChange={(e) => setEditCustomerName(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">Phone Number *</label>
                                <input
                                    type="tel"
                                    value={editCustomerPhone}
                                    onChange={(e) => setEditCustomerPhone(e.target.value.replace(/\D/g, ""))}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="col-span-1">
                                <label className="label">Address</label>
                                <input
                                    type="text"
                                    value={editCustomerAddress}
                                    onChange={(e) => setEditCustomerAddress(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div>
                                <label className="label">Due Date *</label>
                                <input
                                    type="date"
                                    value={editDueDate}
                                    onChange={(e) => setEditDueDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label">Design Notes (Overall)</label>
                            <textarea
                                value={editDesignNotes}
                                onChange={(e) => setEditDesignNotes(e.target.value)}
                                className="input"
                                rows={2}
                            />
                        </div>

                        {/* Pricing */}
                        <div className="border-t pt-4">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center space-x-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                <span>Pricing & Costs (Global Totals)</span>
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div>
                                    <label className="label text-xs">Total Price (₹)</label>
                                    <input
                                        type="number"
                                        value={editPrice || ""}
                                        onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label text-xs">Advance (₹)</label>
                                    <input
                                        type="number"
                                        value={editAdvanceAmount || ""}
                                        onChange={(e) => setEditAdvanceAmount(parseFloat(e.target.value) || 0)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label text-xs">Material Cost (₹)</label>
                                    <input
                                        type="number"
                                        value={editMaterialCost || ""}
                                        onChange={(e) => setEditMaterialCost(parseFloat(e.target.value) || 0)}
                                        className="input"
                                    />
                                </div>
                                <div>
                                    <label className="label text-xs">Labour Cost (₹)</label>
                                    <input
                                        type="number"
                                        value={editLabourCost || ""}
                                        onChange={(e) => setEditLabourCost(parseFloat(e.target.value) || 0)}
                                        className="input"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Note about items */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700/30">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <span>
                                    To edit individual items, measurements, or garment details, please use the specific workflow stage pages.
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 px-6 py-4 flex space-x-3 z-10">
                        <button
                            onClick={cancelEditing}
                            className="flex-1 btn btn-outline"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveChanges}
                            disabled={saving}
                            className="flex-1 btn btn-primary flex items-center justify-center space-x-2"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Filter Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {filterByDate(orders, dateFilter, (o) => o.createdAt?.toDate()).length} orders
                </p>
                <DateFilter onFilterChange={setDateFilter} />
            </div>

            {filterByDate(orders, dateFilter, (o) => o.createdAt?.toDate()).map((order) => (
                <div key={order.orderId} className="card hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {order.customerName}
                                </span>
                                <span
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === "confirmed_locked"
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                        : order.status === "otp_sent"
                                            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                            : order.status === "in_progress"
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                        }`}
                                >
                                    {order.status.replace(/_/g, " ")}
                                </span>
                                {/* Removed Stage Badge as items may have different stages */}
                                {order.currentStage && (
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                                        Status: {order.overallStatus || order.currentStage}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-gray-600 dark:text-gray-400">
                                <div className="flex items-center space-x-1">
                                    <Phone className="w-4 h-4" />
                                    <span>{order.customerPhone}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Package className="w-4 h-4" />
                                    <span className="capitalize">
                                        {order.items && order.items.length > 0
                                            ? `${order.items.length} Items`
                                            : (order.garmentType ? order.garmentType.replace(/_/g, " ") : "No Items")}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>Due: {order.dueDate?.toDate().toLocaleDateString()}</span>
                                </div>
                                {order.price !== undefined && order.price > 0 && (
                                    <div className="flex items-center space-x-1 text-green-600">
                                        <DollarSign className="w-4 h-4" />
                                        <span>₹{order.price}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-2 text-xs text-gray-500 flex gap-4">
                                <span>Created: {order.createdAt?.toDate().toLocaleDateString()}</span>
                                {order.items && order.items.length > 0 && (
                                    <span className="flex items-center gap-1 text-indigo-600">
                                        <List className="w-3 h-3" />
                                        {order.items.map(i => i.garmentType).join(", ")}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Edit Button */}
                        {canEdit(order) && (
                            <button
                                onClick={() => startEditing(order)}
                                className="ml-4 p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg flex items-center space-x-1"
                                title="Edit Order"
                            >
                                <Edit className="w-4 h-4" />
                                <span className="text-sm hidden sm:inline">Edit Details</span>
                            </button>
                        )}

                        {!canEdit(order) && order.currentStage !== "intake" && (
                            <div className="ml-4 p-2 text-gray-400" title="Cannot edit - Order has moved past intake">
                                <AlertCircle className="w-4 h-4" />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
