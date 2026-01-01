/**
 * Bill Template Types and Data Structure
 * Used for generating PDF bills with jsPDF
 */

export interface BillLineItem {
    sno: number;
    particular: string;
    qty: number;
    price: number;
    total: number;
}

export interface BillData {
    // Business Info
    businessName: string;
    subtitle?: string;

    // Customer Info
    customerName: string;
    customerPhone: string;
    customerAddress: string;

    // Bill Info
    billNumber: string;
    billDate: string;
    orderId: string;

    // Line Items
    items: BillLineItem[];

    // Summary
    totalAmount: number;
    paidAmount: number;
    balanceAmount: number;

    // Payment Status (auto-derived from balance)
    paymentStatus: "PAYMENT COMPLETED" | "PAYMENT PENDING";
}

// Default business details
export const BUSINESS_NAME = "TIMELINES COSTUME DESIGNERS";
export const BUSINESS_SUBTITLE = "Tailoring & Costume Design";

// Predefined bill particulars
export const BILL_PARTICULARS = [
    "Aari work",
    "Aari stitch (company)",
    "Aari stitch (customer)",
    "Lining blouse stitch",
    "Puff design",
    "Design blouse",
    "Lining company",
    "Lining customer",
    "Saree fall hemming",
    "Saree fall zigzag",
    "Company blouse",
    "Saree blouse princess cut",
    "Saree pre pleat",
    "Saree knot",
    "Extra lining",
    "Extra silkcotton",
    "Readymade knot",
    "Chudi stitch",
    "Top stitch",
    "Pant stitch",
    "Machine embroidery",
    "Frock stitch",
    "Pavadai stitch",
    "Sattai stitch",
    "Alteration work",
    "Blouse hooks",
    "Ironing charges"
] as const;

/**
 * Create empty bill data with defaults
 */
export function createEmptyBillData(): BillData {
    return {
        businessName: BUSINESS_NAME,
        subtitle: BUSINESS_SUBTITLE,
        customerName: "",
        customerPhone: "",
        customerAddress: "",
        billNumber: "",
        billDate: new Date().toLocaleDateString("en-IN"),
        orderId: "",
        items: [],
        totalAmount: 0,
        paidAmount: 0,
        balanceAmount: 0,
        paymentStatus: "PAYMENT PENDING"
    };
}

/**
 * Normalize billing data - convert undefined/null to empty values
 * This is important for Firestore compatibility
 */
export function normalizeBillData(data: Partial<BillData>): BillData {
    const empty = createEmptyBillData();
    const balanceAmount = data.balanceAmount || 0;

    return {
        businessName: data.businessName || empty.businessName,
        subtitle: data.subtitle || empty.subtitle,
        customerName: data.customerName || empty.customerName,
        customerPhone: data.customerPhone || empty.customerPhone,
        customerAddress: data.customerAddress || empty.customerAddress,
        billNumber: data.billNumber || empty.billNumber,
        billDate: data.billDate || empty.billDate,
        orderId: data.orderId || empty.orderId,
        items: (data.items || []).map((item, index) => ({
            sno: item.sno || index + 1,
            particular: item.particular || "",
            qty: item.qty || 0,
            price: item.price || 0,
            total: item.total || (item.qty || 0) * (item.price || 0)
        })),
        totalAmount: data.totalAmount || 0,
        paidAmount: data.paidAmount || 0,
        balanceAmount,
        // Auto-derive payment status from balance
        paymentStatus: balanceAmount === 0 ? "PAYMENT COMPLETED" : "PAYMENT PENDING"
    };
}
