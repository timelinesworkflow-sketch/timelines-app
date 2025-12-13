import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { db } from "@/lib/firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export async function POST(request: NextRequest) {
    try {
        const { orderId, phone } = await request.json();

        if (!orderId || !phone) {
            return NextResponse.json({ error: "Missing orderId or phone" }, { status: 400 });
        }

        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID;
        const senderId = process.env.MSG91_SENDER_ID || "DEFAULT";

        if (!authKey || !templateId) {
            console.error("[OTP] MSG91 credentials missing");
            return NextResponse.json({ error: "SMS service not configured" }, { status: 500 });
        }

        // Generate 6-digit OTP
        const otp = randomInt(100000, 999999).toString();

        // Hash OTP for storage
        const hashedOtp = createHash("sha256").update(otp).digest("hex");

        // Set expiry (5 minutes from now)
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5);

        // Store hashed OTP in Firestore
        await setDoc(doc(db, "otp", orderId), {
            hashedOtp,
            expiresAt: Timestamp.fromDate(expiresAt),
            phone,
            createdAt: Timestamp.now()
        });

        // Format phone for MSG91 (remove +91 if present, ensure 10 digits)
        const cleanPhone = phone.replace(/^\+91/, "").replace(/\D/g, "").slice(-10);

        // Send OTP via MSG91
        const msg91Url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=91${cleanPhone}&authkey=${authKey}&otp=${otp}`;

        const response = await fetch(msg91Url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();

        // Log full response for debugging
        console.log(`[OTP] MSG91 Response:`, JSON.stringify(data));

        if (data.type === "success" || data.type === "Success") {
            console.log(`[OTP] Sent to ${cleanPhone} via MSG91`);
            return NextResponse.json({ success: true, message: "OTP sent successfully" });
        } else {
            console.error("[OTP] MSG91 Error:", data);
            return NextResponse.json({ error: data.message || "Failed to send OTP" }, { status: 500 });
        }

    } catch (error) {
        console.error("[OTP] Send error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
