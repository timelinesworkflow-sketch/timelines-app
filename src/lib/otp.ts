import { db } from "@/lib/firebase";
import { doc, setDoc, getDoc, deleteDoc, Timestamp } from "firebase/firestore";

/**
 * Generate a random 6-digit OTP
 */
export function generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP via SMS (Fast2SMS)
 * @param phone - Phone number to send OTP to
 * @param otp - The OTP to send
 * @returns Success status
 */
export async function sendOTP(phone: string, otp: string): Promise<boolean> {
    const apiKey = process.env.NEXT_PUBLIC_SMS_API_KEY;
    const senderId = process.env.SMS_SENDER_ID;
    const templateId = process.env.SMS_TEMPLATE_ID;

    if (!apiKey) {
        console.warn("[OTP DEV] SMS API Key not found. OTP logged to console:", otp);
        return true; // Simulate success in dev
    }

    try {
        // Check if DLT credentials are provided
        if (senderId && templateId) {
            console.log(`[OTP] Sending DLT SMS to ${phone} (Sender: ${senderId})...`);

            // Fast2SMS DLT Route
            const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
                method: "POST",
                headers: {
                    "authorization": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "route": "dlt",
                    "sender_id": senderId,
                    "message": templateId,
                    "variables_values": otp,
                    "flash": 0,
                    "numbers": phone
                })
            });

            const data = await response.json();
            if (data.return) {
                console.log("[OTP] DLT SMS sent successfully");
                return true;
            } else {
                console.error("[OTP] Fast2SMS DLT Error:", data);
                return false;
            }
        } else {
            // Fallback to Quick OTP (if no DLT details)
            console.log(`[OTP] Sending Quick SMS to ${phone}...`);
            const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
                method: "POST",
                headers: {
                    "authorization": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "route": "otp",
                    "variables_values": otp,
                    "numbers": phone
                })
            });

            const data = await response.json();
            if (data.return) {
                console.log("[OTP] SMS sent successfully");
                return true;
            } else {
                console.error("[OTP] Fast2SMS Error:", data);
                return false;
            }
        }
    } catch (error) {
        console.error("[OTP] Network Error:", error);
        return false; // Fail silently to UI, but log error
    }
}

/**
 * Store OTP in Firestore
 * @param orderId - The Order ID to associate OTP with
 * @param otp - The generated OTP
 * @param expiryMinutes - Validity in minutes (default 10)
 */
export async function storeOTP(orderId: string, otp: string, expiryMinutes: number = 10): Promise<void> {
    try {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expiryMinutes);

        await setDoc(doc(db, "otp_requests", orderId), {
            otp,
            expiresAt: Timestamp.fromDate(expiresAt),
            createdAt: Timestamp.now()
        });
    } catch (error) {
        console.error("Failed to store OTP in Firestore:", error);
        throw new Error("System error: Could not save OTP");
    }
}

/**
 * Verify OTP against Firestore
 * @param orderId - The Order ID
 * @param inputOTP - The OTP entered by user
 * @returns Valid status
 */
export async function verifyOTP(orderId: string, inputOTP: string): Promise<boolean> {
    try {
        const docRef = doc(db, "otp_requests", orderId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            console.warn("OTP verification failed: No OTP found for order", orderId);
            return false;
        }

        const data = docSnap.data();
        const expiresAt = data.expiresAt.toDate();

        if (new Date() > expiresAt) {
            console.warn("OTP verification failed: Expired");
            // Optional: Cleanup expired
            await deleteDoc(docRef);
            return false;
        }

        if (data.otp === inputOTP) {
            // Success! Cleanup used OTP
            await deleteDoc(docRef);
            return true;
        }

        return false;
    } catch (error) {
        console.error("OTP Verification Error:", error);
        return false;
    }
}
