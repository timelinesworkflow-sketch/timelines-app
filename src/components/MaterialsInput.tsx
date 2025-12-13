"use client";

import { useState } from "react";
import { Order, MaterialItem } from "@/types";
import { Plus, Trash2 } from "lucide-react";

interface MaterialsInputProps {
    order: Order;
    onComplete: (items: MaterialItem[], totalCost: number) => Promise<void>;
    loading: boolean;
}

export default function MaterialsInput({ order, onComplete, loading }: MaterialsInputProps) {
    // Initialize with existing materials or one empty row
    const [items, setItems] = useState<MaterialItem[]>(
        order.materials?.items && order.materials.items.length > 0
            ? order.materials.items
            : [{ particular: "", quantity: 0, colour: "", meter: 0, labour: 0 }]
    );

    const addRow = () => {
        setItems([...items, { particular: "", quantity: 0, colour: "", meter: 0, labour: 0 }]);
    };

    const removeRow = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof MaterialItem, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const calculateTotalCost = () => {
        return items.reduce((total, item) => {
            const itemCost = (item.meter || 0) + (item.labour || 0);
            return total + itemCost;
        }, 0);
    };

    const handleComplete = async () => {
        // Filter out completely empty rows
        const validItems = items.filter(
            item => item.particular.trim() !== "" || item.quantity > 0 || item.colour.trim() !== "" || item.meter > 0 || item.labour > 0
        );

        const totalCost = calculateTotalCost();
        await onComplete(validItems, totalCost);
    };

    const totalCost = calculateTotalCost();

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Materials Required
                </h3>
                <button
                    onClick={addRow}
                    className="btn btn-outline flex items-center space-x-2 text-sm"
                    disabled={loading}
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Row</span>
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Particular
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Quantity
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Colour
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Meter (₹)
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Labour (₹)
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-sm font-semibold text-gray-900 dark:text-white w-16">
                                Action
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                    <input
                                        type="text"
                                        value={item.particular}
                                        onChange={(e) => updateItem(index, "particular", e.target.value)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="e.g., Cotton Fabric"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                    <input
                                        type="number"
                                        value={item.quantity || ""}
                                        onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                    <input
                                        type="text"
                                        value={item.colour}
                                        onChange={(e) => updateItem(index, "colour", e.target.value)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="e.g., Red"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                    <input
                                        type="number"
                                        value={item.meter || ""}
                                        onChange={(e) => updateItem(index, "meter", parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2">
                                    <input
                                        type="number"
                                        value={item.labour || ""}
                                        onChange={(e) => updateItem(index, "labour", parseFloat(e.target.value) || 0)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center">
                                    <button
                                        onClick={() => removeRow(index)}
                                        disabled={items.length === 1 || loading}
                                        className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                        title="Remove row"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Total Cost Summary */}
            <div className="mt-4 flex justify-end">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-4 py-3">
                    <p className="text-sm text-indigo-700 dark:text-indigo-400">
                        Total Materials Cost: <span className="font-bold text-lg">₹{totalCost.toFixed(2)}</span>
                    </p>
                </div>
            </div>

            {/* Complete Button */}
            <div className="mt-6">
                <button
                    onClick={handleComplete}
                    disabled={loading}
                    className="w-full btn btn-primary disabled:opacity-50"
                >
                    {loading ? "Completing..." : "Complete Materials Stage"}
                </button>
            </div>
        </div>
    );
}
