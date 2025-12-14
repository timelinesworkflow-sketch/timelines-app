"use client";

import { Order } from "@/types";
import { Package, Eye } from "lucide-react";

interface MaterialsViewProps {
    order: Order;
}

export default function MaterialsView({ order }: MaterialsViewProps) {
    // Show used materials (after materials stage completion)
    if (order.materials?.usedItems && order.materials.usedItems.length > 0) {
        return (
            <div className="mt-6">
                <div className="flex items-center space-x-2 mb-3">
                    <Package className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Materials Used
                    </h3>
                </div>

                {/* Completion Info */}
                <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400">
                        <strong>Completed by:</strong> {order.materials.completedByStaffName || order.materials.completedByStaffId}
                        {order.materials.completedAt && (
                            <span className="ml-2 text-xs opacity-75">
                                on {order.materials.completedAt.toDate().toLocaleDateString()}
                            </span>
                        )}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800">
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material ID</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Name</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Category</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Qty</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Meter</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-blue-50 dark:bg-blue-900/20">Total Length</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Staff</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.materials.usedItems.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-mono text-xs">
                                        {item.materialId}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.materialName}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.category}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.quantity}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.meter?.toFixed(2)} m
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/10">
                                        {item.totalLength?.toFixed(2)} m
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-xs">
                                        {item.laborStaffName}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                                <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                                    Total Length Used:
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-blue-700 bg-blue-100">
                                    {order.materials.totalLengthUsed?.toFixed(2)} m
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // Show planned materials (before materials stage completion)
    if (order.plannedMaterials?.items && order.plannedMaterials.items.length > 0) {
        return (
            <div className="mt-6">
                <div className="flex items-center space-x-2 mb-3">
                    <Eye className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Planned Materials
                    </h3>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Pending</span>
                </div>

                {/* Planning Info */}
                <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <p className="text-sm text-indigo-700 dark:text-indigo-400">
                        <strong>Planned by:</strong> {order.plannedMaterials.plannedByStaffName || order.plannedMaterials.plannedByStaffId}
                        {order.plannedMaterials.plannedAt && (
                            <span className="ml-2 text-xs opacity-75">
                                on {order.plannedMaterials.plannedAt.toDate().toLocaleDateString()}
                            </span>
                        )}
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-800">
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Material ID</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Name</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Category</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Qty</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Meter</th>
                                <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left bg-indigo-50 dark:bg-indigo-900/20">Total Length</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.plannedMaterials.items.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-mono text-xs">
                                        {item.materialId}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.materialName}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.category}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.quantity}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                                        {item.meter?.toFixed(2)} m
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-bold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10">
                                        {item.totalLength?.toFixed(2)} m
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                                <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                                    Total Planned:
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-indigo-700 bg-indigo-100">
                                    {order.plannedMaterials.items.reduce((sum, i) => sum + (i.totalLength || 0), 0).toFixed(2)} m
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    }

    // No materials data
    return (
        <div className="mt-6">
            <div className="flex items-center space-x-2 mb-3">
                <Package className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Materials
                </h3>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    No materials data available
                </p>
            </div>
        </div>
    );
}
