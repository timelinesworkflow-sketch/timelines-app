"use client";

import React, { useState } from "react";
import { Plus, X, Image as ImageIcon, Maximize2, Upload, Trash2 } from "lucide-react";
import { DesignSection } from "@/types";

interface DesignSectionsDisplayProps {
    sections: DesignSection[];
    editable?: boolean;
    onUpdate?: (sections: DesignSection[]) => void;
    onUploadMainImage?: (sectionIndex: number, file: File) => Promise<string>;
    onUploadSketchImage?: (sectionIndex: number, file: File) => Promise<string>;
    disabled?: boolean;
}

export default function DesignSectionsDisplay({
    sections = [],
    editable = false,
    onUpdate,
    onUploadMainImage,
    onUploadSketchImage,
    disabled = false,
}: DesignSectionsDisplayProps) {
    const [previewModal, setPreviewModal] = useState<string | null>(null);
    const [uploading, setUploading] = useState<Record<string, boolean>>({});

    const handleMainImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUploadMainImage) return;

        const sectionId = sections[index].sectionId;
        setUploading(prev => ({ ...prev, [`main-${sectionId}`]: true }));

        try {
            const url = await onUploadMainImage(index, file);
            const newSections = [...sections];
            newSections[index] = { ...newSections[index], mainImageUrl: url };
            onUpdate?.(newSections);
        } catch (error) {
            console.error("Failed to upload main image:", error);
        } finally {
            setUploading(prev => ({ ...prev, [`main-${sectionId}`]: false }));
        }
    };

    const handleSketchImageChange = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUploadSketchImage) return;

        const sectionId = sections[index].sectionId;
        setUploading(prev => ({ ...prev, [`sketch-${sectionId}`]: true }));

        try {
            const url = await onUploadSketchImage(index, file);
            const newSections = [...sections];
            newSections[index] = { ...newSections[index], sketchImageUrl: url };
            onUpdate?.(newSections);
        } catch (error) {
            console.error("Failed to upload sketch image:", error);
        } finally {
            setUploading(prev => ({ ...prev, [`sketch-${sectionId}`]: false }));
        }
    };

    const addCustomSection = () => {
        const title = prompt("Enter Custom Design Section Title (e.g., Pocket, Waistband):");
        if (!title || !title.trim()) return;

        const newSection: DesignSection = {
            sectionId: `custom_${Date.now()}`,
            title: title.trim(),
            isDefault: false,
            mainImageUrl: "",
        };

        onUpdate?.([...sections, newSection]);
    };

    const removeSection = (index: number) => {
        if (sections[index].isDefault) return;
        if (!confirm(`Remove "${sections[index].title}" section?`)) return;

        const newSections = sections.filter((_, i) => i !== index);
        onUpdate?.(newSections);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                <span>Precise Design Images</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sections.map((section, idx) => (
                    <div
                        key={section.sectionId}
                        className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-all p-4 relative group ${section.mainImageUrl ? 'border-gray-200 dark:border-gray-700' : 'border-dashed border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/10'
                            }`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${section.mainImageUrl ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                {section.title}
                            </h4>
                            {editable && !section.isDefault && (
                                <button
                                    onClick={() => removeSection(idx)}
                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Remove section"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex gap-3">
                            {/* Main Image Container */}
                            <div className="flex-1">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-tight">Main Design</p>
                                <div
                                    className={`relative aspect-square rounded-lg overflow-hidden border ${section.mainImageUrl ? 'border-gray-100 dark:border-gray-700' : 'border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
                                        } flex items-center justify-center`}
                                >
                                    {section.mainImageUrl ? (
                                        <>
                                            <img
                                                src={section.mainImageUrl}
                                                alt={section.title}
                                                className="w-full h-full object-cover cursor-pointer"
                                                onClick={() => setPreviewModal(section.mainImageUrl)}
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                                                <Maximize2 className="w-5 h-5 text-white" />
                                            </div>
                                            {editable && !disabled && (
                                                <label className="absolute bottom-1 right-1 bg-white/90 dark:bg-black/80 p-1.5 rounded-md shadow-sm cursor-pointer hover:bg-white dark:hover:bg-black">
                                                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        onChange={(e) => handleMainImageChange(idx, e)}
                                                        disabled={uploading[`main-${section.sectionId}`]}
                                                    />
                                                </label>
                                            )}
                                        </>
                                    ) : (
                                        editable && !disabled ? (
                                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 p-2 text-center transition-colors">
                                                {uploading[`main-${section.sectionId}`] ? (
                                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-600 border-t-transparent" />
                                                ) : (
                                                    <>
                                                        <ImageIcon className="w-6 h-6 text-indigo-300 mb-1" />
                                                        <span className="text-[10px] text-indigo-500 font-bold leading-tight">Add Design</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleMainImageChange(idx, e)}
                                                    disabled={uploading[`main-${section.sectionId}`]}
                                                />
                                            </label>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center opacity-40">
                                                <ImageIcon className="w-6 h-6 text-gray-400" />
                                                <span className="text-[10px] text-gray-500 font-bold">No Image</span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Sketch Image Container */}
                            <div className="w-20">
                                <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-tight">Sketch</p>
                                <div
                                    className={`relative aspect-square rounded-lg overflow-hidden border ${section.sketchImageUrl ? 'border-gray-100 dark:border-gray-700' : 'border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
                                        } flex items-center justify-center`}
                                >
                                    {section.sketchImageUrl ? (
                                        <>
                                            <img
                                                src={section.sketchImageUrl}
                                                alt={`${section.title} Sketch`}
                                                className="w-full h-full object-cover cursor-pointer"
                                                onClick={() => setPreviewModal(section.sketchImageUrl!)}
                                            />
                                            {editable && !disabled && (
                                                <div className="absolute top-0 right-0 p-0.5">
                                                    <button
                                                        onClick={() => {
                                                            const newSections = [...sections];
                                                            newSections[idx] = { ...newSections[idx], sketchImageUrl: undefined };
                                                            onUpdate?.(newSections);
                                                        }}
                                                        className="bg-red-500 text-white p-0.5 rounded shadow-sm hover:bg-red-600"
                                                    >
                                                        <X className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        editable && !disabled ? (
                                            <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 p-2 text-center transition-colors">
                                                {uploading[`sketch-${section.sectionId}`] ? (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-600 border-t-transparent" />
                                                ) : (
                                                    <>
                                                        <Plus className="w-4 h-4 text-gray-400 mb-1" />
                                                        <span className="text-[9px] text-gray-400 font-bold">Add Sketch</span>
                                                    </>
                                                )}
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={(e) => handleSketchImageChange(idx, e)}
                                                    disabled={uploading[`sketch-${section.sectionId}`]}
                                                />
                                            </label>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center opacity-40">
                                                <Plus className="w-4 h-4 text-gray-300" />
                                                <span className="text-[9px] text-gray-400 font-bold">No Sketch</span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {editable && !disabled && (
                    <button
                        onClick={addCustomSection}
                        className="h-full min-h-[140px] border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900/30 hover:border-indigo-300 transition-all group"
                    >
                        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                            <Plus className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
                        </div>
                        <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600 uppercase tracking-widest">Add Design Section</span>
                    </button>
                )}
            </div>

            {/* Preview Modal */}
            {previewModal && (
                <div
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setPreviewModal(null)}
                >
                    <button
                        className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2 rounded-full transition-all"
                        onClick={() => setPreviewModal(null)}
                    >
                        <X className="w-8 h-8" />
                    </button>
                    <img
                        src={previewModal}
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
