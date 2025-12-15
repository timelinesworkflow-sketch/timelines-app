"use client";

import { useState } from "react";
import { OrderItem, GarmentType, MEASUREMENT_FIELDS, MEASUREMENT_LABELS, ItemStatus } from "@/types";
import { createEmptyItem } from "@/lib/orderItems";
import { Timestamp } from "firebase/firestore";
import { Plus, Trash2, ChevronDown, ChevronUp, Package } from "lucide-react";

interface MultiItemInputProps {
    items: Partial<OrderItem>[];
    onChange: (items: Partial<OrderItem>[]) => void;
    defaultGarmentType?: GarmentType;
    disabled?: boolean;
}

export default function MultiItemInput({
    items,
    onChange,
    defaultGarmentType = "blouse",
    disabled = false,
}: MultiItemInputProps) {
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0]));

    const addItem = () => {
        const newItem = createEmptyItem(items.length + 1, defaultGarmentType);
        onChange([...items, newItem]);
        setExpandedItems(new Set([...expandedItems, items.length]));
    };

    const removeItem = (index: number) => {
        if (items.length === 1) return; // Keep at least one item
        const newItems = items.filter((_, i) => i !== index);
        onChange(newItems);
        const newExpanded = new Set(expandedItems);
        newExpanded.delete(index);
        setExpandedItems(newExpanded);
    };

    const updateItem = (index: number, updates: Partial<OrderItem>) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], ...updates };
        onChange(newItems);
    };

    const toggleExpand = (index: number) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedItems(newExpanded);
    };

    const updateMeasurement = (itemIndex: number, field: string, value: string) => {
        const item = items[itemIndex];
        const newMeasurements = { ...(item.measurements || {}), [field]: value };
        updateItem(itemIndex, { measurements: newMeasurements });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <span>Order Items ({items.length})</span>
                </h3>
                <button
                    type="button"
                    onClick={addItem}
                    disabled={disabled}
                    className="btn btn-outline text-sm flex items-center space-x-1"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                </button>
            </div>

            <div className="space-y-3">
                {items.map((item, index) => (
                    <div
                        key={item.itemId || index}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                    >
                        {/* Item Header */}
                        <div
                            className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(index)}
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
                                        {item.garmentType?.replace(/_/g, " ") || "No type"} • Qty: {item.quantity || 1}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {items.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeItem(index);
                                        }}
                                        disabled={disabled}
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
                                        <label className="label">Item Name *</label>
                                        <input
                                            type="text"
                                            value={item.itemName || ""}
                                            onChange={(e) => updateItem(index, { itemName: e.target.value })}
                                            className="input"
                                            placeholder="e.g., Blouse, Chudidar"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Garment Type</label>
                                        <select
                                            value={item.garmentType || "blouse"}
                                            onChange={(e) => updateItem(index, { garmentType: e.target.value as GarmentType })}
                                            className="input"
                                            disabled={disabled}
                                        >
                                            <option value="blouse">Blouse</option>
                                            <option value="chudi">Chudi</option>
                                            <option value="frock">Frock</option>
                                            <option value="pavadai_sattai">Pavadai Sattai</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Quantity</label>
                                        <input
                                            type="number"
                                            value={item.quantity || 1}
                                            onChange={(e) => updateItem(index, { quantity: parseInt(e.target.value) || 1 })}
                                            className="input"
                                            min="1"
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>

                                {/* Row 2: Costs and Deadline */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="label">Material Cost (₹)</label>
                                        <input
                                            type="number"
                                            value={item.materialCost || ""}
                                            onChange={(e) => updateItem(index, { materialCost: parseFloat(e.target.value) || 0 })}
                                            className="input"
                                            placeholder="0"
                                            min="0"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Labour Cost (₹)</label>
                                        <input
                                            type="number"
                                            value={item.labourCost || ""}
                                            onChange={(e) => updateItem(index, { labourCost: parseFloat(e.target.value) || 0 })}
                                            className="input"
                                            placeholder="0"
                                            min="0"
                                            disabled={disabled}
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Deadline</label>
                                        <input
                                            type="date"
                                            value={item.deadline instanceof Timestamp
                                                ? item.deadline.toDate().toISOString().split("T")[0]
                                                : new Date().toISOString().split("T")[0]}
                                            onChange={(e) => updateItem(index, {
                                                deadline: Timestamp.fromDate(new Date(e.target.value))
                                            })}
                                            className="input"
                                            disabled={disabled}
                                        />
                                    </div>
                                </div>

                                {/* Design Notes */}
                                <div>
                                    <label className="label">Design Notes</label>
                                    <textarea
                                        value={item.designNotes || ""}
                                        onChange={(e) => updateItem(index, { designNotes: e.target.value })}
                                        className="input"
                                        rows={2}
                                        placeholder="Special instructions, design requirements..."
                                        disabled={disabled}
                                    />
                                </div>

                                {/* Measurements */}
                                <div>
                                    <label className="label mb-2">Measurements</label>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                        {MEASUREMENT_FIELDS[item.garmentType || "blouse"]?.map((field) => (
                                            <div key={field}>
                                                <label className="text-xs text-gray-500">
                                                    {MEASUREMENT_LABELS[field] || field}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={item.measurements?.[field] || ""}
                                                    onChange={(e) => updateMeasurement(index, field, e.target.value)}
                                                    className="input text-sm"
                                                    placeholder="0"
                                                    disabled={disabled}
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

            {/* Summary */}
            {items.length > 0 && (
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <p className="text-sm text-indigo-700 dark:text-indigo-300">
                        <strong>{items.length}</strong> item(s) •
                        Total Material: <strong>₹{items.reduce((sum, i) => sum + (i.materialCost || 0), 0).toLocaleString()}</strong> •
                        Total Labour: <strong>₹{items.reduce((sum, i) => sum + (i.labourCost || 0), 0).toLocaleString()}</strong>
                    </p>
                </div>
            )}
        </div>
    );
}
