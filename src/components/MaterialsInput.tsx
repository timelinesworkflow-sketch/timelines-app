"use client";

import { useState } from "react";
import { Order, MaterialItem } from "@/types";
import { Plus, Trash2, Package } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MaterialsInputProps {
    order: Order;
    onComplete: (items: MaterialItem[], totalCost: number, totalLength: number) => Promise<void>;
    loading: boolean;
}

interface MaterialRow {
    particular: string;
    category: string;            // Free text (NOT dropdown)
    quantity: number;
    colour: string;
    meter: number;               // Length per quantity (NOT cost)
    costPerMeter: number;        // Cost per meter (₹)
}

export default function MaterialsInput({ order, onComplete, loading }: MaterialsInputProps) {
    const { userData } = useAuth();

    // Initialize with existing materials or one empty row
    const [items, setItems] = useState<MaterialRow[]>(
        order.materials?.usedItems && order.materials.usedItems.length > 0
            ? order.materials.usedItems.map(item => ({
                particular: item.materialName || "",
                category: item.category || "",
                quantity: item.quantity,
                colour: "",
                meter: item.meter,
                costPerMeter: 0,
            }))
            : [{ particular: "", category: "", quantity: 0, colour: "", meter: 0, costPerMeter: 0 }]
    );

    const addRow = () => {
        setItems([...items, { particular: "", category: "", quantity: 0, colour: "", meter: 0, costPerMeter: 0 }]);
    };

    const removeRow = (index: number) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index: number, field: keyof MaterialRow, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    // Calculate totals for a single row
    const calculateRowTotals = (item: MaterialRow) => {
        const totalLength = item.quantity * item.meter;
        const totalCost = totalLength * item.costPerMeter;
        return { totalLength, totalCost };
    };

    // Calculate overall totals
    const calculateTotals = () => {
        return items.reduce((acc, item) => {
            const { totalLength, totalCost } = calculateRowTotals(item);
            return {
                totalLength: acc.totalLength + totalLength,
                totalCost: acc.totalCost + totalCost,
            };
        }, { totalLength: 0, totalCost: 0 });
    };

    const handleComplete = async () => {
        // Filter out completely empty rows and convert to MaterialItem
        const validItems: MaterialItem[] = items
            .filter(item => item.particular.trim() !== "" || item.quantity > 0 || item.meter > 0)
            .map(item => {
                const { totalLength, totalCost } = calculateRowTotals(item);
                return {
                    particular: item.particular,
                    quantity: item.quantity,
                    colour: item.colour,
                    category: item.category,
                    meter: item.meter,
                    costPerMeter: item.costPerMeter,
                    totalLength,
                    totalCost,
                    laborStaffId: userData?.staffId || "",
                    laborStaffName: userData?.name || "",
                };
            });

        const { totalCost, totalLength } = calculateTotals();
        await onComplete(validItems, totalCost, totalLength);
    };

    const totals = calculateTotals();

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                    <Package className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Materials Required
                    </h3>
                </div>
                <button
                    onClick={addRow}
                    className="btn btn-outline flex items-center space-x-2 text-sm"
                    disabled={loading}
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Row</span>
                </button>
            </div>

            {/* Staff Info - Auto-filled, Read-only */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    <strong>Labor (Staff):</strong> {userData?.name || "Unknown"} ({userData?.staffId || "N/A"})
                    <span className="ml-2 text-xs opacity-75">(Auto-filled, cannot be edited)</span>
                </p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
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
                                Colour
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Meter <span className="text-xs font-normal">(Length)</span>
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                ₹/Meter
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700">
                                Total Length
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-700">
                                Total Cost
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-semibold text-gray-900 dark:text-white w-12">
                                ✕
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => {
                            const { totalLength, totalCost } = calculateRowTotals(item);
                            return (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                        <input
                                            type="text"
                                            value={item.particular}
                                            onChange={(e) => updateItem(index, "particular", e.target.value)}
                                            className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                            placeholder="e.g., Cotton Fabric"
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                        {/* FREE TEXT input for category - NOT dropdown */}
                                        <input
                                            type="text"
                                            value={item.category}
                                            onChange={(e) => updateItem(index, "category", e.target.value)}
                                            className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                            placeholder="Fabric"
                                            disabled={loading}
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
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                        <input
                                            type="text"
                                            value={item.colour}
                                            onChange={(e) => updateItem(index, "colour", e.target.value)}
                                            className="w-20 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                            placeholder="Red"
                                            disabled={loading}
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
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                        <input
                                            type="number"
                                            value={item.costPerMeter || ""}
                                            onChange={(e) => updateItem(index, "costPerMeter", parseFloat(e.target.value) || 0)}
                                            className="w-20 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                            placeholder="0"
                                            min="0"
                                            step="0.01"
                                            disabled={loading}
                                        />
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-center font-medium">
                                        {totalLength.toFixed(2)} m
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 bg-gray-50 dark:bg-gray-800 text-center font-medium">
                                        ₹{totalCost.toFixed(2)}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-1 py-1 text-center">
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
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Summary Cards */}
            <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
                    <p className="text-xs text-blue-600 dark:text-blue-400 uppercase font-medium">Total Length Used</p>
                    <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{totals.totalLength.toFixed(2)} m</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                    <p className="text-xs text-green-600 dark:text-green-400 uppercase font-medium">Total Material Cost</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{totals.totalCost.toFixed(2)}</p>
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
