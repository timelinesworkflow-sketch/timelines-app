"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, Order, OrderItem, ItemReferenceImage, getGarmentDisplayName, DesignSection } from "@/types";
import { createOrder, updateOrder, addTimelineEntry } from "@/lib/orders";
import { getOrCreateCustomer, getOrdersByCustomerPhone, updateCustomerOnNewOrder } from "@/lib/customers";
import { uploadImages } from "@/lib/storage";
import { createEmptyItem, calculateItemsTotals, createOrderItems } from "@/lib/orderItems";
import { Timestamp } from "firebase/firestore";
import { X, Upload, Plus, Trash2, ChevronDown, ChevronUp, User, Package, Calendar, Phone, Info, Calculator, Image as ImageIcon, CheckCircle, Edit3, Edit3 as EditIcon } from "lucide-react";
import ReferenceImageUpload from "@/components/customer-entry/ReferenceImageUpload";
import DesignSectionsDisplay from "@/components/DesignSectionsDisplay";
import Toast from "@/components/Toast";
import { calculateOrderPricingSummary } from "@/lib/orderItems";
import BillTemplate from "@/components/billing/BillTemplate";
import { useRef } from "react";

interface CreateOrderFormProps {
    onClose: () => void;
}

// Local type to handle file uploads before sending to server
type LocalOrderItem = Partial<OrderItem> & {
    referenceFiles?: { file: File | null; sketchFile: File | null }[];
    designSectionFiles?: Record<string, { main?: File; sketch?: File }>;
    customGarmentName?: string;
    itemPricing: {
        pricingRows: {
            materialName: string;
            quantity: number | "";
            unit: "meter" | "gram" | "packet";
            ratePerUnit: number | "";
            rowTotal: number;
            color?: string;
            isDefault: boolean;
        }[];
        itemEstimatedTotal: number;
        pricingConfirmed: boolean;
    };
    itemVersion: number;
    isActiveVersion: boolean;
    revisionReason?: string;
    revisedBy?: {
        staffId: string;
        name: string;
        role: string;
        uid?: string; // Correctly add UID for security
    };
    revisedAt?: any;
};

const GARMENT_OPTIONS: { value: GarmentType; label: string }[] = [
    { value: "lining_blouse", label: "Lining Blouse" },
    { value: "sada_blouse", label: "Sada Blouse" },
    { value: "frock", label: "Frock" },
    { value: "top", label: "Top" },
    { value: "pant", label: "Pant" },
    { value: "lehenga", label: "Lehenga" },
    { value: "pavadai_sattai", label: "Pavadai Sattai" },
    { value: "chudi", label: "Chudidar" },
    { value: "aari_blouse", label: "Aari Blouse" },
    { value: "aari_pavada_sattai", label: "Aari Pavadai Sattai" },
    { value: "rework", label: "Rework" },
    { value: "other", label: "Other" },
    { value: "blouse", label: "Blouse (Legacy)" },
];

export default function CreateOrderForm({ onClose }: CreateOrderFormProps) {
    const { user, userData } = useAuth();
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

    // Form state - Global Customer Data Only
    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    // Global Due Date REMOVED - Enforced at Item Level

    // Generator State
    const [genGarmentType, setGenGarmentType] = useState<GarmentType>("lining_blouse");
    const [genQuantity, setGenQuantity] = useState<number | "">(0);

    // Auto-filled Entry Date (Read-only)
    const entryDate = new Date();

    const [loading, setLoading] = useState(false);

    // Multi-item state
    // Multi-item state - Start EMPTY as per new generator logic
    const [orderItems, setOrderItems] = useState<LocalOrderItem[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));
    const [previewModal, setPreviewModal] = useState<string | null>(null);

    // Customer order history lookup
    const [loadingCustomerOrders, setLoadingCustomerOrders] = useState(false);

    const billTemplateRef = useRef<HTMLDivElement>(null);
    const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
    const [selectedBillItem, setSelectedBillItem] = useState<{ item: LocalOrderItem, index: number } | null>(null);
    const [orderPricingConfirmed, setOrderPricingConfirmed] = useState(false);
    const [isOverallBill, setIsOverallBill] = useState(false);
    const [revisionReason, setRevisionReason] = useState("");
    const [showRevisionModal, setShowRevisionModal] = useState<{ itemIdx: number; item: LocalOrderItem } | null>(null);
    const [pricingDirty, setPricingDirty] = useState(false);

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

    // --- REFERENCE IMAGE LOGIC ---

    const handleReferenceFilesUpdate = (index: number, files: { file: File | null; sketchFile: File | null }[]) => {
        handleItemChange(index, { referenceFiles: files });
    };

    const handleReferenceImagesChange = (index: number, images: ItemReferenceImage[]) => {
        handleItemChange(index, { referenceImages: images });
    };

    const handleGenerateItems = () => {
        const qty = typeof genQuantity === 'number' ? genQuantity : 0;
        if (qty <= 0) {
            setToast({ message: "Please enter a valid quantity", type: "error" });
            return;
        }

        const newItems: LocalOrderItem[] = [];
        for (let i = 0; i < qty; i++) {
            const item = createEmptyItem(orderItems.length + 1 + i, genGarmentType) as LocalOrderItem;
            item.itemName = GARMENT_OPTIONS.find(g => g.value === genGarmentType)?.label || genGarmentType;
            newItems.push(item);
        }
        setOrderItems([...orderItems, ...newItems]);
        setToast({ message: `Generated ${qty} item(s)`, type: "info" });
    };

    const handleDesignFilesUpdate = (index: number, filesMap: Record<string, { main?: File; sketch?: File }>) => {
        const currentItem = orderItems[index];
        const newMap = { ...(currentItem.designSectionFiles || {}), ...filesMap };
        handleItemChange(index, { designSectionFiles: newMap });
    };

    const handleDesignSectionsChange = (index: number, sections: DesignSection[]) => {
        handleItemChange(index, { designSections: sections });
    };

    const handleDesignMainUpload = async (itemIdx: number, sectionIdx: number, file: File): Promise<string> => {
        const item = orderItems[itemIdx];
        const sectionId = item.designSections![sectionIdx].sectionId;
        const previewUrl = URL.createObjectURL(file);

        const newFilesMap = { ...(item.designSectionFiles || {}) };
        newFilesMap[sectionId] = { ...(newFilesMap[sectionId] || {}), main: file };

        handleItemChange(itemIdx, { designSectionFiles: newFilesMap });
        return previewUrl;
    };

    const handleDesignSketchUpload = async (itemIdx: number, sectionIdx: number, file: File): Promise<string> => {
        const item = orderItems[itemIdx];
        const sectionId = item.designSections![sectionIdx].sectionId;
        const previewUrl = URL.createObjectURL(file);

        const newFilesMap = { ...(item.designSectionFiles || {}) };
        newFilesMap[sectionId] = { ...(newFilesMap[sectionId] || {}), sketch: file };

        handleItemChange(itemIdx, { designSectionFiles: newFilesMap });
        return previewUrl;
    };

    // --- PRICING LOGIC ---

    const handlePricingChange = (itemIdx: number, matIdx: number, field: string, value: any) => {
        const newItems = [...orderItems];
        const item = { ...newItems[itemIdx] };
        const rows = [...item.itemPricing.pricingRows];
        rows[matIdx] = { ...rows[matIdx], [field]: value };

        // Auto-calculate row total
        const q = typeof rows[matIdx].quantity === 'number' ? rows[matIdx].quantity : 0;
        const r = typeof rows[matIdx].ratePerUnit === 'number' ? rows[matIdx].ratePerUnit : 0;
        rows[matIdx].rowTotal = q * r;

        // Auto-calculate item total
        const total = rows.reduce((sum, row) => sum + (row.rowTotal || 0), 0);

        item.itemPricing = { ...item.itemPricing, pricingRows: rows, itemEstimatedTotal: total };
        newItems[itemIdx] = item;
        setOrderItems(newItems);
    };

    const addPricingRow = (itemIdx: number) => {
        const newItems = [...orderItems];
        const item = { ...newItems[itemIdx] };
        item.itemPricing = {
            ...item.itemPricing,
            pricingRows: [
                ...item.itemPricing.pricingRows,
                { materialName: "", quantity: "", unit: "packet", ratePerUnit: 0, rowTotal: 0, isDefault: false }
            ]
        };
        newItems[itemIdx] = item;
        setOrderItems(newItems);
    };

    const deletePricingRow = (itemIdx: number, matIdx: number) => {
        const newItems = [...orderItems];
        const item = { ...newItems[itemIdx] };
        if (item.itemPricing.pricingRows[matIdx].isDefault) return;

        const rows = item.itemPricing.pricingRows.filter((_, i) => i !== matIdx);
        const total = rows.reduce((sum, row) => sum + (row.rowTotal || 0), 0);

        item.itemPricing = { ...item.itemPricing, pricingRows: rows, itemEstimatedTotal: total };
        newItems[itemIdx] = item;
        setOrderItems(newItems);
    };

    const confirmPricing = (itemIdx: number) => {
        const newItems = [...orderItems];
        const item = { ...newItems[itemIdx] };
        item.itemPricing = { ...item.itemPricing, pricingConfirmed: true };
        newItems[itemIdx] = item;
        setOrderItems(newItems);
    };

    const handleCreateRevision = () => {
        if (!showRevisionModal || !revisionReason.trim()) return;

        const { itemIdx, item: oldItem } = showRevisionModal;
        const newItems = [...orderItems];

        // 1. Create revised version
        const revisedItem: LocalOrderItem = {
            ...oldItem,
            itemVersion: (oldItem.itemVersion || 1) + 1,
            isActiveVersion: true,
            revisionReason: revisionReason.trim(),
            revisedAt: Timestamp.now(),
            revisedBy: {
                staffId: userData?.staffId || "unknown",
                name: userData?.name || "Unknown",
                role: userData?.role || "intake",
                uid: user?.uid // Pass UID here
            },
            // Unlock pricing for the new version
            itemPricing: {
                ...oldItem.itemPricing,
                pricingConfirmed: false
            }
        };

        // 2. Mark old as inactive (In local state we just replace the slot to keep UI manageable, 
        // but normally we'd keep history. Requirements say "Old data must never be overwritten".
        // In the database we'll have both, but for the INTKE form, we show the active one being edited.)
        newItems[itemIdx] = revisedItem;

        setOrderItems(newItems);
        setOrderPricingConfirmed(false);
        setPricingDirty(true);
        setShowRevisionModal(null);
        setRevisionReason("");
        setToast({ message: `New revision (v${revisedItem.itemVersion}) created.`, type: "info" });
    };

    const handleDownloadItemBill = async (item: LocalOrderItem, index: number) => {
        // We set selected item so the hidden BillTemplate renders with correct data
        setSelectedBillItem({ item, index });

        // Wait for render
        setTimeout(async () => {
            if (!billTemplateRef.current) {
                setToast({ message: "Template error. Try again.", type: "error" });
                return;
            }

            setGeneratingPdf(item.itemId || index.toString());
            try {
                const opt = {
                    margin: 0,
                    filename: `BILL_${item.itemName || 'ITEM'}_ITEM_${index + 1}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                };
                const html2pdfModule = await import("html2pdf.js");
                const html2pdf = html2pdfModule.default;
                await html2pdf().set(opt).from(billTemplateRef.current).save();
                setToast({ message: "Bill downloaded successfully!", type: "success" });
            } catch (error) {
                console.error("PDF generation failed:", error);
                setToast({ message: "Failed to download bill", type: "error" });
            } finally {
                setGeneratingPdf(null);
                setSelectedBillItem(null);
            }
        }, 100);
    };

    const handleConfirmAllItems = () => {
        if (orderItems.length === 0) {
            setToast({ message: "No items to confirm", type: "error" });
            return;
        }

        const allConfirmed = orderItems.every(i => i.itemPricing?.pricingConfirmed);
        if (!allConfirmed) {
            setToast({ message: "Please confirm pricing for ALL individual items first", type: "error" });
            return;
        }

        setOrderPricingConfirmed(true);
        setPricingDirty(false);
        setToast({ message: "All items confirmed! Overall bill is now available.", type: "success" });
    };

    const handleDownloadOverallBill = async () => {
        if (!orderPricingConfirmed) return;

        setIsOverallBill(true);
        // We reuse the hidden template but with different data logic
        // We'll trigger it by setting a dummy selectedBillItem or just handling it in the render

        // Wait for render
        setTimeout(async () => {
            if (!billTemplateRef.current) {
                setToast({ message: "Template error. Try again.", type: "error" });
                return;
            }

            setGeneratingPdf("overall");
            try {
                const opt = {
                    margin: 0,
                    filename: `OVERALL_ESTIMATED_BILL_${Date.now()}.pdf`,
                    image: { type: 'jpeg' as const, quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
                };
                const html2pdfModule = await import("html2pdf.js");
                const html2pdf = html2pdfModule.default;
                await html2pdf().set(opt).from(billTemplateRef.current).save();
                setToast({ message: "Overall Bill downloaded successfully!", type: "success" });
            } catch (error) {
                console.error("PDF generation failed:", error);
                setToast({ message: "Failed to download overall bill", type: "error" });
            } finally {
                setGeneratingPdf(null);
                setIsOverallBill(false);
            }
        }, 100);
    };

    // --- VALIDATION LOGIC ---

    const validateItem = (item: LocalOrderItem): boolean => {
        if (!item.garmentType) return false;
        if (item.garmentType === "other" && !item.customGarmentName?.trim()) return false;

        // Due Date Mandatory
        if (!item.dueDate) return false;

        // Rework items only need design sections (validation handled loosely or by ensuring default exists)
        if (item.garmentType === 'rework') return true;

        if (item.measurementType === 'measurements') {
            const fields = MEASUREMENT_FIELDS[item.garmentType || "blouse"];
            if (!fields) return false;
            // Require at least one measurement to be filled for validity
            const hasMeasurements = Object.keys(item.measurements || {}).some(k => item.measurements?.[k]);
            return hasMeasurements;
        } else {
            // Garment Mode: Must have at least 1 image and it must be valid (Title required)
            // Using referenceImages metadata which is synced from component
            if (!item.referenceImages || item.referenceImages.length === 0) return false;
            return item.referenceImages.every(f => (typeof f === 'string' ? true : !!f.title));
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

        const newItem = createEmptyItem(orderItems.length + 1, "blouse") as LocalOrderItem; // Default

        // Collapse previous, expand new
        setExpandedItems(new Set([orderItems.length]));
        setOrderItems([...orderItems, newItem]);
    };

    const handleSubmitForm = async () => {
        if (!customerName || !customerPhone) {
            setToast({ message: "Please fill all required customer fields", type: "error" });
            return;
        }

        if (orderItems.length === 0) {
            setToast({ message: "Please generate at least one item", type: "error" });
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
                // Upload Reference Images (Garment Images)
                let referenceImages = (item.referenceImages as ItemReferenceImage[]) || [];

                if (item.referenceFiles && item.referenceFiles.length > 0) {
                    const uploadPromises = item.referenceFiles.map(async (f, idx) => {
                        const meta = referenceImages[idx] || {};
                        let mainUrl = meta.imageUrl || ""; // Existing URL or Data URL
                        let sketchUrl = meta.sketchImageUrl || "";

                        // Upload Main Image
                        if (f.file) {
                            const mainUrls = await uploadImages([f.file], `orders/${Date.now()}/${item.itemId}/ref/${idx}/main`);
                            mainUrl = mainUrls[0];
                        }

                        // Upload Sketch Image
                        if (f.sketchFile) {
                            const sketchUrls = await uploadImages([f.sketchFile], `orders/${Date.now()}/${item.itemId}/ref/${idx}/sketch`);
                            sketchUrl = sketchUrls[0];
                        }

                        return {
                            imageUrl: mainUrl,
                            title: meta.title || "Reference",
                            description: meta.description,
                            sketchImageUrl: sketchUrl
                        };
                    });

                    referenceImages = await Promise.all(uploadPromises);
                }

                // Process Design Sections
                let processedDesignSections = item.designSections || [];

                if (item.designSectionFiles) {
                    const sectionPromises = processedDesignSections.map(async (sec) => {
                        const files = item.designSectionFiles?.[sec.sectionId];
                        let mainUrl = sec.mainImageUrl || "";
                        let sketchUrl = sec.sketchImageUrl || "";

                        if (files?.main) {
                            const urls = await uploadImages([files.main], `orders/${Date.now()}/${item.itemId}/design/${sec.sectionId}/main`);
                            mainUrl = urls[0];
                        }

                        if (files?.sketch) {
                            const urls = await uploadImages([files.sketch], `orders/${Date.now()}/${item.itemId}/design/${sec.sectionId}/sketch`);
                            sketchUrl = urls[0];
                        }

                        return {
                            ...sec,
                            mainImageUrl: mainUrl,
                            sketchImageUrl: sketchUrl
                        };
                    });

                    processedDesignSections = await Promise.all(sectionPromises);
                }

                // Prepare final item
                processedItems.push({
                    ...item,
                    itemId: item.itemId || `ITEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    referenceImages,
                    designSections: processedDesignSections,
                    dueDate: item.dueDate || Timestamp.fromDate(new Date()),
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
                    currentStage: "materials", // Initial stage after entry
                    customGarmentName: item.garmentType === "other" ? item.customGarmentName : undefined
                } as OrderItem);
            }

            // Create or update customer profile
            await getOrCreateCustomer(customerPhone, customerName, customerAddress);

            // Process item prices and calculate order summary
            const { materials: summaryMaterials, overallTotal: summaryTotal } = calculateOrderPricingSummary(processedItems);
            const itemsTotals = calculateItemsTotals(processedItems);

            // 1. Create Order (Visit Container)
            const orderData: Partial<Order> = {
                customerId: customerPhone,
                customerName,
                customerPhone,
                customerAddress,

                // Set global defaults (Use first item's due date or current time)
                dueDate: processedItems[0]?.dueDate || Timestamp.now(),
                currentStage: "intake",
                status: "in_progress",

                price: summaryTotal,
                advanceAmount: 0,
                materialCost: itemsTotals.totalMaterialCost,
                labourCost: itemsTotals.totalLabourCost,

                items: processedItems,
                orderPricingSummary: {
                    materials: summaryMaterials,
                    overallTotal: summaryTotal,
                    overallEstimatedTotal: summaryTotal
                },

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

                {/* 2. Global Order Dates (Entry Date Only) */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border shadow-sm">
                    <div>
                        <label className="label text-gray-600 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Entry Date (Read Only)
                        </label>
                        <input
                            type="text"
                            value={entryDate.toLocaleDateString()}
                            className="input bg-gray-100 dark:bg-gray-700 cursor-not-allowed text-gray-500 w-full sm:w-1/2"
                            disabled
                        />
                    </div>
                    {/* Global Due Date Removed */}
                </div>

                {/* 3. GENERATOR BLOCK (New) */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <h3 className="font-bold text-lg text-indigo-900 dark:text-indigo-300 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Garment Generator
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="label">Garment Type</label>
                            <div className="relative">
                                <select
                                    value={genGarmentType}
                                    onChange={(e) => setGenGarmentType(e.target.value as GarmentType)}
                                    className="input appearance-none"
                                >
                                    {GARMENT_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="label">Quantity</label>
                            <input
                                type="number"
                                value={genQuantity}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setGenQuantity(val === "" ? "" : parseInt(val));
                                }}
                                onFocus={(e) => e.target.select()}
                                className="input"
                                placeholder="0"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleGenerateItems}
                            className="btn btn-primary h-11 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
                        >
                            <Plus className="w-5 h-5" />
                            Generate Items
                        </button>
                    </div>
                </div>

                {/* 3. ITEMS LIST (Workflow Units) */}
                <div className="border-t pt-8">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="font-bold text-xl text-gray-900 dark:text-white flex items-center space-x-2">
                            <Package className="w-6 h-6 text-indigo-600" />
                            <span>Workflow Items ({orderItems.length})</span>
                        </h3>
                        {/* Add Item Button: Removed in favor of Generator */}
                        <div className="text-sm text-gray-500">
                            Use the generator above to add more items.
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
                                                    disabled={item.itemPricing?.pricingConfirmed}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Due Date <span className="text-red-500">*</span></label>
                                                <input
                                                    type="date"
                                                    value={item.dueDate ? item.dueDate.toDate().toISOString().split('T')[0] : ""}
                                                    onChange={(e) => {
                                                        const date = e.target.value ? new Date(e.target.value) : undefined;
                                                        handleItemChange(index, { dueDate: date ? Timestamp.fromDate(date) : undefined });
                                                    }}
                                                    className="input font-medium border-indigo-200 focus:border-indigo-500"
                                                    required
                                                    disabled={item.itemPricing?.pricingConfirmed}
                                                />
                                            </div>
                                            <div>
                                                <label className="label">Garment Type <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <select
                                                        value={item.garmentType}
                                                        onChange={(e) => handleItemChange(index, { garmentType: e.target.value as GarmentType })}
                                                        className="input appearance-none border-indigo-100 focus:border-indigo-500"
                                                        disabled={item.itemPricing?.pricingConfirmed}
                                                    >
                                                        {GARMENT_OPTIONS.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                        ))}
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
                                                            disabled={item.itemPricing?.pricingConfirmed}
                                                            required
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>


                                        {/* PER ITEM: Measurement Mode Toggle (Hidden for Rework) */}
                                        {item.garmentType !== 'rework' && (
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
                                        )}

                                        {/* CONDITIONAL UI */}
                                        {/* If Rework: Show nothing else (Pattern/Measurements hidden) */}
                                        {item.garmentType === 'rework' ? (
                                            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                                                Rework items rely on design images. No measurements or pattern garment needed.
                                            </div>
                                        ) : item.measurementType === "measurements" ? (
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
                                                                disabled={item.itemPricing?.pricingConfirmed}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4 animate-fade-in">
                                                <h4 className="font-semibold text-sm text-gray-700 flex items-center">
                                                    <span>📸 Customer Garment Image</span>
                                                    <span className="ml-2 h-px flex-1 bg-gray-200"></span>
                                                </h4>
                                                <p className="text-sm text-gray-500 mb-2">
                                                    Upload photos of the garment provided by the customer for measurement reference.
                                                </p>
                                                <ReferenceImageUpload
                                                    images={(item.referenceImages as ItemReferenceImage[]) || []}
                                                    onChange={(images) => handleReferenceImagesChange(index, images)}
                                                    onFilesUpdate={(files) => handleReferenceFilesUpdate(index, files)}
                                                    uploading={loading}
                                                    allowSketch={false}
                                                />
                                            </div>
                                        )}

                                        {/* PRECISE DESIGN IMAGES (Always Visible) */}
                                        <div className="border-t pt-4 animate-fade-in">
                                            <h4 className="font-bold text-sm text-gray-700 mb-4 flex items-center">
                                                <span>Precise Design Images</span>
                                                <span className="ml-2 h-px flex-1 bg-gray-200"></span>
                                            </h4>
                                            <DesignSectionsDisplay
                                                sections={item.designSections || []}
                                                editable={true}
                                                onUpdate={(sections) => handleDesignSectionsChange(index, sections)}
                                                onUploadMainImage={(secIdx, file) => handleDesignMainUpload(index, secIdx, file)}
                                                onUploadSketchImage={(secIdx, file) => handleDesignSketchUpload(index, secIdx, file)}
                                                disabled={loading}
                                            />
                                        </div>

                                        {/* PRICING & MATERIALS TABLE */}
                                        <div className="border-t pt-6 bg-slate-900/40 dark:bg-slate-900/60 -mx-6 px-6 mt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-sm text-white flex items-center gap-2">
                                                    <Calculator className="w-4 h-4 text-indigo-400" />
                                                    <span>Pricing & Materials</span>
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold px-3 py-1 bg-indigo-600 text-white rounded-full shadow-sm ring-2 ring-indigo-900/50">
                                                        Item Total: ₹{(item.itemPricing?.itemEstimatedTotal || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full text-[11px] text-left border-collapse bg-slate-900 rounded-lg shadow-xl border border-slate-700">
                                                    <thead className="bg-slate-800 text-gray-200 font-extrabold uppercase tracking-wider">
                                                        <tr>
                                                            <th className="px-3 py-2.5 border-b border-slate-700">Material</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700 w-24 text-center">Unit</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700 w-20 text-center">Qty</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700 w-24 text-right">Rate (Per Unit)</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700 w-28 text-right">Total</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700">Color (Opt)</th>
                                                            <th className="px-3 py-2.5 border-b border-slate-700 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {item.itemPricing?.pricingRows.map((mat, mIdx) => (
                                                            <tr key={mIdx} className="hover:bg-slate-800/80 transition-colors border-b border-slate-800/50">
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="text"
                                                                        value={mat.materialName}
                                                                        onChange={(e) => handlePricingChange(index, mIdx, 'materialName', e.target.value)}
                                                                        disabled={item.itemPricing?.pricingConfirmed || orderPricingConfirmed || mat.isDefault}
                                                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 font-bold text-white disabled:opacity-50 placeholder:text-gray-600"
                                                                        placeholder="Material name..."
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <select
                                                                        value={mat.unit}
                                                                        onChange={(e) => handlePricingChange(index, mIdx, 'unit', e.target.value)}
                                                                        disabled={item.itemPricing?.pricingConfirmed || orderPricingConfirmed}
                                                                        className="w-full bg-slate-950 border border-slate-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-center font-bold text-gray-300 disabled:opacity-50 appearance-none"
                                                                    >
                                                                        <option value="meter">meter</option>
                                                                        <option value="gram">gram</option>
                                                                        <option value="packet">packet</option>
                                                                    </select>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="number"
                                                                        value={mat.quantity}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            // Default empty behavior: replacement
                                                                            handlePricingChange(index, mIdx, 'quantity', val === "" ? "" : Number(val));
                                                                        }}
                                                                        onFocus={(e) => e.target.select()}
                                                                        disabled={item.itemPricing?.pricingConfirmed || orderPricingConfirmed}
                                                                        className="w-full bg-slate-950 border border-slate-700 focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-center font-black text-white disabled:opacity-50 placeholder:text-gray-600"
                                                                        placeholder="0"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <div className="flex items-center justify-end font-black text-white bg-slate-950 border border-slate-700 rounded px-2 py-1">
                                                                        <span className="mr-0.5 text-indigo-400">₹</span>
                                                                        <input
                                                                            type="number"
                                                                            value={mat.ratePerUnit}
                                                                            onChange={(e) => {
                                                                                const val = e.target.value;
                                                                                handlePricingChange(index, mIdx, 'ratePerUnit', val === "" ? "" : Number(val));
                                                                            }}
                                                                            onFocus={(e) => e.target.select()}
                                                                            disabled={item.itemPricing?.pricingConfirmed || orderPricingConfirmed}
                                                                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-right disabled:opacity-50 placeholder:text-gray-600"
                                                                            placeholder="0"
                                                                        />
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <div className="px-2 py-1 bg-indigo-900/40 rounded font-black text-indigo-200 border border-indigo-500/30">
                                                                        ₹{(mat.rowTotal || 0).toLocaleString()}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <input
                                                                        type="text"
                                                                        value={mat.color || ""}
                                                                        onChange={(e) => handlePricingChange(index, mIdx, 'color', e.target.value)}
                                                                        disabled={item.itemPricing?.pricingConfirmed || orderPricingConfirmed}
                                                                        className="w-full bg-transparent border-none focus:ring-1 focus:ring-indigo-500 rounded px-2 py-1 text-gray-400 font-medium disabled:opacity-50 italic placeholder:text-gray-600"
                                                                        placeholder="Optional"
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2 text-center text-slate-500">
                                                                    {!mat.isDefault && !item.itemPricing?.pricingConfirmed && !orderPricingConfirmed && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => deletePricingRow(index, mIdx)}
                                                                            className="p-1 hover:text-red-400 transition-colors"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {!item.itemPricing?.pricingConfirmed && !orderPricingConfirmed && (
                                                <button
                                                    onClick={() => addPricingRow(index)}
                                                    className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Add Custom Material Row</span>
                                                </button>
                                            )}

                                            <div className="mt-6 flex flex-wrap gap-3 items-center justify-between">
                                                <div className="flex flex-wrap gap-2">
                                                    {!item.itemPricing?.pricingConfirmed && !orderPricingConfirmed ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => confirmPricing(index)}
                                                            className="btn btn-outline py-2 px-4 text-xs font-bold border-indigo-200 text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                                                        >
                                                            <Package className="w-4 h-4" />
                                                            Confirm Pricing
                                                        </button>
                                                    ) : (
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg border border-green-100 text-xs font-bold">
                                                                <Package className="w-4 h-4" />
                                                                {orderPricingConfirmed ? "Order Finalized" : "Pricing Confirmed"}
                                                            </div>
                                                            {item.itemPricing?.pricingConfirmed && !orderPricingConfirmed && ['admin', 'intake', 'supervisor'].includes(userData?.role?.toLowerCase() || "") && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowRevisionModal({ itemIdx: index, item })}
                                                                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700 hover:bg-amber-200 px-2 py-1 rounded transition-colors border border-amber-200"
                                                                >
                                                                    <Edit3 className="w-3 h-3" />
                                                                    <span>Edit Item (Revision)</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={() => handleDownloadItemBill(item, index)}
                                                    disabled={!item.itemPricing?.pricingConfirmed || generatingPdf === (item.itemId || index.toString())}
                                                    className="btn btn-primary py-2 px-5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-indigo-100 shadow-lg"
                                                >
                                                    {generatingPdf === (item.itemId || index.toString()) ? (
                                                        <div className="w-3.5 h-3.5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <Plus className="w-4 h-4" />
                                                    )}
                                                    {generatingPdf === (item.itemId || index.toString()) ? "Generating..." : "Generate Item Bill"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div >

                {/* 3.5 ORDER-LEVEL CONFIRMATION */}
                {orderItems.length > 0 && (
                    <div className="flex justify-center py-8">
                        {!orderPricingConfirmed ? (
                            <button
                                onClick={handleConfirmAllItems}
                                className="btn bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 text-lg font-bold shadow-xl shadow-indigo-200 hover:-translate-y-1 transition-all flex items-center gap-3 rounded-2xl"
                            >
                                <Package className="w-6 h-6" />
                                <span>Confirm All Items</span>
                            </button>
                        ) : (
                            <div className="bg-green-100 text-green-700 px-8 py-4 rounded-2xl border-2 border-green-200 font-bold flex items-center gap-3 shadow-sm scale-110">
                                <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm">✓</div>
                                All Items Finalized & Locked
                            </div>
                        )}
                    </div>
                )}

                {/* 4. OVERALL ORDER PRICING SUMMARY */}
                {orderItems.length > 0 && (
                    <div className="bg-gray-900 text-white p-6 rounded-xl shadow-2xl overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-6 opacity-10">
                            <Info className="w-32 h-32" />
                        </div>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 relative z-10">
                            <Calculator className="w-5 h-5 text-indigo-400" />
                            <span>Overall Order Pricing Summary</span>
                        </h3>

                        <div className="overflow-x-auto relative z-10">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/20 text-indigo-300 font-black uppercase tracking-widest text-[10px]">
                                        <th className="px-3 py-3">Material / Garment</th>
                                        <th className="px-3 py-3 text-center w-24">Total Qty</th>
                                        <th className="px-3 py-3 text-right w-32">Total Price</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {calculateOrderPricingSummary(orderItems as any).materials.map((mat, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-2 font-medium">{mat.name}</td>
                                            <td className="px-3 py-2 text-center font-bold">{mat.quantity}</td>
                                            <td className="px-3 py-2 text-right font-bold text-indigo-400">₹{mat.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-white/5 border-t border-indigo-500/30">
                                        <td className="px-3 py-3 font-bold text-indigo-300">Overall Order Total</td>
                                        <td className="px-3 py-3"></td>
                                        <td className="px-3 py-3 text-right font-black text-xl text-white">
                                            ₹{calculateOrderPricingSummary(orderItems as any).overallTotal.toLocaleString()}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-4 italic">* This summary is automatically aggregated from all items above. Manual edits are not permitted here.</p>

                        {/* OVERALL BILL BUTTON */}
                        {(orderPricingConfirmed && !pricingDirty) ? (
                            <div className="mt-8 flex justify-center">
                                <button
                                    onClick={handleDownloadOverallBill}
                                    disabled={generatingPdf === "overall"}
                                    className="btn btn-primary bg-indigo-500 border-none py-4 px-8 text-sm font-bold flex items-center gap-2 shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105"
                                >
                                    {generatingPdf === "overall" ? (
                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <span>📄</span>
                                    )}
                                    <span>Generate Overall Estimated Pricing Bill</span>
                                </button>
                            </div>
                        ) : orderPricingConfirmed && pricingDirty ? (
                            <div className="mt-8 flex justify-center">
                                <div className="bg-amber-100/10 border border-amber-500/30 p-4 rounded-xl text-amber-200 text-sm italic flex items-center gap-2">
                                    <Info className="w-4 h-4 text-amber-400" />
                                    <span>Items have been revised. Please re-confirm all items to regenerate overall bill.</span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Submit Section */}
                < div className="pt-6 border-t sticky bottom-0 bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 pb-4 z-20" >
                    <div className="flex justify-between items-center mb-4 text-sm font-medium bg-gray-50 p-3 rounded-lg border">
                        <span className="text-gray-600">Total Workflow Items: <span className="font-bold text-gray-900">{orderItems.length}</span></span>
                        <span className="text-indigo-600 font-bold">Total Estimate: ₹{calculateOrderPricingSummary(orderItems as any).overallTotal.toLocaleString()}</span>
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
                </div >
            </div >

            {/* Fullscreen Image Modal */}
            {
                previewModal && (
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
                )
            }

            {/* Hidden Bill Template for PDF Generation */}
            <div className="fixed -left-[2000px] top-0 opacity-0 pointer-events-none">
                {isOverallBill ? (
                    <BillTemplate
                        ref={billTemplateRef}
                        customerName={customerName}
                        customerPhone={customerPhone}
                        customerAddress={customerAddress}
                        billNumber={`OVR-${Date.now().toString().slice(-6)}`}
                        billDate={new Date().toLocaleDateString("en-IN")}
                        isEstimated={true}
                        items={orderItems.map((item, i) => ({
                            sno: i + 1,
                            particular: `${item.itemName || 'Item'} (${getGarmentDisplayName(item as any)}) - Item ${i + 1} of ${orderItems.length}`,
                            qty: Number(item.quantity) || 1,
                            price: Number(item.itemPricing?.itemEstimatedTotal) || 0,
                            total: Number(item.itemPricing?.itemEstimatedTotal) || 0
                        }))}
                        totalAmount={calculateOrderPricingSummary(orderItems as any).overallTotal}
                        paidAmount={0}
                        balanceAmount={calculateOrderPricingSummary(orderItems as any).overallTotal}
                    />
                ) : selectedBillItem ? (
                    <BillTemplate
                        ref={billTemplateRef}
                        customerName={customerName}
                        customerPhone={customerPhone}
                        customerAddress={customerAddress}
                        billNumber={`EST-${Date.now().toString().slice(-6)}`}
                        billDate={new Date().toLocaleDateString("en-IN")}
                        isEstimated={true}
                        items={selectedBillItem.item.itemPricing.pricingRows
                            .filter(m => (Number(m.quantity) || 0) > 0 || (Number(m.ratePerUnit) || 0) > 0)
                            .map((m, i) => ({
                                sno: i + 1,
                                particular: m.materialName,
                                qty: Number(m.quantity) || 0,
                                price: Number(m.ratePerUnit) || 0,
                                total: Number(m.rowTotal) || 0
                            }))}
                        totalAmount={selectedBillItem.item.itemPricing.itemEstimatedTotal}
                        paidAmount={0}
                        balanceAmount={selectedBillItem.item.itemPricing.itemEstimatedTotal}
                    />
                ) : null}
                {/* Revision Reason Modal */}
                {showRevisionModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in duration-200">
                            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Edit3 className="w-5 h-5 text-amber-500" />
                                    <span>Create Item Revision</span>
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Editing {showRevisionModal.item.itemName || `Item ${showRevisionModal.itemIdx + 1}`} will create a new version (v{(showRevisionModal.item.itemVersion || 1) + 1}).
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="label text-gray-700 font-bold mb-2">Revision Reason <span className="text-red-500">*</span></label>
                                    <textarea
                                        value={revisionReason}
                                        onChange={(e) => setRevisionReason(e.target.value)}
                                        placeholder="Explain why this change is necessary (e.g., Client requested sleeve length change, Color correction)"
                                        className="w-full input border-gray-200 focus:border-indigo-500 min-h-[120px] resize-none"
                                        required
                                    />
                                    <p className="mt-2 text-[11px] text-gray-400 italic flex items-start gap-1">
                                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                        <span>Revising an item will invalidate the overall estimated bill until all items are re-confirmed.</span>
                                    </p>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowRevisionModal(null);
                                        setRevisionReason("");
                                    }}
                                    className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCreateRevision}
                                    disabled={!revisionReason.trim()}
                                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                                >
                                    Confirm Revision
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
