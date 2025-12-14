"use client";

import { Order } from "@/types";
import { Package } from "lucide-react";

interface MaterialsViewProps {
    order: Order;
}

export default function MaterialsView({ order }: MaterialsViewProps) {
    if (!order.materials || !order.materials.items || order.materials.items.length === 0) {
        return (
            <div className="mt-6">
                <div className="flex items-center space-x-2 mb-3">
                    <Package className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Materials Required
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

    return (
        <div className="mt-6">
            <div className="flex items-center space-x-2 mb-3">
                <Package className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Materials Required
                </h3>
            </div>

            {/* Staff Info */}
            <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
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
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Material
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Qty
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Colour
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Meter (Length)
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                ₹/Meter
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/20">
                                Total Length
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white bg-green-50 dark:bg-green-900/20">
                                Total Cost
                            </th>
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold text-gray-900 dark:text-white">
                                Labor (Staff)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.materials.items.map((item, index) => (
                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                                    {item.particular || "-"}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                                    {item.quantity || "-"}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                                    {item.colour || "-"}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                                    {item.meter?.toFixed(2) || "0"} m
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white">
                                    ₹{item.costPerMeter?.toFixed(2) || "0.00"}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10">
                                    {item.totalLength?.toFixed(2) || "0.00"} m
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 font-medium text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10">
                                    ₹{item.totalCost?.toFixed(2) || "0.00"}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-gray-900 dark:text-white text-xs">
                                    {item.laborStaffName || item.laborStaffId || "-"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                            <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-gray-900 dark:text-white">
                                TOTALS:
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                                {order.materials.totalLength?.toFixed(2) || "0.00"} m
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30">
                                ₹{order.materials.totalCost?.toFixed(2) || "0.00"}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
