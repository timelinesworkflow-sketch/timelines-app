"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, Order, OrderItem, ItemReferenceImage, getGarmentDisplayName } from "@/types";
import { createOrder, updateOrder, addTimelineEntry } from "@/lib/orders";
import { getOrCreateCustomer, getOrdersByCustomerPhone, updateCustomerOnNewOrder } from "@/lib/customers";
import { uploadImages } from "@/lib/storage";
import { createEmptyItem, calculateItemsTotals, createOrderItems } from "@/lib/orderItems";
import { Timestamp } from "firebase/firestore";
import { X, Upload, Plus, Trash2, ChevronDown, ChevronUp, User, Package, Calendar, Phone, Info } from "lucide-react";
import Toast from "@/components/Toast";

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
        sketchFile?: File; // Secondary image explaining the main one
        sketchPreview?: string;
    }[];
    customGarmentName?: string;
};

export default function CreateOrderForm({ onClose }: CreateOrderFormProps) {
    const { userData } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Form state - Global Customer Data Only
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    // Default due date state - initially empty or derived? Prompt implies user selects or auto-fill? 
    // "Auto-fill Customer Entry Date ... Due Date" usually is manual. Prompt specifically says Entry Date is auto-filled.
    const [dueDate, setDueDate] = useState("");

    // Auto-filled Entry Date (Read-only)
    const entryDate = new Date();

    const [loading, setLoading] = useState(false);

    // Multi-item state
    const [orderItems, setOrderItems] = useState<LocalOrderItem[]>([createEmptyItem(1, "blouse")]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));
    const [previewModal, setPreviewModal] = useState<string | null>(null);

    // Customer order history lookup
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);

    // Lookup customer orders
    useEffect(() => {
        const lookupCustomerOrders = async () => {
            if (customerPhone.length >= 10) {
                setLoadingCustomerOrders(true);
                try {
                    const orders = await getOrdersByCustomerPhone(customerPhone);
                    if (orders.length > 0) {
                        if (!customerName && orders[0].customerName) setCustomerName(orders[0].customerName);
                        if (!customerAddress && orders[0].customerAddress) setCustomerAddress(orders[0].customerAddress);
                    }
                } catch (error) {
                    console.error("Failed to fetch customer orders:", error);
                } finally {
                    setLoadingCustomerOrders(false);
                }
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

    // --- SEQUENTIAL IMAGE LOGIC ---

    const addImageSlot = (itemIndex: number) => {
        const currentFiles = orderItems[itemIndex].tempFiles || [];
        // Only allow adding new slot if previous one is valid (has file and title)
        if (currentFiles.length > 0) {
            const lastFile = currentFiles[currentFiles.length - 1];
            if (!lastFile.file || !lastFile.title) {
                setToast({ message: "Please complete the previous image details (Image & Title required)", type: "error" });
                return;
            }
        }

        document.getElementById(`file-upload-${itemIndex}`)?.click();
    };

    const handleFileUpload = (index: number, files: FileList | null) => {
        if (!files || files.length === 0) return;

        // We handle one file at a time for sequential logic
        const file = files[0];
        const newItem = {
            file,
            preview: URL.createObjectURL(file),
            description: "",
            title: "", // Must be filled by user
            sketchFile: undefined,
            sketchPreview: undefined
        };

        const currentFiles = orderItems[index].tempFiles || [];
        handleItemChange(index, { tempFiles: [...currentFiles, newItem] });
    };

    const handleDescriptionSketchUpload = (itemIndex: number, fileIndex: number, files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];

        const currentFiles = [...(orderItems[itemIndex].tempFiles || [])];
        if (currentFiles[fileIndex]) {
            currentFiles[fileIndex].sketchFile = file; // Secondary image
            currentFiles[fileIndex].sketchPreview = URL.createObjectURL(file);
            handleItemChange(itemIndex, { tempFiles: currentFiles });
        }
    };

    const removeFile = (itemIndex: number, fileIndex: number) => {
        const currentFiles = [...(orderItems[itemIndex].tempFiles || [])];
        const removed = currentFiles.splice(fileIndex, 1);
        if (removed[0]) {
            URL.revokeObjectURL(removed[0].preview);
            if (removed[0].sketchPreview) URL.revokeObjectURL(removed[0].sketchPreview);
        }
        handleItemChange(itemIndex, { tempFiles: currentFiles });
    };

    // --- VALIDATION LOGIC ---

    const validateItem = (item: LocalOrderItem): boolean => {
        if (!item.garmentType) return false;
        if (item.garmentType === "other" && !item.customGarmentName?.trim()) return false;

        if (item.measurementType === 'measurements') {
            const fields = MEASUREMENT_FIELDS[item.garmentType || "blouse"];
            if (!fields) return false;
            // Require at least one measurement to be filled for validity
            const hasMeasurements = Object.keys(item.measurements || {}).some(k => item.measurements?.[k]);
            return hasMeasurements;
        } else {
            // Garment Mode: Must have at least 1 image and it must be valid (Title required)
            if (!item.tempFiles || item.tempFiles.length === 0) return false;
            return item.tempFiles.every(f => !!f.title);
        }
    };

    const isCurrentItemValid = () => {
        if (orderItems.length === 0) return true;
        const currentItem = orderItems[orderItems.length - 1];
        return validateItem(currentItem);
    };

    const handleAddNewItem = () => {
        if (!isCurrentItemValid()) {
            setToast({ message: "Please complete the current item first (Garment Type, Measurements or Images).", type: "error" });
            return;
        }

        const newItem = createEmptyItem(orderItems.length + 1, "blouse"); // Default
        if (dueDate) {
            newItem.dueDate = Timestamp.fromDate(new Date(dueDate));
        }

        // Collapse previous, expand new
        setExpandedItems(new Set([orderItems.length]));
        setOrderItems([...orderItems, newItem]);
    };

    const handleSubmitForm = async () => {
        if (!customerName || !customerPhone || !dueDate) {
            setToast({ message: "Please fill all required customer fields", type: "error" });
            return;
        }

        // Validate all items
        const inValidIndex = orderItems.findIndex(i => !validateItem(i));
        if (inValidIndex !== -1) {
            setToast({ message: `Item ${inValidIndex + 1} is incomplete. Please check measurements or images.`, type: "error" });
            return;
        }

        setLoading(true);

        try {
            // Upload images for each item
            const processedItems: OrderItem[] = [];

            for (const item of orderItems) {
                let referenceImages: ItemReferenceImage[] = [];

                if (item.tempFiles && item.tempFiles.length > 0) {
                    const uploadPromises = item.tempFiles.map(async (f) => {
                        // Upload Main Image
                        const mainUrls = await uploadImages([f.file], `orders/${Date.now()}/${item.itemId}/main`);
                        let sketchUrl = "";

                        // Upload Sketch Image if exists
                        if (f.sketchFile) {
                            const sketchUrls = await uploadImages([f.sketchFile], `orders/${Date.now()}/${item.itemId}/sketch`);
                            sketchUrl = sketchUrls[0];
                        }

                        return {
                            imageUrl: mainUrls[0],
                            title: f.title || "Reference Image",
                            description: f.description,
                            sketchImageUrl: sketchUrl
                        };
                    });

                    referenceImages = await Promise.all(uploadPromises);
                }

                // Prepare final item
                // NOTE: We do NOT use global garmentType. We use item.garmentType.
                processedItems.push({
                    ...item,
                    itemId: item.itemId || `ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    referenceImages,
                    dueDate: item.dueDate ? item.dueDate : Timestamp.fromDate(new Date(dueDate)),
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
                    currentStage: "materials", // Initial stage after entry as per standard flow
                    customGarmentName: item.garmentType === "other" ? item.customGarmentName : undefined
                } as OrderItem);
            }

            // Create or update customer profile
            await getOrCreateCustomer(customerPhone, customerName, customerAddress);

            // Calculate totals
            const itemsTotals = calculateItemsTotals(processedItems);

            // 1. Create Order (Visit Container)
            const orderData: Partial<Order> = {
                customerId: customerPhone,
                customerName,
                customerPhone,
                customerAddress,

                // Set global defaults
                dueDate: Timestamp.fromDate(new Date(dueDate)),
                currentStage: "intake",
                status: "in_progress",

                price: 0,
                advanceAmount: 0,
                materialCost: itemsTotals.totalMaterialCost,
                labourCost: itemsTotals.totalLabourCost,

                items: processedItems,

                // Deprecated/Legacy fields - set to safe defaults
                garmentType: undefined,
                activeStages: [],
                plannedMaterials: null,
            };

            const orderId = await createOrder(orderData);

            // 2. Create Order Items (Workflow Units)
            const finalItems = processedItems.map(i => ({ ...i, orderId }));
            await createOrderItems(orderId, finalItems);

            // 3. Update Order 
            await updateOrder(orderId, {
                confirmedAt: Timestamp.now(),
            });

            // 4. Update Customer Stats
            await updateCustomerOnNewOrder(customerPhone, orderId, itemsTotals.totalLabourCost + itemsTotals.totalMaterialCost, itemsTotals.totalLabourCost, itemsTotals.totalMaterialCost, 0);

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
            }, 1000);

        } catch (error) {
            console.error(error);
            setToast({ message: "Failed to create order", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card max-w-5xl mx-auto mb-20 animate-in fade-in zoom-in duration-300">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Entry</h2>
                    <p className="text-sm text-gray-500">Create new items for customer visit</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="space-y-6">
                {/* 1. Customer Details (Global) */}
                <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <User className="w-24 h-24 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold mb-4 flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 relative z-10">
                        <User className="w-5 h-5" />
                        <span>Customer Details (Global)</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
                        <div className="relative">
                            <label className="label">Phone Number *</label>
                            <div className="relative">
                                <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                                    className="input pl-10"
                                    placeholder="Customer Mobile"
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
                                placeholder="Full Address"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Global Order Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-white dark:bg-gray-800 p-5 rounded-xl border shadow-sm">
                    <div>
                        <label className="label text-gray-600 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Entry Date (Read Only)
                        </label>
                        <input
                            type="text"
                            value={entryDate.toLocaleDateString()}
                            className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="label text-indigo-700 font-bold">Due Date (Target) *</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="input border-indigo-200 focus:border-indigo-500 font-medium"
                            required
                        />
                    </div>
                </div>

                {/* 3. ITEMS LIST (Workflow Units) */}
                <div className="border-t pt-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center space-x-2">
                            <Package className="w-6 h-6 text-indigo-600" />
                            <span>Workflow Items ({orderItems.length})</span>
                        </h3>
                        {/* Add Item Button: Disabled if current item invalid */}
                        <div className="flex flex-col items-end">
                            <button
                                type="button"
                                onClick={handleAddNewItem}
                                disabled={!isCurrentItemValid()}
                                className={`btn btn-primary text-sm flex items-center space-x-1 shadow-md transition-all ${!isCurrentItemValid() ? 'opacity-50 cursor-not-allowed bg-gray-400 shadow-none' : 'hover:shadow-lg'}`}
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Next Item</span>
                            </button>
                            {!isCurrentItemValid() && orderItems.length > 0 && (
                                <span className="text-xs text-red-500 mt-1 font-medium bg-red-50 px-2 py-1 rounded">Complete current item first</span>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        {orderItems.map((item, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                                {/* Item Header */}
                                <div
                                    className={`px-5 py-4 flex items-center justify-between cursor-pointer transition-colors ${!expandedItems.has(index) ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white'}`}
                                    onClick={() => {
                                        const newExpanded = new Set(expandedItems);
                                        if (newExpanded.has(index)) newExpanded.delete(index);
                                        else newExpanded.add(index);
                                        setExpandedItems(newExpanded);
                                    }}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm ${expandedItems.has(index) ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 dark:text-white text-lg">
                                                {item.itemName || `Item ${index + 1}`}
                                            </p>
                                            <p className="text-sm text-gray-500 font-medium">
                                                {getGarmentDisplayName(item)} • {item.measurementType === 'measurement_garment' ? 'Pattern Garment' : 'Measurements'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (orderItems.length > 1) {
                                                    const newItems = orderItems.filter((_, i) => i !== index);
                                                    setOrderItems(newItems);
                                                } else {
                                                    setToast({ message: "At least one item is required", type: "error" });
                                                }
                                            }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {expandedItems.has(index) ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                    </div>
                                </div>

                                {/* Item Body */}
                                {expandedItems.has(index) && (
                                    <div className="p-6 border-t border-gray-100 dark:border-gray-700 space-y-6 animate-fade-in">

                                        {/* Configuration Row */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div>
                                                <label className="label">Item Name (e.g. Red Silk Blouse)</label>
                                                <input
                                                    type="text"
                                                    value={item.itemName || ""}
                                                    onChange={(e) => handleItemChange(index, { itemName: e.target.value })}
                                                    className="input font-medium"
                                                    placeholder="Enter descriptive name"
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Garment Type <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <select
                                                        value={item.garmentType}
                                                        onChange={(e) => handleItemChange(index, { garmentType: e.target.value as GarmentType })}
                                                        className="input appearance-none border-indigo-100 focus:border-indigo-500"
                                                    >
                                                        <option value="blouse">Blouse</option>
                                                        <option value="chudi">Chudi</option>
                                                        <option value="frock">Frock</option>
                                                        <option value="pavadai_sattai">Pavadai Sattai</option>
                                                        <option value="aari_blouse">AARI Blouse</option>
                                                        <option value="aari_pavada_sattai">AARI Pavada Sattai</option>
                                                        <option value="other">Other</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                                </div>
                                                {(item.garmentType === 'aari_blouse' || item.garmentType === 'aari_pavada_sattai') && (
                                                    <p className="text-xs text-indigo-600 mt-1 flex items-center font-medium">
                                                        <Info className="w-3 h-3 mr-1" />
                                                        AARI Stage will be included automatically.
                                                    </p>
                                                )}
                                                {item.garmentType === "other" && (
                                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <label className="label text-indigo-700 font-bold">Specify Garment Name *</label>
                                                        <input
                                                            type="text"
                                                            value={item.customGarmentName || ""}
                                                            onChange={(e) => handleItemChange(index, { customGarmentName: e.target.value })}
                                                            className="input border-indigo-200 focus:border-indigo-500 font-medium"
                                                            placeholder="e.g. Saree Draping, Alteration"
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* PER ITEM: Measurement Mode Toggle */}
                                        <div className="bg-gray-100 dark:bg-gray-750 p-1 rounded-lg inline-flex w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={() => handleItemChange(index, { measurementType: "measurements" })}
                                                className={`flex-1 sm:flex-none py-2 px-6 rounded-md text-sm font-medium transition-all duration-200 ${item.measurementType === "measurements"
                                                    ? "bg-white text-indigo-700 shadow-sm border border-gray-200 scale-[1.02]"
                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                                    }`}
                                            >
                                                Customer Gives Measurements
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleItemChange(index, { measurementType: "measurement_garment" })}
                                                className={`flex-1 sm:flex-none py-2 px-6 rounded-md text-sm font-medium transition-all duration-200 ${item.measurementType === "measurement_garment"
                                                    ? "bg-white text-indigo-700 shadow-sm border border-gray-200 scale-[1.02]"
                                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                                                    }`}
                                            >
                                                Customer Gives Pattern Garment
                                            </button>
                                        </div>

                                        {/* CONDITIONAL UI */}
                                        {item.measurementType === "measurements" ? (
                                            <div className="animate-fade-in bg-gray-50 dark:bg-gray-800/50 p-5 rounded-xl border border-dashed border-gray-200">
                                                <h4 className="font-semibold mb-4 text-sm text-gray-700 flex items-center">
                                                    <span>Enter Measurements (Inches)</span>
                                                    <span className="ml-2 h-px flex-1 bg-gray-200"></span>
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                                    {MEASUREMENT_FIELDS[item.garmentType || "blouse"]?.map((field) => (
                                                        <div key={field}>
                                                            <label className="text-[11px] font-bold text-gray-500 mb-1 block uppercase tracking-wider">
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
                                                                className="input text-sm py-2 text-center font-medium focus:ring-2 focus:ring-indigo-500/20"
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 animate-fade-in">
                                                <h4 className="font-semibold text-sm text-gray-700 flex items-center">
                                                    <span>Upload Reference Images (Sequential)</span>
                                                    <span className="ml-2 h-px flex-1 bg-gray-200"></span>
                                                </h4>

                                                {/* Sequential Image List */}
                                                {item.tempFiles?.map((file, fIdx) => (
                                                    <div key={fIdx} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 shadow-sm relative group hover:border-indigo-300 transition-colors">
                                                        <div className="flex flex-col sm:flex-row items-start gap-5">
                                                            {/* Main Image Preview */}
                                                            <div className="shrink-0 relative">
                                                                <img
                                                                    src={file.preview}
                                                                    alt="Main"
                                                                    className="w-28 h-28 object-cover rounded-lg border bg-gray-100 shadow-sm cursor-pointer"
                                                                    onClick={() => setPreviewModal(file.preview)}
                                                                />
                                                                <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                                    #{fIdx + 1}
                                                                </div>
                                                            </div>

                                                            {/* Inputs */}
                                                            <div className="flex-1 space-y-3 w-full">
                                                                <div>
                                                                    <label className="label text-[11px] uppercase tracking-wider text-gray-500">Image Title <span className="text-red-500">*</span></label>
                                                                    <input
                                                                        type="text"
                                                                        className="input text-sm font-medium"
                                                                        placeholder="e.g. Front View, Back Neck Design"
                                                                        value={file.title}
                                                                        onChange={(e) => {
                                                                            const newFiles = [...(item.tempFiles || [])];
                                                                            newFiles[fIdx].title = e.target.value;
                                                                            handleItemChange(index, { tempFiles: newFiles });
                                                                        }}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="label text-[11px] uppercase tracking-wider text-gray-500">Description (Optional)</label>
                                                                    <input
                                                                        type="text"
                                                                        className="input text-sm"
                                                                        placeholder="Specific details about this part..."
                                                                        value={file.description}
                                                                        onChange={(e) => {
                                                                            const newFiles = [...(item.tempFiles || [])];
                                                                            newFiles[fIdx].description = e.target.value;
                                                                            handleItemChange(index, { tempFiles: newFiles });
                                                                        }}
                                                                    />
                                                                </div>
                                                            </div>

                                                            {/* Secondary Image Upload (Sketch/Description) */}
                                                            <div className="shrink-0 w-full sm:w-auto text-center group/sketch">
                                                                <label className="block text-[10px] uppercase text-gray-400 mb-1">Sketch / Detail</label>
                                                                <div
                                                                    className="w-24 h-24 mx-auto border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer bg-gray-50 hover:bg-white hover:border-indigo-400 relative overflow-hidden transition-all"
                                                                    onClick={() => document.getElementById(`sketch-upload-${index}-${fIdx}`)?.click()}
                                                                >
                                                                    {file.sketchPreview ? (
                                                                        <div className="relative w-full h-full group/preview">
                                                                            <img
                                                                                src={file.sketchPreview}
                                                                                className="w-full h-full object-cover"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setPreviewModal(file.sketchPreview!);
                                                                                }}
                                                                            />
                                                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity pointer-events-none">
                                                                                <span className="text-white text-[10px]">View/Change</span>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-center p-2">
                                                                            <Plus className="w-5 h-5 mx-auto text-gray-400 group-hover/sketch:text-indigo-400 transition-colors" />
                                                                            <span className="text-[9px] text-gray-400 block mt-1">Add Photo</span>
                                                                        </div>
                                                                    )}
                                                                    <input
                                                                        type="file"
                                                                        id={`sketch-upload-${index}-${fIdx}`}
                                                                        className="hidden"
                                                                        accept="image/*"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        onChange={(e) => handleDescriptionSketchUpload(index, fIdx, e.target.files)}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Remove Button */}
                                                        <button
                                                            onClick={() => removeFile(index, fIdx)}
                                                            className="absolute top-2 right-2 p-1.5 bg-white shadow-sm border rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))}

                                                {/* Add Image Button - Only if previous images are valid */}
                                                <div
                                                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group ${(!item.tempFiles?.length || (item.tempFiles[item.tempFiles.length - 1].title))
                                                        ? "border-indigo-200 hover:bg-indigo-50 hover:border-indigo-400 bg-indigo-50/30"
                                                        : "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                                                        }`}
                                                    onClick={() => addImageSlot(index)}
                                                >
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => handleFileUpload(index, e.target.files)}
                                                        className="hidden"
                                                        id={`file-upload-${index}`}
                                                    />
                                                    <div className="flex flex-col items-center justify-center w-full">
                                                        <div className={`p-3 rounded-full mb-3 transition-colors ${(!item.tempFiles?.length || (item.tempFiles[item.tempFiles.length - 1].title))
                                                            ? "bg-indigo-100 text-indigo-500 group-hover:bg-indigo-200 group-hover:text-indigo-700"
                                                            : "bg-gray-200 text-gray-400"
                                                            }`}>
                                                            <Upload className="w-6 h-6" />
                                                        </div>
                                                        <span className={`font-semibold text-sm ${(!item.tempFiles?.length || (item.tempFiles[item.tempFiles.length - 1].title))
                                                            ? "text-indigo-700 underline decoration-dashed underline-offset-4"
                                                            : "text-gray-500"
                                                            }`}>
                                                            {(!item.tempFiles || item.tempFiles.length === 0) ? "Upload Item Photo" : "+ Add Next Image"}
                                                        </span>
                                                        {item.tempFiles && item.tempFiles.length > 0 && !item.tempFiles[item.tempFiles.length - 1].title && (
                                                            <span className="text-[10px] text-red-500 mt-2 font-medium bg-red-50 px-2 py-0.5 rounded">
                                                                Please enter title for Image #{item.tempFiles.length} first
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit Section */}
                <div className="pt-6 border-t sticky bottom-0 bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 pb-4 z-20">
                    <div className="flex justify-between items-center mb-4 text-sm font-medium bg-gray-50 p-3 rounded-lg border">
                        <span className="text-gray-600">Total Items: <span className="font-bold text-gray-900">{orderItems.length}</span></span>
                    </div>

                    <button
                        onClick={handleSubmitForm}
                        disabled={loading}
                        className="btn btn-primary w-full py-4 text-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center space-x-2 rounded-xl"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                <span>Creating Items...</span>
                            </>
                        ) : (
                            <>
                                <Package className="w-5 h-5" />
                                <span>Confirm & Generate Workflow Items</span>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-center text-gray-400 mt-3">Each item will start its own independent workflow.</p>
                </div>
            </div>

            {/* Fullscreen Image Modal */}
            {previewModal && (
                <div
                    className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setPreviewModal(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white/50 hover:text-white"
                        onClick={() => setPreviewModal(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={previewModal}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
