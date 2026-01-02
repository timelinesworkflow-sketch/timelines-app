"use client";

import React, { useState, useRef } from "react";
import { Plus, X, Image as ImageIcon, Camera, Eye } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { uploadImages } from "@/lib/storage";
import {
    SamplerImageItem,
    SamplerImageObject,
    InstructionImage,
    isSamplerImageObject,
    getSamplerImageUrl
} from "@/types";

interface InstructionImageUploadProps {
    parentImageId: string;
    parentImageUrl: string;
    existingInstructions: InstructionImage[];
    onAddInstruction: (instruction: Omit<InstructionImage, "instructionId">) => void;
    onRemoveInstruction: (instructionId: string) => void;
    editable: boolean;
}

/**
 * Component to display and upload instruction images for a parent reference image
 * Used in Intake stage (editable) and other stages (read-only)
 */
export function InstructionImageUpload({
    parentImageId,
    parentImageUrl,
    existingInstructions,
    onAddInstruction,
    onRemoveInstruction,
    editable,
}: InstructionImageUploadProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string>("");
    const [note, setNote] = useState("");
    const [uploading, setUploading] = useState(false);
    const [viewImage, setViewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleAddInstruction = async () => {
        if (!selectedFile) return;

        setUploading(true);
        try {
            // Upload instruction image
            const urls = await uploadImages([selectedFile], `orders/${parentImageId}/instructions`);

            if (urls.length > 0) {
                onAddInstruction({
                    imageUrl: urls[0],
                    note: note || undefined,
                    createdAt: Timestamp.now(),
                });

                // Reset form
                setSelectedFile(null);
                setPreview("");
                setNote("");
                setShowAddModal(false);
            }
        } catch (error) {
            console.error("Failed to upload instruction image:", error);
        } finally {
            setUploading(false);
        }
    };

    const handleClearSelection = () => {
        if (preview) URL.revokeObjectURL(preview);
        setSelectedFile(null);
        setPreview("");
        setNote("");
    };

    return (
        <div className="ml-4 border-l-2 border-purple-300 dark:border-purple-700 pl-3 mt-2">
            {/* Existing instruction images */}
            {existingInstructions.length > 0 && (
                <div className="space-y-2 mb-2">
                    {existingInstructions.map((instruction, idx) => (
                        <div
                            key={instruction.instructionId || idx}
                            className="flex items-start gap-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg p-2"
                        >
                            <div className="relative">
                                <img
                                    src={instruction.imageUrl}
                                    alt={`Instruction ${idx + 1}`}
                                    className="w-12 h-12 object-cover rounded cursor-pointer hover:opacity-80"
                                    onClick={() => setViewImage(instruction.imageUrl)}
                                />
                                <span className="absolute -top-1 -left-1 w-4 h-4 bg-purple-500 text-white text-[10px] rounded-full flex items-center justify-center">
                                    ↳
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                    {instruction.note || "Instruction image"}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    {instruction.createdAt.toDate().toLocaleDateString("en-IN")}
                                </p>
                            </div>
                            {editable && (
                                <button
                                    type="button"
                                    onClick={() => onRemoveInstruction(instruction.instructionId)}
                                    className="text-red-500 hover:text-red-700 p-1"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Add instruction button */}
            {editable && (
                <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2 py-1 rounded"
                >
                    <Plus className="w-3 h-3" />
                    Add Instruction Image
                </button>
            )}

            {/* Add instruction modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 w-full max-w-sm">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-purple-500" />
                            Add Instruction Image
                        </h4>

                        {/* Parent image preview */}
                        <div className="mb-3 p-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">For reference image:</p>
                            <img
                                src={parentImageUrl}
                                alt="Parent reference"
                                className="w-16 h-16 object-cover rounded"
                            />
                        </div>

                        {/* File input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {!preview ? (
                            <div className="flex gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                >
                                    <Camera className="w-5 h-5 text-gray-400" />
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Camera / Gallery</span>
                                </button>
                            </div>
                        ) : (
                            <div className="mb-3">
                                <div className="relative">
                                    <img
                                        src={preview}
                                        alt="Preview"
                                        className="w-full h-40 object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleClearSelection}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Note input */}
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Instruction note (optional)"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-3 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                        />

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    handleClearSelection();
                                    setShowAddModal(false);
                                }}
                                disabled={uploading}
                                className="flex-1 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAddInstruction}
                                disabled={!selectedFile || uploading}
                                className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                                {uploading ? "Uploading..." : "Add"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen image viewer */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setViewImage(null)}
                >
                    <img
                        src={viewImage}
                        alt="Fullscreen"
                        className="max-w-full max-h-full object-contain"
                    />
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
                        onClick={() => setViewImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
    );
}

interface SamplerImagesDisplayProps {
    samplerImages: SamplerImageItem[];
    editable?: boolean;
    onUpdate?: (images: SamplerImageItem[]) => void;
    orderId?: string;
}

/**
 * Display sampler images with instruction images
 * Handles both old string[] format and new object format
 */
export function SamplerImagesDisplay({
    samplerImages,
    editable = false,
    onUpdate,
    orderId,
}: SamplerImagesDisplayProps) {
    const [viewImage, setViewImage] = useState<string | null>(null);

    const handleAddInstruction = (index: number, instruction: Omit<InstructionImage, "instructionId">) => {
        if (!onUpdate) return;

        const newImages = [...samplerImages];
        const item = newImages[index];

        // Convert string to object if needed
        if (typeof item === "string") {
            const newItem: SamplerImageObject = {
                imageId: `img_${Date.now()}_${index}`,
                imageUrl: item,
                instructionImages: [{
                    instructionId: `inst_${Date.now()}`,
                    ...instruction,
                }],
            };
            newImages[index] = newItem;
        } else {
            const existingInstructions = item.instructionImages || [];
            newImages[index] = {
                ...item,
                instructionImages: [
                    ...existingInstructions,
                    {
                        instructionId: `inst_${Date.now()}`,
                        ...instruction,
                    },
                ],
            };
        }

        onUpdate(newImages);
    };

    const handleRemoveInstruction = (imageIndex: number, instructionId: string) => {
        if (!onUpdate) return;

        const newImages = [...samplerImages];
        const item = newImages[imageIndex];

        if (isSamplerImageObject(item) && item.instructionImages) {
            newImages[imageIndex] = {
                ...item,
                instructionImages: item.instructionImages.filter(i => i.instructionId !== instructionId),
            };
            onUpdate(newImages);
        }
    };

    if (samplerImages.length === 0) {
        return (
            <p className="text-sm text-gray-500 dark:text-gray-400">No reference images</p>
        );
    }

    return (
        <div className="space-y-4">
            {samplerImages.map((item, index) => {
                const imageUrl = getSamplerImageUrl(item);
                const imageObject = isSamplerImageObject(item) ? item : null;
                const instructions = imageObject?.instructionImages || [];

                return (
                    <div key={imageObject?.imageId || `img_${index}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                        {/* Main reference image */}
                        <div className="flex items-start gap-3">
                            <img
                                src={imageUrl}
                                alt={`Reference ${index + 1}`}
                                className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80"
                                onClick={() => setViewImage(imageUrl)}
                            />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Reference Image {index + 1}
                                </p>
                                {imageObject?.note && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {imageObject.note}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    {instructions.length} instruction{instructions.length !== 1 ? "s" : ""}
                                </p>
                            </div>
                        </div>

                        {/* Instruction images section */}
                        <InstructionImageUpload
                            parentImageId={imageObject?.imageId || `img_${index}`}
                            parentImageUrl={imageUrl}
                            existingInstructions={instructions}
                            onAddInstruction={(inst) => handleAddInstruction(index, inst)}
                            onRemoveInstruction={(id) => handleRemoveInstruction(index, id)}
                            editable={editable}
                        />
                    </div>
                );
            })}

            {/* Fullscreen image viewer */}
            {viewImage && (
                <div
                    className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
                    onClick={() => setViewImage(null)}
                >
                    <img
                        src={viewImage}
                        alt="Fullscreen"
                        className="max-w-full max-h-full object-contain"
                    />
                    <button
                        className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
                        onClick={() => setViewImage(null)}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            )}
        </div>
    );
}
