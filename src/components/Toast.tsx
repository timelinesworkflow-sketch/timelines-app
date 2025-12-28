"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info" | "warning";
    onClose: () => void;
    duration?: number;
}

export default function Toast({ message, type = "info", onClose, duration = 3000 }: ToastProps) {
    useEffect(() => {
        const timer = setTimeout(onClose, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColors = {
        success: "bg-emerald-800 border-emerald-700",
        error: "bg-red-800 border-red-700",
        info: "bg-blue-800 border-blue-700",
        warning: "bg-orange-800 border-orange-700",
    };

    const textColors = {
        success: "text-emerald-100",
        error: "text-red-100",
        info: "text-blue-100",
        warning: "text-orange-100",
    };

    return (
        <div
            className={`fixed top-4 right-4 left-4 sm:left-auto sm:min-w-96 max-w-md flex items-center justify-between p-4 rounded-xl border ${bgColors[type]} ${textColors[type]} shadow-lg animate-fadeIn`}
            style={{ zIndex: 9999 }}
        >
            <p className="text-sm font-medium flex-1">{message}</p>
            <button
                onClick={onClose}
                className="ml-4 p-1 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
