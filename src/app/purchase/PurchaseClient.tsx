"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import PurchasePageContent from "./PurchasePageContent";

export default function PurchaseClient() {
    return (
        <ProtectedRoute allowedRoles={["purchase", "supervisor", "admin"]}>
            <PurchasePageContent />
        </ProtectedRoute>
    );
}
