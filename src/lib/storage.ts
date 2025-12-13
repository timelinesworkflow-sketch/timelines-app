import { auth } from "@/lib/firebase";

/**
 * Upload an image to Firebase Storage via Proxy (bypasses CORS)
 * @param file - The file to upload
 * @param path - The storage path (e.g., 'orders/ORDER123/sampler')
 * @returns The download URL of the uploaded file
 */
export async function uploadImage(file: File, path: string): Promise<string> {
    try {
        // Validate path
        if (!path || path.trim() === "") {
            throw new Error("Invalid upload path");
        }

        // Prevent manual URL construction usage in path
        if (path.includes("firebasestorage.googleapis.com") || path.includes("http")) {
            throw new Error("Path must not be a URL. Use a storage path (e.g. 'orders/123').");
        }

        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${timestamp}_${safeName}`;
        const fullPath = `${path}/${fileName}`;

        // Get current user token for authentication
        const currentUser = auth.currentUser;
        let token = "";
        if (currentUser) {
            token = await currentUser.getIdToken();
        }

        // Prepare form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", fullPath);
        formData.append("type", file.type);

        // Send to proxy
        // Set a timeout for the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

        const response = await fetch("/api/proxy-upload", {
            method: "POST",
            headers: {
                "Authorization": token ? `Bearer ${token}` : "",
            },
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            throw new Error(errorData.error || `Upload failed with status ${response.status}`);
        }

        const data = await response.json();
        return data.downloadUrl;

    } catch (error) {
        console.error("Upload error:", error);
        throw new Error(`Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Upload multiple images
 * @param files - Array of files to upload
 * @param path - The storage path
 * @returns Array of download URLs
 */
export async function uploadImages(files: File[], path: string): Promise<string[]> {
    if (!files || files.length === 0) {
        return [];
    }

    try {
        const uploadPromises = files.map((file) => uploadImage(file, path));
        const urls = await Promise.all(uploadPromises);
        return urls;
    } catch (error) {
        console.error("Multiple upload error:", error);
        throw error;
    }
}
