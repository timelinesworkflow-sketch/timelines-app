"use client";

// Prevent static prerendering to avoid jsPDF "self is not defined" error
export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderBilling, BillLineItem, BILL_PARTICULARS, BillStatus, getGarmentDisplayName } from "@/types";
import {
    Calculator,
    DollarSign,
    Check,
    Clock,
    Truck,
    FileText,
    Plus,
    Trash2,
    X,
    ChevronDown,
    ChevronUp,
    History,
    Download
} from "lucide-react";
import Toast from "@/components/Toast";
import BillTemplate from "@/components/billing/BillTemplate";
// NOTE: html2pdf is dynamically imported below to avoid "self is not defined" during SSR/build

type TabType = "create" | "pending" | "paid" | "delivered";

// Generate bill number
const generateBillNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `BILL-${year}${month}${day}-${random}`;
};

export default function BillingPage() {
    const { userData } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>("create");
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Line items state
    const [lineItems, setLineItems] = useState<BillLineItem[]>([]);

    // Legacy charges (for backward compatibility)
    const [markingCharges, setMarkingCharges] = useState(0);
    const [cuttingCharges, setCuttingCharges] = useState(0);
    const [stitchingCharges, setStitchingCharges] = useState(0);
    const [hooksCharges, setHooksCharges] = useState(0);
    const [ironingCharges, setIroningCharges] = useState(0);
    const [extraWorkCharges, setExtraWorkCharges] = useState(0);
    const [materialsCost, setMaterialsCost] = useState(0);

    // Payment state
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [advancePaid, setAdvancePaid] = useState(0);
    const [amountReceived, setAmountReceived] = useState(0);
    const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "other">("cash");
    const [deliveryNotes, setDeliveryNotes] = useState("");

    // Show/hide line items section
    const [showLineItems, setShowLineItems] = useState(true);

    // Bill template ref for PDF generation
    const billTemplateRef = useRef<HTMLDivElement>(null);
    const [showBillPreview, setShowBillPreview] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);


    useEffect(() => {
        loadOrders();
    }, [activeTab]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const ordersRef = collection(db, "orders");
            let q;

            switch (activeTab) {
                case "create":
                    // Orders at billing stage without bill generated
                    q = query(
                        ordersRef,
                        where("currentStage", "==", "billing"),
                        where("status", "in", ["confirmed_locked", "in_progress"])
                    );
                    break;
                case "pending":
                    // Bills generated but not fully paid
                    q = query(
                        ordersRef,
                        where("billing.status", "in", ["generated", "draft"])
                    );
                    break;
                case "paid":
                    // Bills paid but not delivered
                    q = query(
                        ordersRef,
                        where("billing.status", "==", "paid")
                    );
                    break;
                case "delivered":
                    // Delivered orders (history)
                    q = query(
                        ordersRef,
                        where("status", "==", "delivered")
                    );
                    break;
                default:
                    q = query(ordersRef, where("currentStage", "==", "billing"));
            }

            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map((docSnap) => ({
                ...docSnap.data(),
                orderId: docSnap.id
            } as Order));

            // Sort by date (newest first for history)
            if (activeTab === "delivered") {
                ordersData.sort((a, b) => {
                    const dateA = a.billing?.deliveredAt?.toMillis() || 0;
                    const dateB = b.billing?.deliveredAt?.toMillis() || 0;
                    return dateB - dateA;
                });
            }

            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    // Calculate subtotal from line items
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);

    // Legacy total (for backward compatibility)
    const legacyTotal = markingCharges + cuttingCharges + stitchingCharges +
        hooksCharges + ironingCharges + extraWorkCharges + materialsCost;

    const totalAmount = subtotal + legacyTotal;
    const finalAmount = discountEnabled ? totalAmount - discountAmount : totalAmount;
    const balance = finalAmount - amountReceived - advancePaid;

    const paymentStatus: "paid" | "partially_paid" | "not_paid" =
        balance <= 0 ? "paid" : (amountReceived + advancePaid) > 0 ? "partially_paid" : "not_paid";

    const handleSelectOrder = (order: Order) => {
        setSelectedOrder(order);

        if (order.billing) {
            // Load existing billing data
            setLineItems(order.billing.lineItems || []);
            setMarkingCharges(order.billing.markingCharges || 0);
            setCuttingCharges(order.billing.cuttingCharges || 0);
            setStitchingCharges(order.billing.stitchingCharges || 0);
            setHooksCharges(order.billing.hooksCharges || 0);
            setIroningCharges(order.billing.ironingCharges || 0);
            setExtraWorkCharges(order.billing.extraWorkCharges || 0);
            setMaterialsCost(order.billing.materialsCost || 0);
            setDiscountEnabled(order.billing.discountEnabled || false);
            setDiscountAmount(order.billing.discountAmount || 0);
            setAdvancePaid(order.billing.advancePaid || order.advanceAmount || 0);
            setAmountReceived(order.billing.amountReceived || 0);
            setPaymentMode(order.billing.paymentMode || "cash");
        } else {
            // Reset form with order defaults
            setLineItems([]);
            setMarkingCharges(0);
            setCuttingCharges(0);
            setStitchingCharges(0);
            setHooksCharges(0);
            setIroningCharges(0);
            setExtraWorkCharges(0);
            setMaterialsCost(order.materialCost || 0);
            setDiscountEnabled(false);
            setDiscountAmount(0);
            setAdvancePaid(order.advanceAmount || 0);
            setAmountReceived(0);
            setPaymentMode("cash");
        }
    };

    const addLineItem = () => {
        const newItem: BillLineItem = {
            sno: lineItems.length + 1,
            particular: BILL_PARTICULARS[0],
            qty: 1,
            price: 0,
            total: 0
        };
        setLineItems([...lineItems, newItem]);
    };

    const updateLineItem = (index: number, field: keyof BillLineItem, value: string | number) => {
        const updated = [...lineItems];
        if (field === 'particular') {
            updated[index].particular = value as string;
        } else if (field === 'qty' || field === 'price') {
            updated[index][field] = Number(value);
            updated[index].total = updated[index].qty * updated[index].price;
        }
        setLineItems(updated);
    };

    const removeLineItem = (index: number) => {
        const updated = lineItems.filter((_, i) => i !== index);
        // Renumber
        updated.forEach((item, i) => item.sno = i + 1);
        setLineItems(updated);
    };

    const handleSaveBilling = async (markAsPaid: boolean = false) => {
        if (!selectedOrder || !userData) return;

        setSaving(true);
        try {
            const billStatus: BillStatus = markAsPaid && paymentStatus === "paid"
                ? "paid"
                : selectedOrder.billing?.billNumber
                    ? "generated"
                    : "draft";

            const billingData: OrderBilling = {
                billNumber: selectedOrder.billing?.billNumber || generateBillNumber(),
                billDate: selectedOrder.billing?.billDate || Timestamp.now(),
                lineItems,
                markingCharges,
                cuttingCharges,
                stitchingCharges,
                hooksCharges,
                ironingCharges,
                extraWorkCharges,
                materialsCost,
                subtotal,
                totalAmount,
                discountEnabled,
                discountAmount,
                finalAmount,
                amountReceived,
                advancePaid,
                balance,
                paymentStatus,
                paymentMode,
                status: billStatus,
                billedByStaffId: userData.staffId,
                billedByStaffName: userData.name,
                billedAt: selectedOrder.billing?.billedAt || Timestamp.now(),
                ...(markAsPaid && paymentStatus === "paid" ? {
                    paidAt: Timestamp.now(),
                    paidReceivedByStaffId: userData.staffId,
                    paidReceivedByStaffName: userData.name
                } : {})
            };

            await updateDoc(doc(db, "orders", selectedOrder.orderId), {
                billing: billingData,
            });

            setToast({
                message: markAsPaid ? "Bill paid and saved!" : "Billing saved successfully!",
                type: "success"
            });
            setSelectedOrder(null);
            loadOrders();
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to save billing", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const handleMarkDelivered = async () => {
        if (!selectedOrder || !userData) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, "orders", selectedOrder.orderId), {
                status: "delivered",
                "billing.status": "delivered",
                "billing.deliveredAt": Timestamp.now(),
                "billing.deliveredByStaffId": userData.staffId,
                "billing.deliveredByStaffName": userData.name,
                "billing.deliveryNotes": deliveryNotes
            });

            setToast({ message: "Order marked as delivered!", type: "success" });
            setSelectedOrder(null);
            loadOrders();
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to mark as delivered", type: "error" });
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: "create" as TabType, label: "Create Bill", icon: FileText, color: "indigo" },
        { id: "pending" as TabType, label: "Pending", icon: Clock, color: "yellow" },
        { id: "paid" as TabType, label: "Paid", icon: DollarSign, color: "green" },
        { id: "delivered" as TabType, label: "Delivered", icon: Truck, color: "blue" },
    ];

    const getTabCount = (tabId: TabType) => {
        // This would ideally be fetched from backend, but for now return based on loaded orders
        if (tabId === activeTab) return orders.length;
        return 0;
    };

    if (loading && !selectedOrder) {
        return (
            <ProtectedRoute allowedRoles={["billing", "supervisor", "admin"]}>
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
        <ProtectedRoute allowedRoles={["billing", "supervisor", "admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="page-content">
                    <div className="mb-6">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Billing & Accounts
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Create bills, track payments, and manage deliveries
                        </p>
                    </div>

                    {/* Tabs */}
                    {!selectedOrder && (
                        <div className="flex space-x-1 bg-gray-100 dark:bg-slate-800 p-1 rounded-xl mb-6 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow"
                                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    {tab.label}
                                    {activeTab === tab.id && orders.length > 0 && (
                                        <span className="ml-1 px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full">
                                            {orders.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {!selectedOrder ? (
                        <div className="space-y-4">
                            {orders.length === 0 ? (
                                <div className="card text-center py-12">
                                    {activeTab === "create" && <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />}
                                    {activeTab === "pending" && <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />}
                                    {activeTab === "paid" && <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />}
                                    {activeTab === "delivered" && <History className="w-16 h-16 mx-auto text-gray-400 mb-4" />}
                                    <p className="text-gray-600 dark:text-gray-400">
                                        {activeTab === "create" && "No orders ready for billing"}
                                        {activeTab === "pending" && "No pending payments"}
                                        {activeTab === "paid" && "No orders waiting for delivery"}
                                        {activeTab === "delivered" && "No delivered orders yet"}
                                    </p>
                                </div>
                            ) : (
                                orders.map((order) => (
                                    <div
                                        key={order.orderId}
                                        onClick={() => handleSelectOrder(order)}
                                        className="card hover:shadow-lg transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <p className="font-semibold text-gray-900 dark:text-white">
                                                        {order.customerName}
                                                    </p>
                                                    {order.billing?.billNumber && (
                                                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                                                            {order.billing.billNumber}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {order.customerPhone} • {getGarmentDisplayName(order)}
                                                </p>
                                                {order.billing && (
                                                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1">
                                                        ₹{order.billing.finalAmount?.toFixed(2) || order.billing.totalAmount?.toFixed(2)}
                                                        {order.billing.balance > 0 && (
                                                            <span className="text-red-600 dark:text-red-400 ml-2">
                                                                (Bal: ₹{order.billing.balance.toFixed(2)})
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {order.billing?.status === "paid" && (
                                                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
                                                        Paid ✓
                                                    </span>
                                                )}
                                                {order.billing?.status === "delivered" && (
                                                    <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                                        Delivered ✓
                                                    </span>
                                                )}
                                                {order.billing?.deliveredAt && (
                                                    <span className="text-xs text-gray-500">
                                                        {order.billing.deliveredAt.toDate().toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="btn btn-outline"
                            >
                                ← Back to List
                            </button>

                            {/* Order Summary Card */}
                            <div className="card">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Order Summary
                                    </h2>
                                    {selectedOrder.billing?.billNumber && (
                                        <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium">
                                            {selectedOrder.billing.billNumber}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Customer</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {selectedOrder.customerName}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Phone</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {selectedOrder.customerPhone}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Garment</p>
                                        <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                            {getGarmentDisplayName(selectedOrder)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Items</p>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {selectedOrder.items?.length || 1}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Line Items Section */}
                            <div className="card">
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setShowLineItems(!showLineItems)}
                                >
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                        <Calculator className="w-5 h-5" />
                                        Bill Line Items
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">
                                            {lineItems.length} items • ₹{subtotal.toFixed(2)}
                                        </span>
                                        {showLineItems ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                </div>

                                {showLineItems && (
                                    <div className="mt-4">
                                        {/* Line Items Table */}
                                        {lineItems.length > 0 && (
                                            <div className="overflow-x-auto mb-4">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 dark:bg-slate-700">
                                                        <tr>
                                                            <th className="px-3 py-2 text-left">#</th>
                                                            <th className="px-3 py-2 text-left">Particular</th>
                                                            <th className="px-3 py-2 text-center w-20">Qty</th>
                                                            <th className="px-3 py-2 text-right w-24">Price</th>
                                                            <th className="px-3 py-2 text-right w-24">Total</th>
                                                            <th className="px-3 py-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {lineItems.map((item, index) => (
                                                            <tr key={index} className="border-b dark:border-slate-700">
                                                                <td className="px-3 py-2">{item.sno}</td>
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={item.particular}
                                                                        onChange={(e) => updateLineItem(index, 'particular', e.target.value)}
                                                                        className="input py-1 text-sm"
                                                                    >
                                                                        {BILL_PARTICULARS.map((p) => (
                                                                            <option key={p} value={p}>{p}</option>
                                                                        ))}
                                                                    </select>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="number"
                                                                        value={item.qty}
                                                                        onChange={(e) => updateLineItem(index, 'qty', e.target.value)}
                                                                        className="input py-1 text-sm text-center w-16"
                                                                        min="1"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="number"
                                                                        value={item.price}
                                                                        onChange={(e) => updateLineItem(index, 'price', e.target.value)}
                                                                        className="input py-1 text-sm text-right w-20"
                                                                        min="0"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-medium">
                                                                    ₹{item.total.toFixed(2)}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <button
                                                                        onClick={() => removeLineItem(index)}
                                                                        className="text-red-500 hover:text-red-700"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        <button
                                            onClick={addLineItem}
                                            className="btn btn-outline text-sm flex items-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Line Item
                                        </button>

                                        {/* Subtotal */}
                                        {lineItems.length > 0 && (
                                            <div className="mt-4 pt-4 border-t dark:border-slate-700 flex justify-end">
                                                <div className="text-right">
                                                    <span className="text-gray-600 dark:text-gray-400 mr-4">Line Items Subtotal:</span>
                                                    <span className="font-bold text-lg">₹{subtotal.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Additional Charges */}
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Additional Charges
                                </h2>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                    <div>
                                        <label className="label text-xs">Marking</label>
                                        <input
                                            type="number"
                                            value={markingCharges}
                                            onChange={(e) => setMarkingCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Cutting</label>
                                        <input
                                            type="number"
                                            value={cuttingCharges}
                                            onChange={(e) => setCuttingCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Stitching</label>
                                        <input
                                            type="number"
                                            value={stitchingCharges}
                                            onChange={(e) => setStitchingCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Hooks</label>
                                        <input
                                            type="number"
                                            value={hooksCharges}
                                            onChange={(e) => setHooksCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Ironing</label>
                                        <input
                                            type="number"
                                            value={ironingCharges}
                                            onChange={(e) => setIroningCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Extra Work</label>
                                        <input
                                            type="number"
                                            value={extraWorkCharges}
                                            onChange={(e) => setExtraWorkCharges(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label text-xs">Materials</label>
                                        <input
                                            type="number"
                                            value={materialsCost}
                                            onChange={(e) => setMaterialsCost(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Payment Details
                                </h2>

                                {/* Total Display */}
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4">
                                    <div className="flex justify-between items-center text-xl">
                                        <span className="font-bold text-gray-900 dark:text-white">Total Amount:</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                            ₹{totalAmount.toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                {/* Discount */}
                                <div className="mb-4">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={discountEnabled}
                                            onChange={(e) => setDiscountEnabled(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 rounded"
                                        />
                                        <span className="text-sm font-medium">Apply Discount</span>
                                    </label>
                                    {discountEnabled && (
                                        <input
                                            type="number"
                                            value={discountAmount}
                                            onChange={(e) => setDiscountAmount(Number(e.target.value))}
                                            className="input mt-2 w-32"
                                            placeholder="Discount"
                                            min="0"
                                            max={totalAmount}
                                        />
                                    )}
                                </div>

                                {/* Final Amount */}
                                {discountEnabled && (
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4">
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold">Final Amount:</span>
                                            <span className="font-bold text-green-600">₹{finalAmount.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="label">Advance Paid</label>
                                        <input
                                            type="number"
                                            value={advancePaid}
                                            onChange={(e) => setAdvancePaid(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Amount Received</label>
                                        <input
                                            type="number"
                                            value={amountReceived}
                                            onChange={(e) => setAmountReceived(Number(e.target.value))}
                                            className="input"
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Payment Mode</label>
                                        <select
                                            value={paymentMode}
                                            onChange={(e) => setPaymentMode(e.target.value as any)}
                                            className="input"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="upi">UPI</option>
                                            <option value="card">Card</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Balance Display */}
                                <div className={`rounded-lg p-4 ${balance <= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold">Balance Due:</span>
                                        <span className={`font-bold text-lg ${balance <= 0 ? "text-green-600" : "text-red-600"
                                            }`}>
                                            ₹{Math.max(0, balance).toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-sm mt-1 capitalize">
                                        Status: <span className="font-medium">{paymentStatus.replace(/_/g, " ")}</span>
                                    </p>
                                </div>

                                {/* Delivery Notes (for paid orders) */}
                                {selectedOrder.billing?.status === "paid" && (
                                    <div className="mt-4">
                                        <label className="label">Delivery Notes (optional)</label>
                                        <textarea
                                            value={deliveryNotes}
                                            onChange={(e) => setDeliveryNotes(e.target.value)}
                                            className="input"
                                            rows={2}
                                            placeholder="Any notes for delivery..."
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={() => handleSaveBilling(false)}
                                    disabled={saving}
                                    className="flex-1 btn btn-primary"
                                >
                                    {saving ? "Saving..." : "Save Bill"}
                                </button>

                                {paymentStatus === "paid" && selectedOrder.billing?.status !== "paid" && (
                                    <button
                                        onClick={() => handleSaveBilling(true)}
                                        disabled={saving}
                                        className="flex-1 btn bg-green-600 text-white hover:bg-green-700"
                                    >
                                        <Check className="w-5 h-5 mr-2" />
                                        {saving ? "Saving..." : "Mark as Paid"}
                                    </button>
                                )}

                                {selectedOrder.billing?.status === "paid" && (
                                    <button
                                        onClick={handleMarkDelivered}
                                        disabled={saving}
                                        className="flex-1 btn bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        <Truck className="w-5 h-5 mr-2" />
                                        {saving ? "Saving..." : "Mark Delivered"}
                                    </button>
                                )}

                                {/* Download Bill Button - shows when paid */}
                                {(selectedOrder.billing?.status === "paid" || selectedOrder.billing?.status === "delivered") && (
                                    <button
                                        onClick={() => setShowBillPreview(true)}
                                        disabled={generatingPdf}
                                        className="flex-1 btn bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                                    >
                                        <Download className="w-5 h-5 mr-2" />
                                        {generatingPdf ? "Generating..." : "Download Bill"}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hidden Bill Template for PDF Generation */}
            {showBillPreview && selectedOrder && (
                <div className="fixed inset-0 bg-black/80 z-50 overflow-auto">
                    <div className="min-h-screen flex flex-col items-center py-8">
                        {/* Close and Download buttons */}
                        <div className="flex gap-4 mb-4">
                            <button
                                onClick={() => setShowBillPreview(false)}
                                className="btn bg-slate-600 text-white hover:bg-slate-700"
                            >
                                <X className="w-5 h-5 mr-2" />
                                Close
                            </button>
                            <button
                                onClick={async () => {
                                    if (!billTemplateRef.current) return;
                                    setGeneratingPdf(true);
                                    try {
                                        const opt = {
                                            margin: 0,
                                            filename: `TIMELINES_BILL_${selectedOrder.billing?.billNumber || selectedOrder.orderId.slice(-8)}.pdf`,
                                            image: { type: 'jpeg' as const, quality: 0.98 },
                                            html2canvas: { scale: 2, useCORS: true },
                                            jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                                        };
                                        // Dynamic import to avoid "self is not defined" during SSR/build
                                        const html2pdfModule = await import("html2pdf.js");
                                        const html2pdf = html2pdfModule.default;
                                        await html2pdf().set(opt).from(billTemplateRef.current).save();
                                        setToast({ message: "Bill downloaded successfully!", type: "success" });
                                    } catch (error) {
                                        console.error("PDF generation failed:", error);
                                        setToast({ message: "Failed to download bill", type: "error" });
                                    } finally {
                                        setGeneratingPdf(false);
                                    }
                                }}
                                disabled={generatingPdf}
                                className="btn bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                                <Download className="w-5 h-5 mr-2" />
                                {generatingPdf ? "Generating PDF..." : "Download PDF"}
                            </button>
                        </div>

                        {/* Bill Template */}
                        <BillTemplate
                            ref={billTemplateRef}
                            customerName={selectedOrder.customerName}
                            customerPhone={selectedOrder.customerPhone}
                            customerAddress={selectedOrder.customerAddress || ""}
                            billNumber={selectedOrder.billing?.billNumber || selectedOrder.orderId.slice(-8).toUpperCase()}
                            billDate={selectedOrder.billing?.paidAt?.toDate?.()?.toLocaleDateString("en-IN") || new Date().toLocaleDateString("en-IN")}
                            items={(selectedOrder.billing?.lineItems || []).map((item, i) => ({
                                sno: item.sno || i + 1,
                                particular: item.particular,
                                qty: item.qty,
                                price: item.price,
                                total: item.total
                            }))}
                            totalAmount={selectedOrder.billing?.finalAmount || selectedOrder.billing?.totalAmount || 0}
                            paidAmount={(selectedOrder.billing?.advancePaid || 0) + (selectedOrder.billing?.amountReceived || 0)}
                            balanceAmount={Math.max(selectedOrder.billing?.balance || 0, 0)}
                        />
                    </div>
                </div>
            )}

        </ProtectedRoute>
    );
}
