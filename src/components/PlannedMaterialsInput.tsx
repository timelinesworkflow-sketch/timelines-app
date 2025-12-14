"use client";

import { useState } from "react";
import { PlannedMaterial } from "@/types";
import { Plus, Trash2, Package, AlertCircle } from "lucide-react";

interface PlannedMaterialsInputProps {
    initialItems?: PlannedMaterial[];
    onChange: (items: PlannedMaterial[]) => void;
    disabled?: boolean;
}

export default function PlannedMaterialsInput({
    initialItems,
    onChange,
    disabled = false,
}: PlannedMaterialsInputProps) {
    const [items, setItems] = useState<PlannedMaterial[]>(
        initialItems && initialItems.length > 0
            ? initialItems
            : [createEmptyItem()]
    );

    function createEmptyItem(): PlannedMaterial {
        return {
            materialId: "",
            materialName: "",
            category: "",
            quantity: 0,
            meter: 0,
            totalLength: 0,
        };
    }

    const addRow = () => {
        const newItems = [...items, createEmptyItem()];
        setItems(newItems);
        onChange(newItems);
    };

    const removeRow = (index: number) => {
        if (items.length > 1) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
            onChange(newItems);
        }
    };

    const updateItem = (index: number, field: keyof PlannedMaterial, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-calculate total length
        if (field === "quantity" || field === "meter") {
            newItems[index].totalLength = newItems[index].quantity * newItems[index].meter;
        }

        setItems(newItems);
        onChange(newItems);
    };

    return (
        <div className="mt-6 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50/50 dark:bg-indigo-900/10">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Materials Required
                    </h3>
                </div>
                <button
                    type="button"
                    onClick={addRow}
                    className="btn btn-outline flex items-center space-x-2 text-sm"
                    disabled={disabled}
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Material</span>
                </button>
            </div>

            {/* Info Banner */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Planning Only:</strong> This section helps the materials person know what is required.
                    No inventory will be reduced at this stage.
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-white dark:bg-gray-800">
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Material ID
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Material Name
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Category
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Qty
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Meter
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700">
                                Total Length
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-12">
                                ✕
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.materialId}
                                        onChange={(e) => updateItem(index, "materialId", e.target.value)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="e.g., FAB001"
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.materialName}
                                        onChange={(e) => updateItem(index, "materialName", e.target.value)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="Cotton Fabric"
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.category}
                                        onChange={(e) => updateItem(index, "category", e.target.value)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="Fabric"
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="number"
                                        value={item.quantity || ""}
                                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                        className="w-16 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="1"
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="number"
                                        value={item.meter || ""}
                                        onChange={(e) => updateItem(index, "meter", parseFloat(e.target.value) || 0)}
                                        className="w-20 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-center font-medium">
                                    {item.totalLength.toFixed(2)} m
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">
                                    <button
                                        type="button"
                                        onClick={() => removeRow(index)}
                                        disabled={items.length === 1 || disabled}
                                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Remove"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Total */}
            <div className="mt-3 text-right">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                    Total Planned Length:{" "}
                    <strong className="text-indigo-600 dark:text-indigo-400">
                        {items.reduce((sum, i) => sum + i.totalLength, 0).toFixed(2)} m
                    </strong>
                </span>
            </div>
        </div>
    );
}
