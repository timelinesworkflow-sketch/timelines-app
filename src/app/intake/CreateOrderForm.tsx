"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, Order, PlannedMaterial } from "@/types";
import { createOrder, updateOrder, addTimelineEntry } from "@/lib/orders";
import { uploadImages } from "@/lib/storage";
import { Timestamp } from "firebase/firestore";
import { X, Upload, Send, Check } from "lucide-react";
import Toast from "@/components/Toast";
import PlannedMaterialsInput from "@/components/PlannedMaterialsInput";

interface CreateOrderFormProps {
    onClose: () => void;
}

export default function CreateOrderForm({ onClose }: CreateOrderFormProps) {
    const { userData } = useAuth();
    const [step, setStep] = useState<"form" | "review" | "otp">("form");
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

    // OTP state
    const [inputOTP, setInputOTP] = useState("");
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

                // Detect 404 Not Found (Bucket missing)
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

            // Filter valid planned materials (non-empty)
            const validPlannedMaterials = plannedMaterials.filter(
                m => m.materialId.trim() !== "" || m.materialName.trim() !== ""
            );

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
                // Add planned materials (for materials stage reference)
                plannedMaterials: validPlannedMaterials.length > 0 ? {
                    items: validPlannedMaterials,
                    plannedByStaffId: userData?.staffId || "",
                    plannedByStaffName: userData?.name || "",
                    plannedAt: Timestamp.now(),
                } : undefined,
            };

            const orderId = await createOrder(orderData);
            setTempOrderId(orderId);

            // BYPASS OTP - Directly confirm order for testing
            // TODO: Re-enable OTP when SMS service is configured
            // Future logic: if (otpVerified) { moveToFirstStage(); }

            // Get the first active workflow stage after intake
            const firstStage = activeStages[0]; // e.g., "materials", "marking", etc.

            await updateOrder(orderId, {
                confirmedAt: Timestamp.now(),
                status: "in_progress",
                currentStage: firstStage, // Move to first active stage immediately
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

            // Reset form and go back to main page
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

    const handleVerifyOTP = async () => {
        setLoading(true);

        try {
            // Verify OTP via API route
            const verifyResponse = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: tempOrderId, otp: inputOTP })
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok) {
                setToast({ message: verifyData.error || "Invalid OTP", type: "error" });
                setLoading(false);
                return;
            }

            // Update currentStage locally (API already set status)
            const { updateOrder } = await import("@/lib/orders");
            await updateOrder(tempOrderId, {
                currentStage: activeStages[0] || "materials",
            });

            setToast({ message: "Order confirmed successfully!", type: "success" });
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (error) {
            console.error("Verification error:", error);
            setToast({ message: "Failed to confirm order", type: "error" });
            setLoading(false);
        }
    };

    if (step === "review") {
        return (
            <div className="card max-w-2xl mx-auto">
                {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Review Order</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4 mb-6">
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{customerName}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Phone</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{customerPhone}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Garment Type</p>
                        <p className="font-semibold text-gray-900 dark:text-white capitalize">{garmentType.replace(/_/g, " ")}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Due Date</p>
                        <p className="font-semibold text-gray-900 dark:text-white">{new Date(dueDate).toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                    <p className="text-sm text-blue-800 dark:text-blue-400">
                        An OTP has been sent to <strong>{customerPhone}</strong>
                    </p>
                </div>

                <div className="mb-6">
                    <label className="label">Enter OTP</label>
                    <input
                        type="text"
                        maxLength={6}
                        value={inputOTP}
                        onChange={(e) => setInputOTP(e.target.value.replace(/\D/g, ""))}
                        className="input text-center text-2xl tracking-widest"
                        placeholder="000000"
                    />
                </div>

                <button
                    onClick={handleVerifyOTP}
                    disabled={loading || inputOTP.length !== 6}
                    className="w-full btn btn-primary disabled:opacity-50"
                >
                    {loading ? "Confirming..." : "Confirm Order"}
                </button>
            </div>
        );
    }

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
                        <label className="label">Customer Name *</label>
                        <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="input"
                            placeholder="Enter customer name"
                            required
                        />
                    </div>
                    <div>
                        <label className="label">Phone Number *</label>
                        <input
                            type="tel"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="input"
                            placeholder="Enter phone number"
                            required
                        />
                    </div>
                </div>

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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Garment Type *</label>
                        <select
                            value={garmentType}
                            onChange={(e) => setGarmentType(e.target.value as GarmentType)}
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
                        <label className="label">Due Date *</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                            className="input"
                            required
                            min={new Date().toISOString().split("T")[0]}
                        />
                    </div>
                </div>

                {/* Measurements */}
                <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Measurements</h3>
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

                {/* Materials Required - Planning Only */}
                <PlannedMaterialsInput
                    initialItems={plannedMaterials}
                    onChange={setPlannedMaterials}
                    disabled={loading}
                />

                {/* Sampler Images */}
                <div>
                    <label className="label">Reference/Sampler Images (max 3)</label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFilesChange}
                            className="hidden"
                            id="sampler-upload"
                        />
                        <label htmlFor="sampler-upload" className="cursor-pointer">
                            <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Click to upload images
                            </p>
                            {samplerFiles.length > 0 && (
                                <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                                    {samplerFiles.length} file(s) selected
                                </p>
                            )}
                        </label>
                    </div>
                </div>

                {/* Active Stages */}
                <div>
                    <label className="label">Required Stages</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {["materials", "marking", "cutting", "stitching", "hooks", "ironing", "billing"].map(
                            (stage) => (
                                <label key={stage} className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={activeStages.includes(stage)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setActiveStages([...activeStages, stage]);
                                            } else {
                                                setActiveStages(activeStages.filter((s) => s !== stage));
                                            }
                                        }}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <span className="text-sm capitalize">{stage}</span>
                                </label>
                            )
                        )}
                    </div>
                </div>

                {/* Particulars */}
                <div>
                    <label className="label">Particulars / Description</label>
                    <textarea
                        value={particulars}
                        onChange={(e) => setParticulars(e.target.value)}
                        className="input"
                        rows={3}
                        placeholder="Any special instructions or details"
                    />
                </div>

                <button
                    onClick={handleSubmitForm}
                    disabled={loading}
                    className="w-full btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                    {loading ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                            <span>Creating...</span>
                        </>
                    ) : (
                        <>
                            <Send className="w-5 h-5" />
                            <span>Send OTP & Review</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
