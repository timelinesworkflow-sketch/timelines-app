"use client";

import { useState, useRef, useEffect } from "react";
import { Order, MaterialItem, MaterialUnit } from "@/types";
import { Plus, Trash2, Package, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MaterialsInputProps {
    order: Order;
    onComplete: (items: MaterialItem[], totalCost: number, totalLength: number) => Promise<void>;
    loading: boolean;
}

interface MaterialRow {
    materialId: string;
    materialName: string;
    colour: string;
    measurement: number;
}

export default function MaterialsInput({ order, onComplete, loading }: MaterialsInputProps) {
    const { userData } = useAuth();
    const dropdownRef = useRef<HTMLTableCellElement>(null);

    // Initialize with existing materials or one empty row
    const [items, setItems] = useState<MaterialRow[]>(
        order.materials?.usedItems && order.materials.usedItems.length > 0
            ? order.materials.usedItems.map(item => ({
                materialId: item.materialId || "",
                materialName: item.materialName || "",
                colour: "",
                measurement: item.meter || 0,
            }))
            : [{ materialId: "", materialName: "", colour: "", measurement: 0 }]
    );

    const [selectedUnit, setSelectedUnit] = useState<MaterialUnit>("Meter");
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowUnitDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const addRow = () => {
        setItems([...items, { materialId: "", materialName: "", colour: "", measurement: 0 }]);
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

    const handleUnitSelect = (unit: MaterialUnit) => {
        setSelectedUnit(unit);
        setShowUnitDropdown(false);
    };

    const handleComplete = async () => {
        // Filter out completely empty rows and convert to MaterialItem
        const validItems: MaterialItem[] = items
            .filter(item => item.materialName.trim() !== "" || item.measurement > 0)
            .map(item => ({
                particular: item.materialName,
                quantity: 1,
                colour: item.colour,
                category: "",
                meter: item.measurement,
                costPerMeter: 0,
                totalLength: item.measurement,
                totalCost: 0,
                laborStaffId: userData?.staffId || "",
                laborStaffName: userData?.name || "",
            }));

        // For simplified table, we don't calculate costs
        const totalLength = validItems.reduce((sum, item) => sum + item.meter, 0);
        await onComplete(validItems, 0, totalLength);
    };

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

            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-100 dark:bg-gray-800">
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Material ID
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Material Name
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Colour
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                                    className="flex items-center space-x-1 hover:text-indigo-600 transition-colors"
                                    disabled={loading}
                                >
                                    <span>{selectedUnit}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                {showUnitDropdown && (
                                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[120px]">
                                        {(["Meter", "Gram", "Packet"] as MaterialUnit[]).map((unit) => (
                                            <button
                                                key={unit}
                                                type="button"
                                                onClick={() => handleUnitSelect(unit)}
                                                className={`w-full px-4 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-sm ${selectedUnit === unit
                                                    ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium"
                                                    : "text-gray-700 dark:text-gray-300"
                                                    }`}
                                            >
                                                {unit}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center font-semibold text-gray-900 dark:text-white w-12">
                                ✕
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.materialId}
                                        onChange={(e) => updateItem(index, "materialId", e.target.value)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="e.g., FAB001"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.materialName}
                                        onChange={(e) => updateItem(index, "materialName", e.target.value)}
                                        className="w-full px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="e.g., Cotton Fabric"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="text"
                                        value={item.colour}
                                        onChange={(e) => updateItem(index, "colour", e.target.value)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="Red"
                                        disabled={loading}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <input
                                        type="number"
                                        value={item.measurement || ""}
                                        onChange={(e) => updateItem(index, "measurement", parseFloat(e.target.value) || 0)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                        disabled={loading}
                                    />
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
                        ))}
                    </tbody>
                </table>
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
