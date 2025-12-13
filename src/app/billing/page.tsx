"use client";

import { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Order, OrderBilling } from "@/types";
import { Calculator, DollarSign, Check, Download } from "lucide-react";
import Toast from "@/components/Toast";

export default function BillingPage() {
    const { userData } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Billing form state
    const [markingCharges, setMarkingCharges] = useState(0);
    const [cuttingCharges, setCuttingCharges] = useState(0);
    const [stitchingCharges, setStitchingCharges] = useState(0);
    const [hooksCharges, setHooksCharges] = useState(0);
    const [ironingCharges, setIroningCharges] = useState(0);
    const [extraWorkCharges, setExtraWorkCharges] = useState(0);
    const [materialsCost, setMaterialsCost] = useState(0);
    const [discountEnabled, setDiscountEnabled] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [amountReceived, setAmountReceived] = useState(0);
    const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "other">("cash");

    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        try {
            const ordersRef = collection(db, "orders");
            const q = query(
                ordersRef,
                where("currentStage", "==", "billing"),
                where("status", "in", ["confirmed_locked", "in_progress"])
            );

            const snapshot = await getDocs(q);
            const ordersData = snapshot.docs.map((doc) => doc.data() as Order);
            setOrders(ordersData);
        } catch (error) {
            console.error("Failed to load orders:", error);
            setToast({ message: "Failed to load orders", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const totalAmount =
        markingCharges +
        cuttingCharges +
        stitchingCharges +
        hooksCharges +
        ironingCharges +
        extraWorkCharges +
        materialsCost;

    const finalAmount = discountEnabled ? totalAmount - discountAmount : totalAmount;
    const balance = finalAmount - amountReceived;

    const paymentStatus: "paid" | "partially_paid" | "not_paid" =
        balance === 0 ? "paid" : amountReceived > 0 ? "partially_paid" : "not_paid";

    const handleSelectOrder = (order: Order) => {
        setSelectedOrder(order);

        // Load existing billing data if present
        if (order.billing) {
            setMarkingCharges(order.billing.markingCharges);
            setCuttingCharges(order.billing.cuttingCharges);
            setStitchingCharges(order.billing.stitchingCharges);
            setHooksCharges(order.billing.hooksCharges);
            setIroningCharges(order.billing.ironingCharges);
            setExtraWorkCharges(order.billing.extraWorkCharges);
            setMaterialsCost(order.billing.materialsCost);
            setDiscountEnabled(order.billing.discountEnabled);
            setDiscountAmount(order.billing.discountAmount);
            setAmountReceived(order.billing.amountReceived);
            setPaymentMode(order.billing.paymentMode);
        } else {
            // Reset form
            setMarkingCharges(0);
            setCuttingCharges(0);
            setStitchingCharges(0);
            setHooksCharges(0);
            setIroningCharges(0);
            setExtraWorkCharges(0);
            setMaterialsCost(0);
            setDiscountEnabled(false);
            setDiscountAmount(0);
            setAmountReceived(0);
            setPaymentMode("cash");
        }
    };

    const handleSaveBilling = async () => {
        if (!selectedOrder || !userData) return;

        const billingData: OrderBilling = {
            markingCharges,
            cuttingCharges,
            stitchingCharges,
            hooksCharges,
            ironingCharges,
            extraWorkCharges,
            materialsCost,
            totalAmount,
            discountEnabled,
            discountAmount,
            finalAmount,
            amountReceived,
            balance,
            paymentStatus,
            paymentMode,
            billedByStaffId: userData.staffId,
            billedAt: Timestamp.now(),
        };

        try {
            await updateDoc(doc(db, "orders", selectedOrder.orderId), {
                billing: billingData,
            });

            setToast({ message: "Billing saved successfully!", type: "success" });
            loadOrders();
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to save billing", type: "error" });
        }
    };

    const handleMarkDelivered = async () => {
        if (!selectedOrder) return;

        try {
            await updateDoc(doc(db, "orders", selectedOrder.orderId), {
                status: "delivered",
            });

            setToast({ message: "Order marked as delivered!", type: "success" });
            setSelectedOrder(null);
            loadOrders();
        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to mark as delivered", type: "error" });
        }
    };

    if (loading) {
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
                            Billing
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Process billing and payments for completed orders
                        </p>
                    </div>

                    {!selectedOrder ? (
                        <div className="space-y-4">
                            {orders.length === 0 ? (
                                <div className="card text-center py-12">
                                    <DollarSign className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400">No orders ready for billing</p>
                                </div>
                            ) : (
                                orders.map((order) => (
                                    <div
                                        key={order.orderId}
                                        onClick={() => handleSelectOrder(order)}
                                        className="card hover:shadow-lg transition-shadow cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-white">
                                                    {order.customerName}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                                    {order.customerPhone} • {order.customerId}
                                                </p>
                                                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                                                    {order.garmentType.replace(/_/g, " ")}
                                                </p>
                                            </div>
                                            {order.billing && (
                                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
                                                    Billed
                                                </span>
                                            )}
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

                            {/* Order Summary */}
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                                    Order Summary
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Customer Name</p>
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
                                        <p className="text-gray-600 dark:text-gray-400">Garment Type</p>
                                        <p className="font-semibold text-gray-900 dark:text-white capitalize">
                                            {selectedOrder.garmentType.replace(/_/g, " ")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">Order ID</p>
                                        <p className="font-semibold text-gray-900 dark:text-white text-xs">
                                            {selectedOrder.orderId}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Billing Form */}
                            <div className="card">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                                    <Calculator className="w-5 h-5 mr-2" />
                                    Billing Details
                                </h2>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="label">Marking Charges</label>
                                            <input
                                                type="number"
                                                value={markingCharges}
                                                onChange={(e) => setMarkingCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Cutting Charges</label>
                                            <input
                                                type="number"
                                                value={cuttingCharges}
                                                onChange={(e) => setCuttingCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Stitching Charges</label>
                                            <input
                                                type="number"
                                                value={stitchingCharges}
                                                onChange={(e) => setStitchingCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Hooks Charges</label>
                                            <input
                                                type="number"
                                                value={hooksCharges}
                                                onChange={(e) => setHooksCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Ironing Charges</label>
                                            <input
                                                type="number"
                                                value={ironingCharges}
                                                onChange={(e) => setIroningCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Extra Work</label>
                                            <input
                                                type="number"
                                                value={extraWorkCharges}
                                                onChange={(e) => setExtraWorkCharges(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                        <div>
                                            <label className="label">Materials Cost</label>
                                            <input
                                                type="number"
                                                value={materialsCost}
                                                onChange={(e) => setMaterialsCost(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                            />
                                        </div>
                                    </div>

                                    {/* Total Amount */}
                                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                                        <div className="flex justify-between items-center text-lg">
                                            <span className="font-semibold text-gray-900 dark:text-white">Total Amount:</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                ₹{totalAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Discount */}
                                    <div>
                                        <label className="flex items-center space-x-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={discountEnabled}
                                                onChange={(e) => setDiscountEnabled(e.target.checked)}
                                                className="w-4 h-4 text-indigo-600 rounded"
                                            />
                                            <span className="label mb-0">Enable Discount</span>
                                        </label>
                                        {discountEnabled && (
                                            <input
                                                type="number"
                                                value={discountAmount}
                                                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                                                className="input mt-2"
                                                placeholder="Discount amount"
                                                min="0"
                                                max={totalAmount}
                                            />
                                        )}
                                    </div>

                                    {/* Final Amount */}
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border-2 border-indigo-200 dark:border-indigo-800">
                                        <div className="flex justify-between items-center text-xl">
                                            <span className="font-bold text-gray-900 dark:text-white">Final Amount:</span>
                                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                                ₹{finalAmount.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Payment */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="label">Amount Received</label>
                                            <input
                                                type="number"
                                                value={amountReceived}
                                                onChange={(e) => setAmountReceived(Number(e.target.value))}
                                                className="input"
                                                min="0"
                                                max={finalAmount}
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

                                    {/* Balance */}
                                    <div
                                        className={`rounded-lg p-4 ${balance === 0
                                                ? "bg-green-50 dark:bg-green-900/20"
                                                : "bg-yellow-50 dark:bg-yellow-900/20"
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-semibold text-gray-900 dark:text-white">Balance:</span>
                                            <span className="font-bold text-lg">₹{balance.toFixed(2)}</span>
                                        </div>
                                        <p className="text-sm mt-1">
                                            Status:{" "}
                                            <span className="font-medium capitalize">{paymentStatus.replace(/_/g, " ")}</span>
                                        </p>
                                    </div>

                                    <div className="flex space-x-3">
                                        <button
                                            onClick={handleSaveBilling}
                                            className="flex-1 btn btn-primary"
                                        >
                                            Save Billing
                                        </button>
                                        {selectedOrder.billing && paymentStatus === "paid" && (
                                            <button
                                                onClick={handleMarkDelivered}
                                                className="flex-1 btn bg-green-600 text-white hover:bg-green-700"
                                            >
                                                <Check className="w-5 h-5 mr-2" />
                                                Mark Delivered
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
