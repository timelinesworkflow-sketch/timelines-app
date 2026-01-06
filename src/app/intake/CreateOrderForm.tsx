"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, Order, PlannedMaterial, OrderItem, ItemMeasurementType, ItemReferenceImage } from "@/types";
import { createOrder, updateOrder, addTimelineEntry } from "@/lib/orders";
import { getOrCreateCustomer, getOrdersByCustomerPhone, updateCustomerOnNewOrder } from "@/lib/customers";
import { uploadImages } from "@/lib/storage";
import { createEmptyItem, computeOverallStatus, calculateItemsTotals, createOrderItems } from "@/lib/orderItems";
import { Timestamp } from "firebase/firestore";
import { X, Upload, Send, Check, Search, Clock, Package, User, Phone, AlertCircle, Plus, Trash2, ChevronDown, ChevronUp, Image as ImageIcon } from "lucide-react";
import Toast from "@/components/Toast";
import PlannedMaterialsInput from "@/components/PlannedMaterialsInput";

interface CreateOrderFormProps {
    onClose: () => void;
}

// Local type to handle file uploads before sending to server
type LocalOrderItem = Partial<OrderItem> & {
    tempFiles?: {
        file: File;
        preview: string;
        description: string;
        title: string;
        isDescriptionImage?: boolean; // For "Image as Description"
    }[];
};

export default function CreateOrderForm({ onClose }: CreateOrderFormProps) {
    const { userData } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Form state
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [garmentType, setGarmentType] = useState<GarmentType>("blouse");

    // Global active stages (default, can be overridden per item if we want, but usually order-wide for simplicity in UI)
    const [activeStages, setActiveStages] = useState<string[]>(["materials", "marking", "cutting", "stitching", "ironing", "billing"]);

    const [plannedMaterials, setPlannedMaterials] = useState<PlannedMaterial[]>([]);
    const [loading, setLoading] = useState(false);

    // Multi-item state
    const [orderItems, setOrderItems] = useState<LocalOrderItem[]>([createEmptyItem(1, "blouse")]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

    // Additional order fields
    const [designNotes, setDesignNotes] = useState("");
    const [price, setPrice] = useState<number>(0);
    const [advanceAmount, setAdvanceAmount] = useState<number>(0);
    const [materialCost, setMaterialCost] = useState<number>(0);
    const [labourCost, setLabourCost] = useState<number>(0);

    // Customer order history
    const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);
    const [showOrderHistory, setShowOrderHistory] = useState(false);

    // Aari Work toggle
    const [includeAariWork, setIncludeAariWork] = useState(true);

    useEffect(() => {
        // Auto-update stages for Aari garment types
        if (garmentType === "aari_blouse" || garmentType === "aari_pavada_sattai") {
            setActiveStages(["materials", "marking", "cutting", "aari_work", "stitching", "ironing", "billing"]);
        } else {
            setActiveStages(["materials", "marking", "cutting", "stitching", "ironing", "billing"]);
        }
    }, [garmentType]);

    // Lookup customer orders
    useEffect(() => {
        const lookupCustomerOrders = async () => {
            if (customerPhone.length >= 10) {
                setLoadingCustomerOrders(true);
                try {
                    const orders = await getOrdersByCustomerPhone(customerPhone);
                    setCustomerOrders(orders);
                    if (orders.length > 0) {
                        setShowOrderHistory(true);
                        if (!customerName && orders[0].customerName) setCustomerName(orders[0].customerName);
                        if (!customerAddress && orders[0].customerAddress) setCustomerAddress(orders[0].customerAddress);
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

    const handleItemChange = (index: number, updates: Partial<LocalOrderItem>) => {
        const newItems = [...orderItems];
        newItems[index] = { ...newItems[index], ...updates };
        setOrderItems(newItems);
    };

    const handleFileUpload = (index: number, files: FileList | null) => {
        if (!files) return;
        const newFiles = Array.from(files).map(file => ({
            file,
            preview: URL.createObjectURL(file),
            description: "",
            title: `Image ${file.name}`,
            isDescriptionImage: false
        }));

        const currentFiles = orderItems[index].tempFiles || [];
        handleItemChange(index, { tempFiles: [...currentFiles, ...newFiles] });
    };

    const removeFile = (itemIndex: number, fileIndex: number) => {
        const currentFiles = [...(orderItems[itemIndex].tempFiles || [])];
        const removed = currentFiles.splice(fileIndex, 1);
        if (removed[0]) URL.revokeObjectURL(removed[0].preview);
        handleItemChange(itemIndex, { tempFiles: currentFiles });
    };

    const handleSubmitForm = async () => {
        if (!customerName || !customerPhone || !dueDate) {
            setToast({ message: "Please fill all required fields", type: "error" });
            return;
        }

        setLoading(true);

        try {
            // Upload images for each item
            const processedItems: OrderItem[] = [];

            for (const item of orderItems) {
                let referenceImages: ItemReferenceImage[] = [];

                if (item.tempFiles && item.tempFiles.length > 0) {
                    const filesToUpload = item.tempFiles.map(f => f.file);
                    // Upload all files in parallel for this item
                    const uploadedUrls = await uploadImages(filesToUpload, `orders/${Date.now()}/${item.itemId}`);

                    // Map back to ItemReferenceImage structure
                    referenceImages = item.tempFiles.map((f, idx) => ({
                        imageUrl: uploadedUrls[idx],
                        title: f.title || "Reference Image",
                        description: f.description,
                        // If it's a description image, we might handle it differently but for now stores as desc
                    }));
                }

                // Prepare final item
                processedItems.push({
                    ...item,
                    itemId: item.itemId || `ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    referenceImages,
                    // If measurement garment, default status might trigger differently? No, standardized.
                    dueDate: item.dueDate || Timestamp.fromDate(new Date(dueDate)), // Prioritize item deadline or global
                    // Ensure required fields
                    measurements: item.measurements || {},
                    timeline: [{
                        stage: "intake",
                        completedBy: userData?.staffId || "system",
                        completedByName: userData?.name || "System",
                        completedAt: Timestamp.now()
                    }],
                    status: "in_progress",
                    customerName,
                    customerId: customerPhone,
                    currentStage: "materials" // Auto-advance to materials after creation
                } as OrderItem);
            }

            // Create or update customer profile
            await getOrCreateCustomer(customerPhone, customerName, customerAddress);

            // Calculate totals
            const itemsTotals = calculateItemsTotals(processedItems);

            // 1. Create Order (Visit Container)
            const orderData: Partial<Order> = {
                customerId: customerPhone, // Linking by phone for simplicity in this model
                customerName,
                customerPhone,
                customerAddress,
                garmentType, // Set default garment type for legacy support
                dueDate: Timestamp.fromDate(new Date(dueDate)),
                activeStages,
                currentStage: "intake",
                status: "in_progress",
                price,
                advanceAmount,
                materialCost: itemsTotals.totalMaterialCost || materialCost,
                labourCost: itemsTotals.totalLabourCost || labourCost,
                items: processedItems, // Snapshot

                // Planned materials
                plannedMaterials: plannedMaterials.length > 0 ? {
                    items: plannedMaterials,
                    plannedByStaffId: userData?.staffId || "",
                    plannedByStaffName: userData?.name || "",
                    plannedAt: Timestamp.now(),
                } : null,
            };

            const orderId = await createOrder(orderData);

            // 2. Create Order Items (Workflow Units)
            // Ensure orderId is set on all items
            const finalItems = processedItems.map(i => ({ ...i, orderId }));
            await createOrderItems(orderId, finalItems);

            // 3. Update Order with confirmed status (Since we skip OTP for now/Admin entry)
            await updateOrder(orderId, {
                confirmedAt: Timestamp.now(),
            });

            // 4. Update Customer Stats
            await updateCustomerOnNewOrder(customerPhone, orderId, price, labourCost, materialCost, 0);

            // 5. Timeline Entry
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
            console.error(error);
            setToast({ message: "Failed to create order", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card max-w-5xl mx-auto">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Customer Entry</h2>
                    <p className="text-sm text-gray-500">Create new items for customer</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-6">
                {/* 1. Customer Details (Parent) */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold mb-3 flex items-center space-x-2">
                        <User className="w-4 h-4" />
                        <span>Customer Details</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Phone Number *</label>
                            <div className="relative">
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                                    className="input"
                                    placeholder="10-digit number"
                                    maxLength={15}
                                />
                                {loadingCustomerOrders && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="label">Customer Name *</label>
                            <input
                                type="text"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                className="input"
                                placeholder="Name"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="label">Address</label>
                            <input
                                type="text"
                                value={customerAddress}
                                onChange={(e) => setCustomerAddress(e.target.value)}
                                className="input"
                                placeholder="Address"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Global Order Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label text-green-700 font-semibold">Entry Date</label>
                        <input
                            type="text"
                            value={new Date().toLocaleDateString()}
                            className="input bg-gray-100 dark:bg-gray-700"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="label text-indigo-700 font-semibold">Due Date (Default) *</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="input"
                            required
                        />
                    </div>
                </div>

                {/* 3. ITEMS LIST (Workflow Units) */}
                <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center space-x-2">
                            <Package className="w-5 h-5 text-indigo-600" />
                            <span>Workflow Items ({orderItems.length})</span>
                        </h3>
                        <button
                            type="button"
                            onClick={() => {
                                const newItem = createEmptyItem(orderItems.length + 1, garmentType);
                                if (dueDate) {
                                    newItem.dueDate = Timestamp.fromDate(new Date(dueDate));
                                }
                                setOrderItems([...orderItems, newItem]);
                                setExpandedItems(new Set([...expandedItems, orderItems.length]));
                            }}
                            className="btn btn-primary text-sm flex items-center space-x-1"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Item</span>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {orderItems.map((item, index) => (
                            <div key={index} className="border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                {/* Item Header */}
                                <div
                                    className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                                    onClick={() => {
                                        const newExpanded = new Set(expandedItems);
                                        if (newExpanded.has(index)) newExpanded.delete(index);
                                        else newExpanded.add(index);
                                        setExpandedItems(newExpanded);
                                    }}
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                                            {index + 1}
                                        </span>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white">
                                                {item.itemName || `Item ${index + 1}`}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.garmentType?.replace(/_/g, " ")} • {item.measurementType === 'measurement_garment' ? 'Pattern Garment' : 'Measurements'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newItems = orderItems.filter((_, i) => i !== index);
                                                setOrderItems(newItems);
                                            }}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {expandedItems.has(index) ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </div>

                                {/* Item Body */}
                                {expandedItems.has(index) && (
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-5">

                                        {/* Configuration Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="label">Item Name (e.g. Red Blouse)</label>
                                                <input
                                                    type="text"
                                                    value={item.itemName || ""}
                                                    onChange={(e) => handleItemChange(index, { itemName: e.target.value })}
                                                    className="input font-medium"
                                                    placeholder="Enter item name"
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Garment Type</label>
                                                <select
                                                    value={item.garmentType}
                                                    onChange={(e) => handleItemChange(index, { garmentType: e.target.value as GarmentType })}
                                                    className="input"
                                                >
                                                    <option value="blouse">Blouse</option>
                                                    <option value="chudi">Chudi</option>
                                                    <option value="frock">Frock</option>
                                                    <option value="pavadai_sattai">Pavadai Sattai</option>
                                                    <option value="aari_blouse">Aari Blouse</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* PER ITEM: Measurement Mode Toggle */}
                                        <div>
                                            <div className="flex p-1 bg-gray-200 dark:bg-gray-700 rounded-lg mb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => handleItemChange(index, { measurementType: "measurements" })}
                                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${item.measurementType === "measurements"
                                                        ? "bg-white text-indigo-600 shadow-sm"
                                                        : "text-gray-600 hover:text-gray-800"
                                                        }`}
                                                >
                                                    📏 Measurements
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleItemChange(index, { measurementType: "measurement_garment" })}
                                                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${item.measurementType === "measurement_garment"
                                                        ? "bg-white text-indigo-600 shadow-sm"
                                                        : "text-gray-600 hover:text-gray-800"
                                                        }`}
                                                >
                                                    👕 Pattern Garment & Images
                                                </button>
                                            </div>

                                            {/* CONDITIONAL UI */}
                                            {item.measurementType === "measurements" ? (
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-gray-800 p-4 rounded-lg border">
                                                    {MEASUREMENT_FIELDS[item.garmentType || "blouse"]?.map((field) => (
                                                        <div key={field}>
                                                            <label className="text-xs text-gray-500 mb-1 block">
                                                                {MEASUREMENT_LABELS[field] || field}
                                                            </label>
                                                            <input
                                                                type="text"
                                                                value={item.measurements?.[field] || ""}
                                                                onChange={(e) => {
                                                                    const m = { ...(item.measurements || {}) };
                                                                    m[field] = e.target.value;
                                                                    handleItemChange(index, { measurements: m });
                                                                }}
                                                                className="input text-sm py-1"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-dashed border-indigo-300 rounded-lg p-6 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <Upload className="w-8 h-8 text-indigo-500 mb-2" />
                                                        <h4 className="font-semibold text-indigo-900 dark:text-indigo-300">Upload Reference Images</h4>
                                                        <p className="text-sm text-indigo-600 dark:text-indigo-400 mb-4">
                                                            Upload pattern garment photos, sketches, or design ideas
                                                        </p>

                                                        <input
                                                            type="file"
                                                            multiple
                                                            accept="image/*"
                                                            onChange={(e) => handleFileUpload(index, e.target.files)}
                                                            className="hidden"
                                                            id={`file-upload-${index}`}
                                                        />
                                                        <label
                                                            htmlFor={`file-upload-${index}`}
                                                            className="btn btn-outline cursor-pointer bg-white dark:bg-gray-800"
                                                        >
                                                            Select Images
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Image Preview List (Always show if images exist, regardless of mode, but mostly for garment mode) */}
                                            {item.tempFiles && item.tempFiles.length > 0 && (
                                                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                    {item.tempFiles.map((file, fIdx) => (
                                                        <div key={fIdx} className="relative group bg-white p-2 rounded-lg border shadow-sm">
                                                            <img src={file.preview} alt="Preview" className="w-full h-24 object-cover rounded" />
                                                            <input
                                                                type="text"
                                                                value={file.title}
                                                                onChange={(e) => {
                                                                    const files = [...(item.tempFiles || [])];
                                                                    files[fIdx].title = e.target.value;
                                                                    handleItemChange(index, { tempFiles: files });
                                                                }}
                                                                className="input text-xs mt-2 border-none bg-gray-50 focus:bg-white"
                                                                placeholder="Image Title (Required)"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={file.description}
                                                                onChange={(e) => {
                                                                    const files = [...(item.tempFiles || [])];
                                                                    files[fIdx].description = e.target.value;
                                                                    handleItemChange(index, { tempFiles: files });
                                                                }}
                                                                className="input text-xs mt-1 border-none bg-gray-50 focus:bg-white"
                                                                placeholder="Note involved..."
                                                            />
                                                            <button
                                                                onClick={() => removeFile(index, fIdx)}
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Costs */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="label text-xs">Labour Cost (₹)</label>
                                                <input
                                                    type="number"
                                                    value={item.labourCost || ""}
                                                    onChange={(e) => handleItemChange(index, { labourCost: parseFloat(e.target.value) })}
                                                    className="input"
                                                />
                                            </div>
                                            <div>
                                                <label className="label text-xs">Material Cost (₹)</label>
                                                <input
                                                    type="number"
                                                    value={item.materialCost || ""}
                                                    onChange={(e) => handleItemChange(index, { materialCost: parseFloat(e.target.value) })}
                                                    className="input"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit Section */}
                <div className="pt-4 border-t sticky bottom-0 bg-white dark:bg-gray-900 pb-4">
                    <div className="flex justify-between items-center mb-4 text-sm font-medium bg-gray-50 p-3 rounded-lg">
                        <span>Items: {orderItems.length}</span>
                        <span>Total Est: ₹{calculateItemsTotals(orderItems as OrderItem[]).totalLabourCost + calculateItemsTotals(orderItems as OrderItem[]).totalMaterialCost}</span>
                    </div>

                    <button
                        onClick={handleSubmitForm}
                        disabled={loading}
                        className="btn btn-primary w-full py-3 text-lg shadow-lg hover:shadow-xl transition-all"
                    >
                        {loading ? "Creating Order..." : "Confirm & Create Workflow Items"}
                    </button>
                </div>
            </div>
        </div>
    );
}
