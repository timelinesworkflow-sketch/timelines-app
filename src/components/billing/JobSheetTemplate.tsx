"use client";

import React, { forwardRef } from "react";
import { OrderItem, MEASUREMENT_LABELS, getGarmentDisplayName, DesignSection } from "@/types";

export interface JobSheetTemplateProps {
    item: OrderItem;
    stageDisplayName: string;
    itemIndex: number;
    totalItems: number;
    generatedDate: string;
    generatedBy: string;
}

const JobSheetTemplate = forwardRef<HTMLDivElement, JobSheetTemplateProps>(
    ({ item, stageDisplayName, itemIndex, totalItems, generatedDate, generatedBy }, ref) => {
        // Filter measurements to only show those that have values
        const activeMeasurements = Object.entries(item.measurements || {}).filter(
            ([_, value]) => value !== "" && value !== 0 && value !== null && value !== undefined
        );

        return (
            <div
                ref={ref}
                style={{
                    width: "210mm",
                    minHeight: "297mm",
                    padding: "15mm",
                    backgroundColor: "#ffffff",
                    fontFamily: "'Segoe UI', Roboto, Arial, sans-serif",
                    fontSize: "12px",
                    color: "#000000",
                    boxSizing: "border-box",
                }}
            >
                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: "20px", borderBottom: "2px solid #000" }}>
                    <h1 style={{ fontSize: "24px", fontWeight: "bold", margin: "0 0 5px 0" }}>
                        TIMELINES COSTUME DESIGNERS
                    </h1>
                    <h2 style={{ fontSize: "18px", fontWeight: "600", margin: "0 0 10px 0", color: "#333" }}>
                        {stageDisplayName} Job Sheet
                    </h2>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#666", marginBottom: "5px" }}>
                        <span>Generated: {generatedDate}</span>
                        <span>By: {generatedBy}</span>
                    </div>
                </div>

                {/* Info Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                    <div style={{ padding: "10px", border: "1px solid #eee", borderRadius: "4px" }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Customer Info</h3>
                        <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>{item.customerName}</p>
                    </div>
                    <div style={{ padding: "10px", border: "1px solid #eee", borderRadius: "4px" }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "12px", color: "#666", textTransform: "uppercase" }}>Item Context</h3>
                        <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>
                            {item.itemName || "Unnamed Item"} | {getGarmentDisplayName(item)}
                        </p>
                        <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#666" }}>
                            Item {itemIndex + 1} of {totalItems} | Due: {item.dueDate?.toDate().toLocaleDateString("en-IN")}
                        </p>
                    </div>
                </div>

                {/* Measurements Section */}
                {activeMeasurements.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                        <h3 style={{ borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "10px", fontSize: "14px" }}>
                            Measurements
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                            {activeMeasurements.map(([key, value]) => (
                                <div key={key} style={{ borderBottom: "1px dashed #ccc", paddingBottom: "2px" }}>
                                    <span style={{ fontSize: "10px", color: "#666", display: "block" }}>
                                        {MEASUREMENT_LABELS[key] || key}
                                    </span>
                                    <span style={{ fontSize: "13px", fontWeight: "bold" }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Design Sections & Images */}
                <div style={{ marginBottom: "20px" }}>
                    <h3 style={{ borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "10px", fontSize: "14px" }}>
                        Design & Technical Images
                    </h3>

                    {/* Design Sections Grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
                        {item.designSections?.map((section, idx) => (
                            <div key={section.sectionId || idx} style={{ border: "1px solid #eee", padding: "10px", borderRadius: "4px" }}>
                                <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: "bold", borderBottom: "1px solid #f0f0f0" }}>
                                    {section.title}
                                </h4>
                                <div style={{ display: "flex", gap: "10px" }}>
                                    {section.mainImageUrl ? (
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: "9px", color: "#999", margin: "0 0 2px 0" }}>Main Design</p>
                                            <img
                                                src={section.mainImageUrl}
                                                alt={section.title}
                                                style={{ width: "100%", height: "120px", objectFit: "contain", border: "1px solid #eee" }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, height: "120px", backgroundColor: "#f9f9f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#ccc" }}>
                                            No Image
                                        </div>
                                    )}

                                    {section.sketchImageUrl && (
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: "9px", color: "#999", margin: "0 0 2px 0" }}>Sketch/Detail</p>
                                            <img
                                                src={section.sketchImageUrl}
                                                alt={`${section.title} Sketch`}
                                                style={{ width: "100%", height: "120px", objectFit: "contain", border: "1px solid #eee" }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Reference Images (Customer Garment) */}
                    {item.referenceImages && item.referenceImages.length > 0 && (
                        <div style={{ marginTop: "20px" }}>
                            <h4 style={{ fontSize: "12px", color: "#666", marginBottom: "10px" }}>Customer Reference Images</h4>
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                {item.referenceImages.map((img, idx) => {
                                    const url = typeof img === "string" ? img : img.imageUrl;
                                    const title = typeof img === "string" ? `Ref ${idx + 1}` : img.title;
                                    const sketch = typeof img === "string" ? null : img.sketchImageUrl;

                                    return (
                                        <div key={idx} style={{ width: "30%", border: "1px solid #eee", padding: "5px" }}>
                                            <p style={{ fontSize: "9px", fontWeight: "bold", margin: "0 0 4px 0" }}>{title}</p>
                                            <img
                                                src={url}
                                                alt={title}
                                                style={{ width: "100%", height: "100px", objectFit: "contain" }}
                                            />
                                            {sketch && (
                                                <div style={{ marginTop: "5px", borderTop: "1px dashed #eee", paddingTop: "5px" }}>
                                                    <p style={{ fontSize: "8px", color: "#999", margin: "0 0 2px 0" }}>Attached Sketch</p>
                                                    <img src={sketch} alt="Sketch" style={{ width: "100%", height: "60px", objectFit: "contain" }} />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Notes Section */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                    <div style={{ padding: "10px", backgroundColor: "#fcfcfc", border: "1px solid #f0f0f0" }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "bold" }}>Design Notes</h3>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", minHeight: "60px" }}>
                            {item.designNotes || "No design notes provided."}
                        </p>
                    </div>
                    <div style={{ padding: "10px", backgroundColor: "#f9fbfd", border: "1px solid #eef2f7" }}>
                        <h3 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "bold", color: "#1e40af" }}>Machineman Notes</h3>
                        <p style={{ margin: 0, whiteSpace: "pre-wrap", minHeight: "60px" }}>
                            {item.machinemanNotes || "No specific instructions for staff."}
                        </p>
                    </div>
                </div>

                {/* Materials Section */}
                {item.plannedMaterials && item.plannedMaterials.items && item.plannedMaterials.items.length > 0 && (
                    <div style={{ marginBottom: "20px" }}>
                        <h3 style={{ borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "10px", fontSize: "14px" }}>
                            Required Materials
                        </h3>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ backgroundColor: "#f4f4f4" }}>
                                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "left" }}>Material Name</th>
                                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Qty</th>
                                    <th style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {item.plannedMaterials.items.map((mat, idx) => (
                                    <tr key={idx} style={{ opacity: mat.materialSource === "customer" ? 0.6 : 1 }}>
                                        <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                                            {mat.materialName} {mat.materialSource === "customer" && "(Customer-Provided)"}
                                        </td>
                                        <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                                            {mat.measurement} {mat.unit}
                                        </td>
                                        <td style={{ border: "1px solid #ddd", padding: "8px", textAlign: "center" }}>
                                            {mat.materialSource === "customer" ? "Customer" : "Company"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Footer Signature Area */}
                <div style={{ marginTop: "auto", paddingTop: "40px", display: "flex", justifyContent: "space-between" }}>
                    <div style={{ textAlign: "center", width: "150px" }}>
                        <div style={{ borderBottom: "1px solid #000", height: "30px" }}></div>
                        <p style={{ fontSize: "10px", marginTop: "5px" }}>Staff Signature</p>
                    </div>
                    <div style={{ textAlign: "center", width: "150px" }}>
                        <div style={{ borderBottom: "1px solid #000", height: "30px" }}></div>
                        <p style={{ fontSize: "10px", marginTop: "5px" }}>Approver Signature</p>
                    </div>
                </div>
            </div>
        );
    }
);

JobSheetTemplate.displayName = "JobSheetTemplate";

export default JobSheetTemplate;
