"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Trash2, Ruler, Camera } from "lucide-react";
import {
    GarmentType,
    MEASUREMENT_FIELDS,
    MEASUREMENT_LABELS,
    OrderItem,
    ItemMeasurementType,
    ItemReferenceImage
} from "@/types";
import ReferenceImageUpload from "./ReferenceImageUpload";

interface ItemFormProps {
    item: Partial<OrderItem>;
    itemIndex: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    onUpdate: (item: Partial<OrderItem>) => void;
    onRemove: () => void;
    canRemove: boolean;
}

// Garment type options
const GARMENT_TYPES: { value: GarmentType; label: string }[] = [
    { value: "blouse", label: "Blouse" },
    { value: "chudi", label: "Chudidar" },
    { value: "frock", label: "Frock" },
    { value: "pavadai_sattai", label: "Pavadai Sattai" },
    { value: "aari_blouse", label: "Aari Blouse" },
    { value: "aari_pavada_sattai", label: "Aari Pavadai Sattai" },
    { value: "other", label: "Other" },
];

export default function ItemForm({
    item,
    itemIndex,
    isExpanded,
    onToggleExpand,
    onUpdate,
    onRemove,
    canRemove,
}: ItemFormProps) {
    const [measurementType, setMeasurementType] = useState<ItemMeasurementType>(
        item.measurementType || "measurements"
    );
    const [garmentType, setGarmentType] = useState<GarmentType>(
        item.garmentType || "blouse"
    );
    const [measurements, setMeasurements] = useState<Record<string, string>>(
        (item.measurements as Record<string, string>) || {}
    );
    const [referenceImages, setReferenceImages] = useState<ItemReferenceImage[]>(
        (item.referenceImages as ItemReferenceImage[]) || []
    );
    const [designNotes, setDesignNotes] = useState(item.designNotes || "");

    // Get measurement fields for current garment type
    const getMeasurementFields = () => {
        const baseType = garmentType === "aari_blouse" ? "blouse"
            : garmentType === "aari_pavada_sattai" ? "pavadai_sattai"
                : garmentType;
        return MEASUREMENT_FIELDS[baseType] || MEASUREMENT_FIELDS["blouse"];
    };

    // Update parent when any field changes
    useEffect(() => {
        onUpdate({
            ...item,
            garmentType,
            measurementType,
            measurements: measurements as { [key: string]: number | string },
            referenceImages,
            designNotes,
        });
    }, [garmentType, measurementType, measurements, referenceImages, designNotes]);

    // Initialize measurements when garment type changes
    useEffect(() => {
        const fields = getMeasurementFields();
        const newMeasurements: Record<string, string> = {};
        fields.forEach((field) => {
            newMeasurements[field] = measurements[field] || "";
        });
        setMeasurements(newMeasurements);
    }, [garmentType]);

    const handleMeasurementChange = (field: string, value: string) => {
        setMeasurements((prev) => ({ ...prev, [field]: value }));
    };

    const handleImagesChange = (images: ItemReferenceImage[]) => {
        setReferenceImages(images);
    };

    const handleFileUpload = (files: File[], index: number) => {
        // This will be handled by the parent component for actual upload
        console.log("Files to upload:", files, "at index:", index);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Header - Always visible */}
            <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3">
                    <span className="bg-cyan-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        Item #{itemIndex + 1}
                    </span>
                    <span className="text-gray-300">
                        {GARMENT_TYPES.find(g => g.value === garmentType)?.label || "Select Garment"}
                    </span>
                    {measurementType === "measurements" ? (
                        <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/20 px-2 py-1 rounded">
                            <Ruler className="w-3 h-3" /> Measurements
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded">
                            <Camera className="w-3 h-3" /> Garment
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {canRemove && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onRemove();
                            }}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-slate-700">
                    {/* Garment Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Garment Type
                        </label>
                        <select
                            value={garmentType}
                            onChange={(e) => setGarmentType(e.target.value as GarmentType)}
                            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none"
                        >
                            {GARMENT_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Measurement Type Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            How will measurements be provided?
                        </label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setMeasurementType("measurements")}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${measurementType === "measurements"
                                        ? "bg-blue-600 text-white border-2 border-blue-400"
                                        : "bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500"
                                    }`}
                            >
                                <Ruler className="w-5 h-5" />
                                Measurements
                            </button>
                            <button
                                type="button"
                                onClick={() => setMeasurementType("measurement_garment")}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${measurementType === "measurement_garment"
                                        ? "bg-green-600 text-white border-2 border-green-400"
                                        : "bg-slate-700 text-gray-300 border-2 border-slate-600 hover:border-slate-500"
                                    }`}
                            >
                                <Camera className="w-5 h-5" />
                                Measurement Garment
                            </button>
                        </div>
                    </div>

                    {/* Measurements Section (if measurementType = "measurements") */}
                    {measurementType === "measurements" && (
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-300 mb-3">
                                Enter Measurements (in inches)
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {getMeasurementFields().map((field) => (
                                    <div key={field}>
                                        <label className="block text-xs text-gray-400 mb-1">
                                            {MEASUREMENT_LABELS[field] || field}
                                        </label>
                                        <input
                                            type="text"
                                            value={measurements[field] || ""}
                                            onChange={(e) => handleMeasurementChange(field, e.target.value)}
                                            placeholder="0"
                                            className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg text-sm border border-slate-500 focus:border-cyan-500 focus:outline-none"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reference Images Section (if measurementType = "measurement_garment") */}
                    {measurementType === "measurement_garment" && (
                        <div className="bg-slate-700/50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-300 mb-3">
                                Reference Images
                            </h4>
                            <ReferenceImageUpload
                                images={referenceImages}
                                onChange={handleImagesChange}
                                onFileUpload={handleFileUpload}
                            />
                        </div>
                    )}

                    {/* Design Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Design Notes (Optional)
                        </label>
                        <textarea
                            value={designNotes}
                            onChange={(e) => setDesignNotes(e.target.value)}
                            placeholder="Any special instructions or notes for this item..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-700 text-white rounded-lg border border-slate-600 focus:border-cyan-500 focus:outline-none resize-none"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
