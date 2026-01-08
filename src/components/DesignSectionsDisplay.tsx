import { useState } from "react";
import { DesignSection } from "@/types";
import { X, ExternalLink, ImageIcon } from "lucide-react";

interface DesignSectionsDisplayProps {
    sections: DesignSection[];
}

export default function DesignSectionsDisplay({ sections }: DesignSectionsDisplayProps) {
    const [selectedSection, setSelectedSection] = useState<DesignSection | null>(null);
    const [viewMode, setViewMode] = useState<"main" | "sketch">("main");

    if (!sections || sections.length === 0) return null;

    const openModal = (section: DesignSection) => {
        setSelectedSection(section);
        setViewMode("main");
    };

    const closeModal = () => {
        setSelectedSection(null);
        setViewMode("main");
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white border-b pb-2 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-500" />
                <span>Precise Design Images</span>
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sections.map((section) => (
                    <div
                        key={section.sectionId}
                        className="group relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
                        onClick={() => openModal(section)}
                    >
                        <div className="aspect-[4/5] bg-gray-100 dark:bg-gray-900 relative">
                            {section.mainImageUrl ? (
                                <img
                                    src={section.mainImageUrl}
                                    alt={section.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <span className="text-xs">No Image</span>
                                </div>
                            )}

                            {/* Sketch Indicator */}
                            {section.sketchImageUrl && (
                                <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
                                    Sketch +
                                </div>
                            )}

                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <ExternalLink className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                        </div>
                        <div className="p-2.5">
                            <h4 className="font-medium text-sm text-gray-900 dark:text-white truncate" title={section.title}>
                                {section.title}
                            </h4>
                        </div>
                    </div>
                ))}
            </div>

            {/* Fullscreen Modal */}
            {selectedSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={closeModal}>
                    <div className="relative w-full max-w-5xl h-full max-h-[90vh] flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>

                        {/* Header */}
                        <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10 pointer-events-none">
                            <h3 className="text-white font-semibold text-lg drop-shadow-md px-4 py-1 rounded bg-black/20 backdrop-blur-md pointer-events-auto">
                                {selectedSection.title}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-md transition-colors pointer-events-auto"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Image Container */}
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                            <img
                                src={viewMode === "main" ? selectedSection.mainImageUrl : selectedSection.sketchImageUrl || ""}
                                alt={selectedSection.title}
                                className="max-w-full max-h-full object-contain"
                            />
                        </div>

                        {/* Controls (Toggle) */}
                        {selectedSection.sketchImageUrl && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center bg-white/10 backdrop-blur-md rounded-full p-1 border border-white/20">
                                <button
                                    onClick={() => setViewMode("main")}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === "main"
                                        ? "bg-white text-black shadow-lg"
                                        : "text-white hover:bg-white/10"
                                        }`}
                                >
                                    Main View
                                </button>
                                <button
                                    onClick={() => setViewMode("sketch")}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${viewMode === "sketch"
                                        ? "bg-white text-black shadow-lg"
                                        : "text-white hover:bg-white/10"
                                        }`}
                                >
                                    Sketch / Detail
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
