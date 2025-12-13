import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, updateDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
        }

        // MOCK MODE: Skip OTP verification, directly confirm order
        console.log(`[OTP MOCK] Bypassing verification for order ${orderId}`);

        // Update order status directly
        const orderDocRef = doc(db, "orders", orderId);
        await updateDoc(orderDocRef, {
            status: "confirmed_locked",
            confirmedAt: Timestamp.now(),
            currentStage: "materials" // Default first stage
        });

        console.log(`[OTP MOCK] Order ${orderId} confirmed`);
        return NextResponse.json({ success: true, message: "Order confirmed (mock mode)" });

    } catch (error) {
        console.error("[OTP MOCK] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
