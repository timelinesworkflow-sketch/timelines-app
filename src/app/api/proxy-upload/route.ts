import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const path = formData.get("path") as string;
        const type = formData.get("type") as string;

        // Get the ID token from the Authorization header
        const authHeader = request.headers.get("Authorization");
        const token = authHeader?.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : null;

        if (!file || !path) {
            return NextResponse.json({ error: "Missing file or path" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const encodedPath = encodeURIComponent(path);
        const headers: Record<string, string> = {
            "Content-Type": type || file.type || "application/octet-stream",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        // List of buckets to try
        const buckets = [
            "studio-8475348312-9c32d.appspot.com",
            "studio-8475348312-9c32d.firebasestorage.app",
            // Fallback: try without random suffix if it looks like one?
            "studio-8475348312.appspot.com",
            "studio-8475348312.firebasestorage.app",
            // Maybe it's just the ID?
            "studio-8475348312-9c32d"
        ];

        let lastError = null;
        let lastStatus = 500;

        for (const bucket of buckets) {
            const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodedPath}`;

            console.log(`Attempting upload to: ${bucket}`);

            const response = await fetch(url, {
                method: "POST",
                headers: headers,
                body: buffer,
            });

            if (response.ok) {
                const data = await response.json();
                const downloadToken = data.downloadTokens;
                const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${downloadToken}`;
                return NextResponse.json({ downloadUrl });
            }

            lastStatus = response.status;
            lastError = await response.text();
            console.error(`Failed upload to ${bucket}: ${lastStatus} - ${lastError}`);

            // If it's not a 404 (Not Found), it might be Auth (403) or Server Error (500), so we might not want to continue strictly,
            // but for now, we will try the next bucket only if it's 404 or 400.
            if (lastStatus !== 404 && lastStatus !== 400) {
                break;
            }
        }

        return NextResponse.json({ error: `Storage API Error: ${lastError}` }, { status: lastStatus });

    } catch (error) {
        console.error("Proxy upload failed:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        );
    }
}
