/**
 * Generate Bill PDF using jsPDF
 * Works on Android, iOS, and Desktop browsers
 */

// NOTE: jsPDF is dynamically imported to avoid "self is not defined" error during SSR/build
import { BillData, BUSINESS_NAME, BUSINESS_SUBTITLE } from "./BillTemplate";

// A4 dimensions in mm
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Colors
const BLACK = "#000000";
const GRAY = "#666666";
const LIGHT_GRAY = "#EEEEEE";
const GREEN = "#008000";
const ORANGE = "#FF8C00";

/**
 * Format currency in Indian locale
 */
function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Generate and download bill PDF
 * @param billData - Normalized bill data
 * @returns Promise that resolves when PDF is downloaded
 */
export async function generateBillPDF(billData: BillData): Promise<void> {
    // Dynamic import to avoid "self is not defined" during SSR/build
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    let y = MARGIN;

    // ========== HEADER ==========
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

    // Business Name (centered, bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(BLACK);
    doc.text(billData.businessName || BUSINESS_NAME, PAGE_WIDTH / 2, y, { align: "center" });
    y += 8;

    // Subtitle
    if (billData.subtitle) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(GRAY);
        doc.text(billData.subtitle, PAGE_WIDTH / 2, y, { align: "center" });
        y += 6;
    }

    // Divider line
    y += 3;
    doc.setDrawColor(BLACK);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 10;

    // ========== CUSTOMER & BILL INFO ==========
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(BLACK);

    // Left side - Customer info
    const leftX = MARGIN;
    const rightX = PAGE_WIDTH / 2 + 10;

    doc.setFont("helvetica", "bold");
    doc.text("Customer:", leftX, y);
    doc.setFont("helvetica", "normal");
    doc.text(billData.customerName, leftX + 22, y);

    doc.setFont("helvetica", "bold");
    doc.text("Bill Date:", rightX, y);
    doc.setFont("helvetica", "normal");
    doc.text(billData.billDate, rightX + 22, y);
    y += 6;

    doc.setFont("helvetica", "bold");
    doc.text("Phone:", leftX, y);
    doc.setFont("helvetica", "normal");
    doc.text(billData.customerPhone, leftX + 22, y);

    doc.setFont("helvetica", "bold");
    doc.text("Bill No:", rightX, y);
    doc.setFont("helvetica", "normal");
    doc.text(billData.billNumber || billData.orderId.slice(-8).toUpperCase(), rightX + 22, y);
    y += 6;

    if (billData.customerAddress) {
        doc.setFont("helvetica", "bold");
        doc.text("Address:", leftX, y);
        doc.setFont("helvetica", "normal");

        // Wrap address text if too long
        const addressLines = doc.splitTextToSize(billData.customerAddress, 70);
        doc.text(addressLines, leftX + 22, y);
        y += addressLines.length * 5;
    }

    y += 8;

    // ========== LINE ITEMS TABLE ==========
    const tableStartY = y;
    const colWidths = [12, 80, 20, 30, 35]; // S.No, Particular, Qty, Price, Total
    const rowHeight = 8;

    // Table Header
    doc.setFillColor(LIGHT_GRAY);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "F");
    doc.setDrawColor(BLACK);
    doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);

    let colX = MARGIN;

    // Draw header cells
    doc.text("S.No", colX + 2, y + 5.5);
    colX += colWidths[0];
    doc.line(colX, y, colX, y + rowHeight);

    doc.text("Particular", colX + 2, y + 5.5);
    colX += colWidths[1];
    doc.line(colX, y, colX, y + rowHeight);

    doc.text("Qty", colX + 2, y + 5.5);
    colX += colWidths[2];
    doc.line(colX, y, colX, y + rowHeight);

    doc.text("Price", colX + 2, y + 5.5);
    colX += colWidths[3];
    doc.line(colX, y, colX, y + rowHeight);

    doc.text("Total", colX + 2, y + 5.5);

    y += rowHeight;

    // Table Body - Line items
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const items = billData.items.length > 0 ? billData.items : [];
    const minRows = Math.max(5, items.length); // Minimum 5 rows

    for (let i = 0; i < minRows; i++) {
        const item = items[i];

        // Row border
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight, "S");

        colX = MARGIN;

        // S.No
        if (item) {
            doc.text(String(item.sno), colX + 2, y + 5.5);
        }
        colX += colWidths[0];
        doc.line(colX, y, colX, y + rowHeight);

        // Particular
        if (item) {
            const particularText = doc.splitTextToSize(item.particular, colWidths[1] - 4);
            doc.text(particularText[0] || "", colX + 2, y + 5.5);
        }
        colX += colWidths[1];
        doc.line(colX, y, colX, y + rowHeight);

        // Qty
        if (item && item.qty > 0) {
            doc.text(String(item.qty), colX + 2, y + 5.5);
        }
        colX += colWidths[2];
        doc.line(colX, y, colX, y + rowHeight);

        // Price
        if (item && item.price > 0) {
            doc.text(formatCurrency(item.price), colX + 2, y + 5.5);
        }
        colX += colWidths[3];
        doc.line(colX, y, colX, y + rowHeight);

        // Total
        if (item && item.total > 0) {
            doc.text(formatCurrency(item.total), colX + 2, y + 5.5);
        }

        y += rowHeight;
    }

    y += 10;

    // ========== SUMMARY SECTION ==========
    const summaryX = PAGE_WIDTH - MARGIN - 80;
    const summaryValueX = PAGE_WIDTH - MARGIN - 5;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    // Total Amount
    doc.setTextColor(BLACK);
    doc.text("Total Amount:", summaryX, y);
    doc.text(formatCurrency(billData.totalAmount), summaryValueX, y, { align: "right" });
    y += 7;

    // Paid Amount
    doc.setTextColor(GREEN);
    doc.text("Paid Amount:", summaryX, y);
    doc.text(formatCurrency(billData.paidAmount), summaryValueX, y, { align: "right" });
    y += 7;

    // Balance
    doc.setTextColor(billData.balanceAmount > 0 ? "#CC0000" : GREEN);
    doc.text("Balance:", summaryX, y);
    doc.text(formatCurrency(billData.balanceAmount), summaryValueX, y, { align: "right" });
    y += 5;

    // Divider
    doc.setTextColor(BLACK);
    doc.setLineWidth(0.3);
    doc.line(summaryX, y, summaryValueX, y);
    y += 8;

    // Payment Status Box
    const statusText = billData.paymentStatus || (billData.balanceAmount === 0 ? "PAYMENT COMPLETED" : "PAYMENT PENDING");
    const statusColor = statusText === "PAYMENT COMPLETED" ? GREEN : ORANGE;

    doc.setFillColor(statusColor);
    doc.roundedRect(summaryX, y, 80, 10, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(statusText, summaryX + 40, y + 7, { align: "center" });

    // ========== SIGNATURE SECTION ==========
    y = PAGE_HEIGHT - MARGIN - 40;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(BLACK);

    // Staff signature box
    const sigBoxWidth = 60;
    const sigBoxHeight = 25;

    doc.rect(MARGIN, y, sigBoxWidth, sigBoxHeight, "S");
    doc.text("Staff Signature", MARGIN + sigBoxWidth / 2, y + sigBoxHeight + 5, { align: "center" });

    // Customer signature box
    doc.rect(PAGE_WIDTH - MARGIN - sigBoxWidth, y, sigBoxWidth, sigBoxHeight, "S");
    doc.text("Customer Signature", PAGE_WIDTH - MARGIN - sigBoxWidth / 2, y + sigBoxHeight + 5, { align: "center" });

    // ========== FOOTER ==========
    y = PAGE_HEIGHT - MARGIN - 5;
    doc.setFontSize(8);
    doc.setTextColor(GRAY);
    doc.text("Thank you for your business!", PAGE_WIDTH / 2, y, { align: "center" });

    // ========== SAVE PDF ==========
    const fileName = `TIMELINES_BILL_${billData.billNumber || billData.orderId.slice(-8)}.pdf`;

    // Direct download (works on mobile and desktop)
    doc.save(fileName);
}

/**
 * Create bill data from order for PDF generation
 */
export function createBillDataFromOrder(order: {
    orderId: string;
    customerName: string;
    customerPhone: string;
    customerAddress?: string;
    billing?: {
        billNumber?: string;
        billDate?: { toDate: () => Date };
        paidAt?: { toDate: () => Date };
        billedAt?: { toDate: () => Date };
        lineItems?: Array<{ sno: number; particular: string; qty: number; price: number; total: number }>;
        finalAmount?: number;
        totalAmount?: number;
        advancePaid?: number;
        amountReceived?: number;
        balance?: number;
    };
}): BillData {
    const billing = order.billing || {};

    // Calculate paid amount
    const paidAmount = (billing.advancePaid || 0) + (billing.amountReceived || 0);

    // Get bill date
    let billDate = new Date().toLocaleDateString("en-IN");
    if (billing.paidAt && billing.paidAt.toDate) {
        billDate = billing.paidAt.toDate().toLocaleDateString("en-IN");
    } else if (billing.billedAt && billing.billedAt.toDate) {
        billDate = billing.billedAt.toDate().toLocaleDateString("en-IN");
    }

    const balanceAmount = billing.balance || 0;

    return {
        businessName: BUSINESS_NAME,
        subtitle: BUSINESS_SUBTITLE,
        customerName: order.customerName || "",
        customerPhone: order.customerPhone || "",
        customerAddress: order.customerAddress || "",
        billNumber: billing.billNumber || "",
        billDate,
        orderId: order.orderId || "",
        items: (billing.lineItems || []).map((item, index) => ({
            sno: item.sno || index + 1,
            particular: item.particular || "",
            qty: item.qty || 0,
            price: item.price || 0,
            total: item.total || 0
        })),
        totalAmount: billing.finalAmount || billing.totalAmount || 0,
        paidAmount,
        balanceAmount,
        // Auto-derive payment status from balance
        paymentStatus: balanceAmount === 0 ? "PAYMENT COMPLETED" : "PAYMENT PENDING"
    };
}
