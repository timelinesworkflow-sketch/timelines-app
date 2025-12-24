"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, Order, PlannedMaterial, OrderItem } from "@/types";
import { createOrder, updateOrder, addTimelineEntry } from "@/lib/orders";
import { getOrCreateCustomer, getOrdersByCustomerPhone, updateCustomerOnNewOrder } from "@/lib/customers";
import { uploadImages } from "@/lib/storage";
import { createEmptyItem, computeOverallStatus, calculateItemsTotals } from "@/lib/orderItems";
import { Timestamp } from "firebase/firestore";
import { X, Upload, Send, Check, Search, Clock, Package, User, Phone, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import Toast from "@/components/Toast";
import PlannedMaterialsInput from "@/components/PlannedMaterialsInput";

interface CreateOrderFormProps {
    onClose: () => void;
}

export default function CreateOrderForm({ onClose }: CreateOrderFormProps) {
    const { userData } = useAuth();
    const [step, setStep] = useState<"form" | "success">("form");
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Form state
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [garmentType, setGarmentType] = useState<GarmentType>("blouse");
    const [measurements, setMeasurements] = useState<Record<string, string>>({});
    const [activeStages, setActiveStages] = useState<string[]>(["materials", "marking", "cutting", "stitching", "ironing", "billing"]);
    const [samplerFiles, setSamplerFiles] = useState<File[]>([]);
    const [particulars, setParticulars] = useState("");
    const [plannedMaterials, setPlannedMaterials] = useState<PlannedMaterial[]>([]);
    const [loading, setLoading] = useState(false);

    // Measurement Type Toggle: "customer_gives" or "measurement_blouse"
    const [measurementType, setMeasurementType] = useState<"customer_gives" | "measurement_blouse">("customer_gives");

    // Enhanced Image Upload State
    const [imageUploads, setImageUploads] = useState<{
        file: File;
        preview: string;
        description: string;
    }[]>([]);

    // Blouse-specific image sections (only used when measurementType = "measurement_blouse" and garmentType = "blouse")
    const [frontNeckImage, setFrontNeckImage] = useState<{ file: File | null; preview: string; description: string }>({ file: null, preview: "", description: "" });
    const [backNeckImage, setBackNeckImage] = useState<{ file: File | null; preview: string; description: string }>({ file: null, preview: "", description: "" });
    const [sleeveImage, setSleeveImage] = useState<{ file: File | null; preview: string; description: string }>({ file: null, preview: "", description: "" });

    // Multi-item state
    const [orderItems, setOrderItems] = useState<Partial<OrderItem>[]>([createEmptyItem(1, "blouse")]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

    // Additional order fields
    const [clothType, setClothType] = useState("");
    const [designNotes, setDesignNotes] = useState("");
    const [price, setPrice] = useState<number>(0);
    const [advanceAmount, setAdvanceAmount] = useState<number>(0);
    const [materialCost, setMaterialCost] = useState<number>(0);
    const [labourCost, setLabourCost] = useState<number>(0);

    // Customer order history
    const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
    const [showOrderHistory, setShowOrderHistory] = useState(false);

    // RE Work toggle (for RE Blouse / RE Pavada Sattai categories)
    const [includeREWork, setIncludeREWork] = useState(true);

    // Temp order ID for tracking
    const [tempOrderId, setTempOrderId] = useState("");

    useEffect(() => {
        // Initialize measurements for selected garment type
        const fields = MEASUREMENT_FIELDS[garmentType];
        const initialMeasurements: Record<string, string> = {};
        fields.forEach((field) => {
            initialMeasurements[field] = measurements[field] || "";
        });
        setMeasurements(initialMeasurements);
    }, [garmentType]);

    // Lookup customer orders when phone number changes
    useEffect(() => {
        const lookupCustomerOrders = async () => {
            if (customerPhone.length >= 10) {
                setLoadingCustomerOrders(true);
                try {
                    const orders = await getOrdersByCustomerPhone(customerPhone);
                    setCustomerOrders(orders);
                    if (orders.length > 0) {
                        setShowOrderHistory(true);
                        // Auto-fill customer name and address from previous order
                        if (!customerName && orders[0].customerName) {
                            setCustomerName(orders[0].customerName);
                        }
                        if (!customerAddress && orders[0].customerAddress) {
                            setCustomerAddress(orders[0].customerAddress);
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch customer orders:", error);
                } finally {
                    setLoadingCustomerOrders(false);
                }
            } else {
                setCustomerOrders([]);
                setShowOrderHistory(false);
            }
        };

        const debounce = setTimeout(lookupCustomerOrders, 500);
        return () => clearTimeout(debounce);
    }, [customerPhone]);

    const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSamplerFiles(Array.from(e.target.files).slice(0, 3));
        }
    };

    const handleSubmitForm = async () => {
        if (!customerName || !customerPhone || !dueDate) {
            setToast({ message: "Please fill all required fields", type: "error" });
            return;
        }

        if (customerPhone.length < 10) {
            setToast({ message: "Phone number must be at least 10 digits", type: "error" });
            return;
        }

        setLoading(true);

        try {
            // Upload sampler images
            let samplerUrls: string[] = [];
            try {
                samplerUrls = samplerFiles.length > 0
                    ? await uploadImages(samplerFiles, `orders/temp_${Date.now()}/sampler`)
                    : [];
            } catch (uploadError: any) {
                console.error("Image upload failed:", uploadError);
                let errorMessage = uploadError.message || 'Unknown error';

                if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
                    errorMessage = "Storage Bucket not found. Please enable Storage in Firebase Console.";
                }

                setToast({
                    message: `Upload failed: ${errorMessage}`,
                    type: "error"
                });
                setLoading(false);
                return;
            }

            // Filter valid planned materials
            const validPlannedMaterials = plannedMaterials.filter(
                m => m.materialId.trim() !== "" || m.materialName.trim() !== ""
            );

            // Create or update customer profile
            await getOrCreateCustomer(customerPhone, customerName, customerAddress);

            // Prepare items for the order
            const finalItems = orderItems
                .filter(item => item.itemName && item.itemName.trim() !== "")
                .map(item => ({
                    ...item,
                    itemId: item.itemId || `ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    status: "intake" as const,
                    timeline: [],
                    handledBy: userData?.staffId || "",
                    handledByName: userData?.name || "",
                    deadline: item.deadline || Timestamp.fromDate(new Date(dueDate)),
                })) as OrderItem[];

            // Compute overall status from items
            const { totalItems, completedItems, overallStatus } = computeOverallStatus(finalItems);
            const itemsTotals = calculateItemsTotals(finalItems);

            // Create draft order
            const orderData: Partial<Order> = {
                customerId: `CUST_${Date.now()}`,
                customerName,
                customerPhone,
                customerAddress,
                garmentType,
                measurements,
                dueDate: Timestamp.fromDate(new Date(dueDate)),
                samplerImages: samplerUrls,
                activeStages,
                currentStage: "intake",
                status: "draft",
                assignedStaff: {},
                materialsCostPlanned: null,
                changeHistory: [],
                confirmedAt: null,
                finalProductImages: [],
                // Additional fields
                clothType,
                designNotes,
                price,
                advanceAmount,
                materialCost: itemsTotals.totalMaterialCost || materialCost,
                labourCost: itemsTotals.totalLabourCost || labourCost,
                // Multi-item fields
                items: finalItems,
                totalItems,
                completedItems,
                overallStatus,
                // Planned materials
                plannedMaterials: validPlannedMaterials.length > 0 ? {
                    items: validPlannedMaterials,
                    plannedByStaffId: userData?.staffId || "",
                    plannedByStaffName: userData?.name || "",
                    plannedAt: Timestamp.now(),
                } : undefined,
            };

            const orderId = await createOrder(orderData);
            setTempOrderId(orderId);

            // Update customer stats
            await updateCustomerOnNewOrder(
                customerPhone,
                orderId,
                price,
                labourCost,
                materialCost,
                0 // extra expenses
            );

            // Get the first active workflow stage after intake
            const firstStage = activeStages[0];

            await updateOrder(orderId, {
                confirmedAt: Timestamp.now(),
                status: "in_progress",
                currentStage: firstStage,
            });

            if (userData) {
                await addTimelineEntry(orderId, {
                    staffId: userData.staffId,
                    role: userData.role,
                    stage: "intake",
                    action: "completed"
                });
            }

            setToast({ message: "Order created successfully!", type: "success" });

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error("Order creation error:", error);
            setToast({
                message: `Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`,
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-100 text-green-800";
            case "delivered": return "bg-blue-100 text-blue-800";
            case "in_progress": return "bg-yellow-100 text-yellow-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="card max-w-4xl mx-auto">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create New Order</h2>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-6">
                {/* Customer Information */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label flex items-center space-x-1">
                            <Phone className="w-4 h-4" />
                            <span>Phone Number *</span>
                        </label>
                        <div className="relative">
                            <input
                                type="tel"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                                className="input"
                                placeholder="Enter 10-digit phone number"
                                required
                                maxLength={15}
                            />
                            {loadingCustomerOrders && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                                </div>
                            )}
                        </div>
                        {customerPhone.length > 0 && customerPhone.length < 10 && (
                            <p className="text-xs text-red-500 mt-1 flex items-center space-x-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Phone number must be at least 10 digits</span>
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="label flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>Customer Name *</span>
                        </label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="input"
                            placeholder="Enter customer name"
                            required
                        />
                    </div>
                </div>

                {/* OTHER ORDERS BY THIS CUSTOMER */}
                {showOrderHistory && customerOrders.length > 0 && (
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center space-x-2">
                                <Clock className="w-5 h-5" />
                                <span>Other Orders by This Customer ({customerOrders.length})</span>
                            </h3>
                            <button
                                onClick={() => setShowOrderHistory(false)}
                                className="text-xs text-indigo-600 hover:underline"
                            >
                                Hide
                            </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {customerOrders.map((order) => (
                                <div
                                    key={order.orderId}
                                    className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-indigo-100 dark:border-indigo-800"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                Order #{order.orderId.slice(0, 8)}...
                                            </p>
                                            <p className="text-xs text-gray-500 capitalize">
                                                {order.garmentType.replace(/_/g, " ")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                                                {order.status.replace(/_/g, " ")}
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Stage: {order.currentStage}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                                        <span>Due: {order.dueDate?.toDate().toLocaleDateString()}</span>
                                        <span>Created: {order.createdAt?.toDate().toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {customerPhone.length >= 10 && customerOrders.length === 0 && !loadingCustomerOrders && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <p className="text-sm text-green-700 dark:text-green-400">
                            ✨ This is the first order for this customer!
                        </p>
                    </div>
                )}

                <div>
                    <label className="label">Address</label>
                    <textarea
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="input"
                        rows={2}
                        placeholder="Enter address"
                    />
                </div>

                {/* Due Date - Prominent Position */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
                    <label className="label text-indigo-700 dark:text-indigo-300 font-semibold flex items-center space-x-2">
                        <Clock className="w-4 h-4" />
                        <span>Due Date *</span>
                    </label>
                    <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="input text-lg font-medium"
                        required
                        min={new Date().toISOString().split("T")[0]}
                    />
                </div>

                {/* Product Category / Garment Type */}
                <div>
                    <label className="label">Product Category / Garment Type *</label>
                    <select
                        value={garmentType}
                        onChange={(e) => setGarmentType(e.target.value as GarmentType)}
                        className="input"
                    >
                        <option value="blouse">Blouse</option>
                        <option value="chudi">Chudi</option>
                        <option value="frock">Frock</option>
                        <option value="pavadai_sattai">Pavadai Sattai</option>
                        <option value="re_blouse">RE Blouse</option>
                        <option value="re_pavada_sattai">RE Pavada Sattai</option>
                        <option value="other">Other</option>
                    </select>
                </div>

                {/* RE Work Toggle - Only for RE categories */}
                {(garmentType === "re_blouse" || garmentType === "re_pavada_sattai") && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium text-purple-800 dark:text-purple-300">Include RE Work Stage</label>
                                <p className="text-sm text-purple-600 dark:text-purple-400">RE staff will be included in this order workflow</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIncludeREWork(!includeREWork)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${includeREWork ? "bg-purple-600" : "bg-gray-300"}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${includeREWork ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Measurement Type Toggle */}
                <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <label className="label mb-3">Measurement Type</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="button"
                            onClick={() => setMeasurementType("customer_gives")}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${measurementType === "customer_gives"
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                                }`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <span>📏</span>
                                <span>Customer Gives Measurements</span>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMeasurementType("measurement_blouse")}
                            className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${measurementType === "measurement_blouse"
                                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400"
                                }`}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <span>👕</span>
                                <span>Customer Gives Measurement Blouse</span>
                            </div>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Cloth Type</label>
                        <input
                            type="text"
                            value={clothType}
                            onChange={(e) => setClothType(e.target.value)}
                            className="input"
                            placeholder="e.g., Cotton, Silk, Polyester"
                        />
                    </div>
                    <div>
                        <label className="label">Design Notes</label>
                        <input
                            type="text"
                            value={designNotes}
                            onChange={(e) => setDesignNotes(e.target.value)}
                            className="input"
                            placeholder="Special instructions"
                        />
                    </div>
                </div>

                {/* Pricing Section */}
                <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Pricing & Costs</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <label className="label text-xs">Order Price (₹)</label>
                            <input
                                type="number"
                                value={price || ""}
                                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                className="input"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="label text-xs">Advance (₹)</label>
                            <input
                                type="number"
                                value={advanceAmount || ""}
                                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value) || 0)}
                                className="input"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="label text-xs">Material Cost (₹)</label>
                            <input
                                type="number"
                                value={materialCost || ""}
                                onChange={(e) => setMaterialCost(parseFloat(e.target.value) || 0)}
                                className="input"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="label text-xs">Labour Cost (₹)</label>
                            <input
                                type="number"
                                value={labourCost || ""}
                                onChange={(e) => setLabourCost(parseFloat(e.target.value) || 0)}
                                className="input"
                                placeholder="0"
                                min="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Multi-Item Section */}
                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                            <Package className="w-5 h-5 text-indigo-600" />
                            <span>Order Items ({orderItems.length})</span>
                        </h3>
                        <button
                            type="button"
                            onClick={() => {
                                const newItem = createEmptyItem(orderItems.length + 1, garmentType);
                                newItem.deadline = Timestamp.fromDate(new Date(dueDate || Date.now()));
                                setOrderItems([...orderItems, newItem]);
                                setExpandedItems(new Set([...expandedItems, orderItems.length]));
                            }}
                            className="btn btn-outline text-sm flex items-center space-x-1"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Item</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {orderItems.map((item, index) => (
                            <div
                                key={item.itemId || index}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                            >
                                {/* Item Header */}
                                <div
                                    className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between cursor-pointer"
                                    onClick={() => {
                                        const newExpanded = new Set(expandedItems);
                                        if (newExpanded.has(index)) {
                                            newExpanded.delete(index);
                                        } else {
                                            newExpanded.add(index);
                                        }
                                        setExpandedItems(newExpanded);
                                    }}
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">
                                                {item.itemName || `Item ${index + 1}`}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.garmentType?.replace(/_/g, " ") || garmentType.replace(/_/g, " ")} • Qty: {item.quantity || 1}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {orderItems.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const newItems = orderItems.filter((_, i) => i !== index);
                                                    setOrderItems(newItems);
                                                }}
                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {expandedItems.has(index) ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Item Details (Collapsible) */}
                                {expandedItems.has(index) && (
                                    <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
                                        {/* Row 1: Name, Type, Quantity */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="label text-xs">Item Name *</label>
                                                <input
                                                    type="text"
                                                    value={item.itemName || ""}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = { ...newItems[index], itemName: e.target.value };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                    placeholder="e.g., Blouse, Chudidar"
                                                />
                                            </div>
                                            <div>
                                                <label className="label text-xs">Garment Type</label>
                                                <select
                                                    value={item.garmentType || garmentType}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = { ...newItems[index], garmentType: e.target.value as GarmentType };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                >
                                                    <option value="blouse">Blouse</option>
                                                    <option value="chudi">Chudi</option>
                                                    <option value="frock">Frock</option>
                                                    <option value="pavadai_sattai">Pavadai Sattai</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="label text-xs">Quantity</label>
                                                <input
                                                    type="number"
                                                    value={item.quantity || 1}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = { ...newItems[index], quantity: parseInt(e.target.value) || 1 };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                    min="1"
                                                />
                                            </div>
                                        </div>

                                        {/* Row 2: Costs and Deadline */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="label text-xs">Material Cost (₹)</label>
                                                <input
                                                    type="number"
                                                    value={item.materialCost || ""}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = { ...newItems[index], materialCost: parseFloat(e.target.value) || 0 };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="label text-xs">Labour Cost (₹)</label>
                                                <input
                                                    type="number"
                                                    value={item.labourCost || ""}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = { ...newItems[index], labourCost: parseFloat(e.target.value) || 0 };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                    placeholder="0"
                                                    min="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="label text-xs">Deadline</label>
                                                <input
                                                    type="date"
                                                    value={item.deadline instanceof Timestamp
                                                        ? item.deadline.toDate().toISOString().split("T")[0]
                                                        : dueDate || new Date().toISOString().split("T")[0]}
                                                    onChange={(e) => {
                                                        const newItems = [...orderItems];
                                                        newItems[index] = {
                                                            ...newItems[index],
                                                            deadline: Timestamp.fromDate(new Date(e.target.value))
                                                        };
                                                        setOrderItems(newItems);
                                                    }}
                                                    className="input"
                                                />
                                            </div>
                                        </div>

                                        {/* Design Notes */}
                                        <div>
                                            <label className="label text-xs">Design Notes</label>
                                            <textarea
                                                value={item.designNotes || ""}
                                                onChange={(e) => {
                                                    const newItems = [...orderItems];
                                                    newItems[index] = { ...newItems[index], designNotes: e.target.value };
                                                    setOrderItems(newItems);
                                                }}
                                                className="input"
                                                rows={2}
                                                placeholder="Special instructions, design requirements..."
                                            />
                                        </div>

                                        {/* Item Measurements */}
                                        <div>
                                            <label className="label text-xs mb-2">Item Measurements</label>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                {MEASUREMENT_FIELDS[item.garmentType || garmentType]?.map((field) => (
                                                    <div key={field}>
                                                        <label className="text-xs text-gray-500">
                                                            {MEASUREMENT_LABELS[field] || field}
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={item.measurements?.[field] || ""}
                                                            onChange={(e) => {
                                                                const newItems = [...orderItems];
                                                                newItems[index] = {
                                                                    ...newItems[index],
                                                                    measurements: {
                                                                        ...(newItems[index].measurements || {}),
                                                                        [field]: e.target.value
                                                                    }
                                                                };
                                                                setOrderItems(newItems);
                                                            }}
                                                            className="input text-sm"
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Items Summary */}
                    {orderItems.length > 0 && (
                        <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                            <p className="text-sm text-indigo-700 dark:text-indigo-300">
                                <strong>{orderItems.length}</strong> item(s) •
                                Total Material: <strong>₹{orderItems.reduce((sum, i) => sum + (i.materialCost || 0), 0).toLocaleString()}</strong> •
                                Total Labour: <strong>₹{orderItems.reduce((sum, i) => sum + (i.labourCost || 0), 0).toLocaleString()}</strong>
                            </p>
                        </div>
                    )}
                </div>

                {/* Legacy Measurements (for order-level, kept for backwards compatibility) - Only when giving measurements */}
                {measurementType === "customer_gives" && (
                    <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Order-Level Measurements</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {MEASUREMENT_FIELDS[garmentType].map((field) => (
                                <div key={field}>
                                    <label className="label text-xs">
                                        {MEASUREMENT_LABELS[field] || field}
                                    </label>
                                    <input
                                        type="text"
                                        value={measurements[field] || ""}
                                        onChange={(e) =>
                                            setMeasurements({ ...measurements, [field]: e.target.value })
                                        }
                                        className="input"
                                        placeholder="0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Planned Materials */}
                <PlannedMaterialsInput
                    initialItems={plannedMaterials}
                    onChange={setPlannedMaterials}
                    disabled={loading}
                />

                {/* Workflow Stages */}
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Active Stages</h3>
                    <div className="flex flex-wrap gap-2">
                        {["materials", "marking", "cutting", "stitching", "hooks", "ironing", "billing"].map((stage) => (
                            <button
                                key={stage}
                                type="button"
                                onClick={() => {
                                    if (activeStages.includes(stage)) {
                                        setActiveStages(activeStages.filter((s) => s !== stage));
                                    } else {
                                        setActiveStages([...activeStages, stage]);
                                    }
                                }}
                                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${activeStages.includes(stage)
                                    ? "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-400 text-indigo-800 dark:text-indigo-300"
                                    : "bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-600"
                                    }`}
                            >
                                {stage.charAt(0).toUpperCase() + stage.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Image Upload Section - Only when measurement_blouse is selected */}
                {measurementType === "measurement_blouse" && (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                            <Upload className="w-5 h-5" />
                            <span>Reference Images</span>
                        </h3>

                        {/* Blouse-Specific Image Sections */}
                        {garmentType === "blouse" && (
                            <div className="space-y-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                                <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">Blouse Reference Images</p>

                                {/* Front Neck Image */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                                    <label className="label text-sm">Front Neck Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                const file = e.target.files[0];
                                                setFrontNeckImage({
                                                    file,
                                                    preview: URL.createObjectURL(file),
                                                    description: frontNeckImage.description
                                                });
                                            }
                                        }}
                                        className="input text-sm"
                                    />
                                    {frontNeckImage.preview && (
                                        <img src={frontNeckImage.preview} alt="Front Neck" className="mt-2 w-24 h-24 object-cover rounded" />
                                    )}
                                    <input
                                        type="text"
                                        value={frontNeckImage.description}
                                        onChange={(e) => setFrontNeckImage({ ...frontNeckImage, description: e.target.value })}
                                        placeholder="Add description (optional)"
                                        className="input text-sm mt-2"
                                    />
                                </div>

                                {/* Back Neck Image */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                                    <label className="label text-sm">Back Neck Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                const file = e.target.files[0];
                                                setBackNeckImage({
                                                    file,
                                                    preview: URL.createObjectURL(file),
                                                    description: backNeckImage.description
                                                });
                                            }
                                        }}
                                        className="input text-sm"
                                    />
                                    {backNeckImage.preview && (
                                        <img src={backNeckImage.preview} alt="Back Neck" className="mt-2 w-24 h-24 object-cover rounded" />
                                    )}
                                    <input
                                        type="text"
                                        value={backNeckImage.description}
                                        onChange={(e) => setBackNeckImage({ ...backNeckImage, description: e.target.value })}
                                        placeholder="Add description (optional)"
                                        className="input text-sm mt-2"
                                    />
                                </div>

                                {/* Sleeve Image */}
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900">
                                    <label className="label text-sm">Sleeve Image</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                const file = e.target.files[0];
                                                setSleeveImage({
                                                    file,
                                                    preview: URL.createObjectURL(file),
                                                    description: sleeveImage.description
                                                });
                                            }
                                        }}
                                        className="input text-sm"
                                    />
                                    {sleeveImage.preview && (
                                        <img src={sleeveImage.preview} alt="Sleeve" className="mt-2 w-24 h-24 object-cover rounded" />
                                    )}
                                    <input
                                        type="text"
                                        value={sleeveImage.description}
                                        onChange={(e) => setSleeveImage({ ...sleeveImage, description: e.target.value })}
                                        placeholder="Add description (optional)"
                                        className="input text-sm mt-2"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Additional Reference Images (for all categories) */}
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                            <label className="label flex items-center justify-between">
                                <span>{garmentType === "blouse" ? "Additional Reference Images" : "Reference Images"} (Max 10)</span>
                                <span className="text-xs text-gray-500">{imageUploads.length}/10</span>
                            </label>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => {
                                    if (e.target.files) {
                                        const newFiles = Array.from(e.target.files).slice(0, 10 - imageUploads.length);
                                        const newUploads = newFiles.map(file => ({
                                            file,
                                            preview: URL.createObjectURL(file),
                                            description: ""
                                        }));
                                        setImageUploads([...imageUploads, ...newUploads]);
                                    }
                                }}
                                className="input"
                                disabled={imageUploads.length >= 10}
                            />

                            {imageUploads.length > 0 && (
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {imageUploads.map((upload, idx) => (
                                        <div key={idx} className="relative border border-gray-200 dark:border-gray-700 rounded-lg p-2">
                                            <img
                                                src={upload.preview}
                                                alt={`Upload ${idx + 1}`}
                                                className="w-full h-20 object-cover rounded"
                                            />
                                            <input
                                                type="text"
                                                value={upload.description}
                                                onChange={(e) => {
                                                    const newUploads = [...imageUploads];
                                                    newUploads[idx] = { ...newUploads[idx], description: e.target.value };
                                                    setImageUploads(newUploads);
                                                }}
                                                placeholder="Description (optional)"
                                                className="input text-xs mt-1"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    URL.revokeObjectURL(upload.preview);
                                                    setImageUploads(imageUploads.filter((_, i) => i !== idx));
                                                }}
                                                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleSubmitForm}
                    disabled={loading || !customerName || !customerPhone || !dueDate || customerPhone.length < 10}
                    className="w-full btn btn-primary disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                            <span>Creating Order...</span>
                        </>
                    ) : (
                        <>
                            <Check className="w-5 h-5" />
                            <span>Create Order</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
