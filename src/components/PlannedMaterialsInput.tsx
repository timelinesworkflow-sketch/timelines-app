"use client";

import { useState, useRef, useEffect } from "react";
import { PlannedMaterial, MaterialUnit } from "@/types";
import { Plus, Trash2, Package, AlertCircle, ChevronDown } from "lucide-react";

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
    // Define selectedUnit first since createEmptyItem needs it
    const [selectedUnit, setSelectedUnit] = useState<MaterialUnit>("meter");
    const [showUnitDropdown, setShowUnitDropdown] = useState(false);
    const dropdownRef = useRef<HTMLTableCellElement>(null);

    // Helper function to create empty item with default unit
    const createEmptyItem = (): PlannedMaterial => ({
        materialId: "",
        materialName: "",
        colour: "",
        measurement: 0,
        unit: "meter", // Use default value, will be updated by useEffect when unit changes
        materialSource: "company", // Default to company-provided
    });

    const [items, setItems] = useState<PlannedMaterial[]>(
        initialItems && initialItems.length > 0
            ? initialItems
            : [createEmptyItem()]
    );

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

    // Update all items' unit when selectedUnit changes
    useEffect(() => {
        const updatedItems = items.map(item => ({ ...item, unit: selectedUnit }));
        setItems(updatedItems);
        onChange(updatedItems);
    }, [selectedUnit]);

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
        setItems(newItems);
        onChange(newItems);
    };

    const handleUnitSelect = (unit: MaterialUnit) => {
        setSelectedUnit(unit);
        setShowUnitDropdown(false);
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
                                Colour
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white relative" ref={dropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowUnitDropdown(!showUnitDropdown)}
                                    className="flex items-center space-x-1 hover:text-indigo-600 transition-colors"
                                    disabled={disabled}
                                >
                                    <span>{selectedUnit}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                {showUnitDropdown && (
                                    <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 min-w-[120px]">
                                        {(["meter", "gram", "packet"] as MaterialUnit[]).map((unit) => (
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
                            <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Source
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
                                        value={item.colour}
                                        onChange={(e) => updateItem(index, "colour", e.target.value)}
                                        className="w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded"
                                        placeholder="Red"
                                        disabled={disabled}
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
                                        disabled={disabled}
                                    />
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1 py-1">
                                    <select
                                        value={item.materialSource || "company"}
                                        onChange={(e) => updateItem(index, "materialSource", e.target.value)}
                                        className={`w-24 px-2 py-1 text-sm border-0 bg-transparent focus:ring-2 focus:ring-indigo-500 rounded font-medium ${(item.materialSource || "company") === "customer"
                                            ? "text-orange-600 dark:text-orange-400"
                                            : "text-green-600 dark:text-green-400"
                                            }`}
                                        disabled={disabled}
                                    >
                                        <option value="company">Company</option>
                                        <option value="customer">Customer</option>
                                    </select>
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
        </div>
    );
}
