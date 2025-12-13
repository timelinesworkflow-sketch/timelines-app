"use client";

import { Order } from "@/types";

interface MaterialsViewProps {
    order: Order;
}

export default function MaterialsView({ order }: MaterialsViewProps) {
    if (!order.materials || !order.materials.items || order.materials.items.length === 0) {
        return (
            <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Materials Required
                </h3>
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Materials Required
            </h3>

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
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                                Subtotal (₹)
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {order.materials.items.map((item, index) => {
                            const subtotal = (item.meter || 0) + (item.labour || 0);
                            return (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        {item.particular || "-"}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        {item.quantity || "-"}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        {item.colour || "-"}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        ₹{item.meter?.toFixed(2) || "0.00"}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-white">
                                        ₹{item.labour?.toFixed(2) || "0.00"}
                                    </td>
                                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white">
                                        ₹{subtotal.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                            <td colSpan={5} className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right text-sm font-bold text-gray-900 dark:text-white">
                                Total Materials Cost:
                            </td>
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-bold text-indigo-700 dark:text-indigo-400">
                                ₹{order.materials.totalCost.toFixed(2)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Metadata */}
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p>
                    Completed by: {order.materials.completedByStaffId} on{" "}
                    {order.materials.completedAt.toDate().toLocaleDateString()}
                </p>
            </div>
        </div>
    );
}
