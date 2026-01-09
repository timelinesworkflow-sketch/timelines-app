"use client";

import React, { forwardRef } from "react";

/**
 * Format currency in Indian locale WITHOUT Intl.NumberFormat currency style
 * Uses plain ₹ symbol + toLocaleString for numbers
 */
function formatCurrency(amount: number): string {
    if (isNaN(amount) || amount === null || amount === undefined) {
        return "₹0";
    }
    return `₹${amount.toLocaleString("en-IN")}`;
}

export interface BillLineItem {
    sno: number;
    particular: string;
    qty: number;
    price: number;
    total: number;
}

export interface BillTemplateProps {
    customerName: string;
    customerPhone: string;
    customerAddress: string;
    billNumber: string;
    billDate: string;
    items: BillLineItem[];
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;
    isEstimated?: boolean;
}

/**
 * Pure HTML+CSS Bill Template for PDF Generation
 * A4 Portrait: 210mm x 297mm
 * Uses forwardRef to allow parent to capture DOM for html2pdf
 */
const BillTemplate = forwardRef<HTMLDivElement, BillTemplateProps>(
    (
        {
            customerName,
            customerPhone,
            customerAddress,
            billNumber,
            billDate,
            items,
            totalAmount,
            paidAmount,
            balanceAmount,
            isEstimated,
        },
        ref
    ) => {
        // Ensure balance is never negative
        const safeBalance = Math.max(balanceAmount, 0);
        const paymentStatus = safeBalance === 0 ? "PAYMENT COMPLETED" : "PAYMENT PENDING";
        const isCompleted = safeBalance === 0;

        // Ensure minimum 5 rows for table
        const displayItems = [...items];
        while (displayItems.length < 5) {
            displayItems.push({
                sno: displayItems.length + 1,
                particular: "",
                qty: 0,
                price: 0,
                total: 0,
            });
        }

        return (
            <div
                ref={ref}
                style={{
                    width: "210mm",
                    minHeight: "297mm",
                    padding: "15mm",
                    backgroundColor: "#ffffff",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                    color: "#000000",
                    boxSizing: "border-box",
                    position: "relative",
                }}
            >
                {isEstimated && (
                    <div
                        style={{
                            position: "absolute",
                            top: "10mm",
                            right: "15mm",
                            border: "2px solid #cc0000",
                            color: "#cc0000",
                            padding: "5px 10px",
                            fontWeight: "bold",
                            fontSize: "14px",
                            borderRadius: "4px",
                            transform: "rotate(-5deg)",
                            opacity: 0.8,
                            zIndex: 10,
                        }}
                    >
                        ESTIMATED BILL – SUBJECT TO CHANGE
                    </div>
                )}
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "20px" }}>
                    <h1
                        style={{
                            fontSize: "24px",
                            fontWeight: "bold",
                            margin: 0,
                            color: "#000000",
                        }}
                    >
                        TIMELINES COSTUME DESIGNERS
                    </h1>
                    <p
                        style={{
                            fontSize: "14px",
                            color: "#666666",
                            margin: "5px 0 15px 0",
                        }}
                    >
                        Tailoring & Costume Design
                    </p>
                    <hr style={{ border: "none", borderTop: "2px solid #000000" }} />
                </div>

                {/* Customer & Bill Info */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "20px",
                    }}
                >
                    <div>
                        <p style={{ margin: "3px 0" }}>
                            <strong>Customer:</strong> {customerName}
                        </p>
                        <p style={{ margin: "3px 0" }}>
                            <strong>Phone:</strong> {customerPhone}
                        </p>
                        {customerAddress && (
                            <p style={{ margin: "3px 0" }}>
                                <strong>Address:</strong> {customerAddress}
                            </p>
                        )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <p style={{ margin: "3px 0" }}>
                            <strong>Bill No:</strong> {billNumber}
                        </p>
                        <p style={{ margin: "3px 0" }}>
                            <strong>Bill Date:</strong> {billDate}
                        </p>
                    </div>
                </div>

                {/* Line Items Table */}
                <table
                    style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        marginBottom: "20px",
                    }}
                >
                    <thead>
                        <tr style={{ backgroundColor: "#eeeeee" }}>
                            <th
                                style={{
                                    border: "1px solid #000000",
                                    padding: "8px",
                                    textAlign: "left",
                                    width: "8%",
                                }}
                            >
                                S.No
                            </th>
                            <th
                                style={{
                                    border: "1px solid #000000",
                                    padding: "8px",
                                    textAlign: "left",
                                    width: "47%",
                                }}
                            >
                                Particular
                            </th>
                            <th
                                style={{
                                    border: "1px solid #000000",
                                    padding: "8px",
                                    textAlign: "center",
                                    width: "10%",
                                }}
                            >
                                Qty
                            </th>
                            <th
                                style={{
                                    border: "1px solid #000000",
                                    padding: "8px",
                                    textAlign: "right",
                                    width: "15%",
                                }}
                            >
                                Price
                            </th>
                            <th
                                style={{
                                    border: "1px solid #000000",
                                    padding: "8px",
                                    textAlign: "right",
                                    width: "20%",
                                }}
                            >
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayItems.map((item, index) => (
                            <tr key={index}>
                                <td
                                    style={{
                                        border: "1px solid #000000",
                                        padding: "8px",
                                    }}
                                >
                                    {item.particular ? item.sno : ""}
                                </td>
                                <td
                                    style={{
                                        border: "1px solid #000000",
                                        padding: "8px",
                                    }}
                                >
                                    {item.particular}
                                </td>
                                <td
                                    style={{
                                        border: "1px solid #000000",
                                        padding: "8px",
                                        textAlign: "center",
                                    }}
                                >
                                    {item.qty > 0 ? item.qty : ""}
                                </td>
                                <td
                                    style={{
                                        border: "1px solid #000000",
                                        padding: "8px",
                                        textAlign: "right",
                                    }}
                                >
                                    {item.price > 0 ? formatCurrency(item.price) : ""}
                                </td>
                                <td
                                    style={{
                                        border: "1px solid #000000",
                                        padding: "8px",
                                        textAlign: "right",
                                    }}
                                >
                                    {item.total > 0 ? formatCurrency(item.total) : ""}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Summary Section */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        marginBottom: "20px",
                    }}
                >
                    <div style={{ width: "250px" }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "5px 0",
                                borderBottom: "1px solid #cccccc",
                            }}
                        >
                            <strong>Total Amount:</strong>
                            <span>{formatCurrency(totalAmount)}</span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "5px 0",
                                borderBottom: "1px solid #cccccc",
                                color: "#008000",
                            }}
                        >
                            <strong>Paid Amount:</strong>
                            <span>{formatCurrency(paidAmount)}</span>
                        </div>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                padding: "5px 0",
                                borderBottom: "2px solid #000000",
                                color: safeBalance > 0 ? "#cc0000" : "#008000",
                            }}
                        >
                            <strong>Balance:</strong>
                            <span>{formatCurrency(safeBalance)}</span>
                        </div>

                        {/* Payment Status */}
                        <div
                            style={{
                                marginTop: "10px",
                                padding: "10px",
                                backgroundColor: isCompleted ? "#008000" : "#ff8c00",
                                color: "#ffffff",
                                textAlign: "center",
                                fontWeight: "bold",
                                borderRadius: "4px",
                            }}
                        >
                            {paymentStatus}
                        </div>
                    </div>
                </div>

                {/* Signature Section */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "60px",
                    }}
                >
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                width: "150px",
                                height: "60px",
                                border: "1px solid #000000",
                                marginBottom: "5px",
                            }}
                        ></div>
                        <p style={{ margin: 0, fontSize: "11px" }}>Staff Signature</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                width: "150px",
                                height: "60px",
                                border: "1px solid #000000",
                                marginBottom: "5px",
                            }}
                        ></div>
                        <p style={{ margin: 0, fontSize: "11px" }}>Customer Signature</p>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        textAlign: "center",
                        marginTop: "30px",
                        color: "#666666",
                        fontSize: "11px",
                    }}
                >
                    Thank you for your business!
                </div>
            </div>
        );
    }
);

BillTemplate.displayName = "BillTemplate";

export default BillTemplate;
