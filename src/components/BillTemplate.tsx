"use client";

import React from "react";
import { BillLineItem } from "@/types";

interface BillTemplateProps {
    businessName?: string;
    subtitle?: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    billDate: string;
    orderId: string;
    items: BillLineItem[];
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
}

export default function BillTemplate({
    businessName = "TIMELINES COSTUME DESIGNERS",
    subtitle = "Tailoring & Costume Design",
    customerName,
    customerPhone,
    customerAddress,
    billDate,
    orderId,
    items,
    grandTotal,
    paidAmount,
    balanceAmount,
}: BillTemplateProps) {
    return (
        <div className="bill-template bg-white text-black p-8 max-w-[210mm] mx-auto font-sans">
            {/* Header */}
            <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-bold tracking-wide uppercase">
                    {businessName}
                </h1>
                {subtitle && (
                    <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
                )}
            </div>

            {/* Customer & Bill Info */}
            <div className="flex justify-between mb-6 text-sm">
                <div className="space-y-1">
                    <p><span className="font-semibold">Customer:</span> {customerName}</p>
                    <p><span className="font-semibold">Phone:</span> {customerPhone}</p>
                    {customerAddress && (
                        <p><span className="font-semibold">Address:</span> {customerAddress}</p>
                    )}
                </div>
                <div className="text-right space-y-1">
                    <p><span className="font-semibold">Bill Date:</span> {billDate}</p>
                    <p><span className="font-semibold">Order ID:</span> {orderId.slice(-8).toUpperCase()}</p>
                </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full border-collapse mb-6 text-sm">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="border border-black px-2 py-2 text-left w-12">S.No</th>
                        <th className="border border-black px-2 py-2 text-left">Particular</th>
                        <th className="border border-black px-2 py-2 text-center w-16">Qty</th>
                        <th className="border border-black px-2 py-2 text-right w-20">Price</th>
                        <th className="border border-black px-2 py-2 text-right w-24">Total</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, index) => (
                        <tr key={index}>
                            <td className="border border-black px-2 py-1.5">{item.sno}</td>
                            <td className="border border-black px-2 py-1.5">{item.particular}</td>
                            <td className="border border-black px-2 py-1.5 text-center">{item.qty}</td>
                            <td className="border border-black px-2 py-1.5 text-right">₹{item.price.toFixed(2)}</td>
                            <td className="border border-black px-2 py-1.5 text-right">₹{item.total.toFixed(2)}</td>
                        </tr>
                    ))}
                    {/* Empty rows for minimum height */}
                    {items.length < 5 && Array.from({ length: 5 - items.length }).map((_, i) => (
                        <tr key={`empty-${i}`}>
                            <td className="border border-black px-2 py-1.5">&nbsp;</td>
                            <td className="border border-black px-2 py-1.5">&nbsp;</td>
                            <td className="border border-black px-2 py-1.5">&nbsp;</td>
                            <td className="border border-black px-2 py-1.5">&nbsp;</td>
                            <td className="border border-black px-2 py-1.5">&nbsp;</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Summary Section */}
            <div className="flex justify-end mb-8">
                <div className="w-64">
                    <div className="flex justify-between py-1.5 border-b">
                        <span className="font-semibold">Grand Total:</span>
                        <span className="font-bold">₹{grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b">
                        <span className="font-semibold">Paid Amount:</span>
                        <span className="text-green-700">₹{paidAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b-2 border-black">
                        <span className="font-semibold">Balance:</span>
                        <span className={balanceAmount > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                            ₹{balanceAmount.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Signature Section */}
            <div className="flex justify-between mt-12 pt-8">
                <div className="text-center">
                    <div className="w-40 h-16 border-b border-black mb-2"></div>
                    <p className="text-sm font-semibold">Staff Signature</p>
                </div>
                <div className="text-center">
                    <div className="w-40 h-16 border-b border-black mb-2"></div>
                    <p className="text-sm font-semibold">Customer Signature</p>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>Thank you for your business!</p>
            </div>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 12mm;
                    }
                    
                    body {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    .bill-template {
                        width: 100%;
                        max-width: none;
                        padding: 0;
                        margin: 0;
                    }
                    
                    .bill-template table {
                        border-collapse: collapse;
                    }
                    
                    .bill-template th,
                    .bill-template td {
                        border: 1px solid black !important;
                    }
                    
                    .bill-template .bg-gray-100 {
                        background-color: #f3f4f6 !important;
                    }
                }
            `}</style>
        </div>
    );
}
