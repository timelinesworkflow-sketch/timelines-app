"use client";

import { useState, useRef } from "react";
import { Camera, X, Plus, Image as ImageIcon } from "lucide-react";
import { ItemReferenceImage } from "@/types";

interface ReferenceImageUploadProps {
    images: ItemReferenceImage[];
    onChange: (images: ItemReferenceImage[]) => void;
    onFileUpload: (files: File[], index: number) => void;
    uploading?: boolean;
}

interface ImageUploadState {
    file: File | null;
    preview: string;
    title: string;
    description: string;
    hasDescriptionImage: boolean;
    descriptionFile: File | null;
    descriptionPreview: string;
}

export default function ReferenceImageUpload({
    images,
    onChange,
    onFileUpload,
    uploading = false,
}: ReferenceImageUploadProps) {
    const [imageStates, setImageStates] = useState<ImageUploadState[]>([
        createEmptyImageState(),
    ]);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const descFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    function createEmptyImageState(): ImageUploadState {
        return {
            file: null,
            preview: "",
            title: "",
            description: "",
            hasDescriptionImage: false,
            descriptionFile: null,
            descriptionPreview: "",
        };
    }

    const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...imageStates];
            newStates[index] = {
                ...newStates[index],
                file,
                preview: reader.result as string,
            };
            setImageStates(newStates);
        };
        reader.readAsDataURL(file);
    };

    const handleDescriptionFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const newStates = [...imageStates];
            newStates[index] = {
                ...newStates[index],
                descriptionFile: file,
                descriptionPreview: reader.result as string,
            };
            setImageStates(newStates);
        };
        reader.readAsDataURL(file);
    };

    const updateImageState = (index: number, field: keyof ImageUploadState, value: string | boolean) => {
        const newStates = [...imageStates];
        newStates[index] = { ...newStates[index], [field]: value };
        setImageStates(newStates);
    };

    const addNewImageSlot = () => {
        setImageStates([...imageStates, createEmptyImageState()]);
    };

    const removeImage = (index: number) => {
        if (imageStates.length <= 1) {
            // Reset to empty if last one
            setImageStates([createEmptyImageState()]);
            return;
        }
        const newStates = [...imageStates];
        newStates.splice(index, 1);
        setImageStates(newStates);
    };

    const triggerFileInput = (index: number) => {
        fileInputRefs.current[index]?.click();
    };

    const triggerDescFileInput = (index: number) => {
        descFileInputRefs.current[index]?.click();
    };

    // Check if an image is ready (has file and title)
    const isImageReady = (state: ImageUploadState) => {
        return state.file && state.title.trim().length > 0;
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-400">
                Upload reference images of measurement garment
            </p>

            {imageStates.map((state, index) => (
                <div
                    key={index}
                    className="bg-slate-700/50 rounded-lg p-4 space-y-3"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">
                            Reference Image #{index + 1}
                        </span>
                        <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Image Upload Area */}
                    <div className="flex gap-4">
                        {/* Main Image */}
                        <div className="flex-shrink-0">
                            <input
                                ref={(el) => {
                                    if (el) fileInputRefs.current[index] = el;
                                }}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleFileChange(index, e)}
                                className="hidden"
                            />
                            {state.preview ? (
                                <div
                                    className="relative w-24 h-24 rounded-lg overflow-hidden cursor-pointer"
                                    onClick={() => triggerFileInput(index)}
                                >
                                    <img
                                        src={state.preview}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <Camera className="w-6 h-6 text-white" />
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => triggerFileInput(index)}
                                    className="w-24 h-24 border-2 border-dashed border-gray-500 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                                >
                                    <Camera className="w-6 h-6" />
                                    <span className="text-xs">Upload</span>
                                </button>
                            )}
                        </div>

                        {/* Title & Description */}
                        <div className="flex-1 space-y-2">
                            <input
                                type="text"
                                value={state.title}
                                onChange={(e) => updateImageState(index, "title", e.target.value)}
                                placeholder="Image Title *"
                                className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg text-sm placeholder-gray-400 border border-slate-500 focus:border-cyan-500 focus:outline-none"
                                required
                            />
                            <textarea
                                value={state.description}
                                onChange={(e) => updateImageState(index, "description", e.target.value)}
                                placeholder="Description (optional)"
                                rows={2}
                                className="w-full px-3 py-2 bg-slate-600 text-white rounded-lg text-sm placeholder-gray-400 border border-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
                            />
                        </div>
                    </div>

                    {/* Add Description Image Toggle */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id={`desc-image-toggle-${index}`}
                            checked={state.hasDescriptionImage}
                            onChange={(e) => updateImageState(index, "hasDescriptionImage", e.target.checked)}
                            className="rounded border-gray-500 bg-slate-600 text-cyan-500 focus:ring-cyan-500"
                        />
                        <label
                            htmlFor={`desc-image-toggle-${index}`}
                            className="text-sm text-gray-400"
                        >
                            Add image as description
                        </label>
                    </div>

                    {/* Description Image Upload */}
                    {state.hasDescriptionImage && (
                        <div className="ml-6">
                            <input
                                ref={(el) => {
                                    if (el) descFileInputRefs.current[index] = el;
                                }}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(e) => handleDescriptionFileChange(index, e)}
                                className="hidden"
                            />
                            {state.descriptionPreview ? (
                                <div
                                    className="relative w-20 h-20 rounded-lg overflow-hidden cursor-pointer"
                                    onClick={() => triggerDescFileInput(index)}
                                >
                                    <img
                                        src={state.descriptionPreview}
                                        alt="Description"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                        <ImageIcon className="w-5 h-5 text-white" />
                                    </div>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => triggerDescFileInput(index)}
                                    className="w-20 h-20 border-2 border-dashed border-gray-500 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                                >
                                    <ImageIcon className="w-5 h-5" />
                                    <span className="text-[10px]">Desc Image</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Validation indicator */}
                    {!state.file && (
                        <p className="text-xs text-yellow-400">
                            ⚠ Please upload an image
                        </p>
                    )}
                    {state.file && !state.title.trim() && (
                        <p className="text-xs text-yellow-400">
                            ⚠ Image title is required
                        </p>
                    )}
                </div>
            ))}

            {/* Add More Button */}
            <button
                type="button"
                onClick={addNewImageSlot}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-gray-300 rounded-lg hover:bg-slate-600 transition-colors"
            >
                <Plus className="w-4 h-4" />
                Add Another Image
            </button>

            {uploading && (
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent"></div>
                    Uploading images...
                </div>
            )}
        </div>
    );
}

// Export helper to get upload data
export function getImageUploadData(imageStates: ImageUploadState[]): {
    files: File[];
    metadata: Omit<ItemReferenceImage, "imageUrl" | "descriptionImageUrl">[];
    descFiles: (File | null)[];
} {
    return {
        files: imageStates.filter(s => s.file).map(s => s.file!),
        metadata: imageStates.filter(s => s.file).map(s => ({
            title: s.title.trim(),
            description: s.description.trim() || undefined,
        })),
        descFiles: imageStates.filter(s => s.file).map(s => s.descriptionFile),
    };
}
