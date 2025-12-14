"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Customer, Order } from "@/types";
import {
    getAllCustomers,
    getCustomersSorted,
    searchCustomers,
    getOrdersByCustomerPhone,
    getCustomerSummary,
    CustomerSummary,
} from "@/lib/customers";
import ProtectedRoute from "@/components/ProtectedRoute";
import TopBar from "@/components/TopBar";
import {
    Users,
    Search,
    TrendingUp,
    DollarSign,
    Package,
    Phone,
    Calendar,
    ArrowUpDown,
    X,
    Eye,
    ChevronRight,
    Award,
    Wallet,
    ShoppingCart,
    PiggyBank
} from "lucide-react";

type SortOption = "recent" | "orders" | "revenue";

export default function CustomerManagementPage() {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
    const [summary, setSummary] = useState<CustomerSummary | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState<SortOption>("recent");

    // Selected customer view
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterAndSort();
    }, [customers, searchTerm, sortBy]);

    const loadData = async () => {
        try {
            const [allCustomers, stats] = await Promise.all([
                getAllCustomers(),
                getCustomerSummary(),
            ]);
            setCustomers(allCustomers);
            setFilteredCustomers(allCustomers);
            setSummary(stats);
        } catch (error) {
            console.error("Failed to load customers:", error);
        } finally {
            setLoading(false);
        }
    };

    const filterAndSort = async () => {
        let result = [...customers];

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            result = result.filter(
                (c) =>
                    c.name.toLowerCase().includes(term) ||
                    c.phoneNumber.includes(term)
            );
        }

        // Apply sorting
        switch (sortBy) {
            case "orders":
                result.sort((a, b) => b.totalOrders - a.totalOrders);
                break;
            case "revenue":
                result.sort((a, b) => b.totalRevenue - a.totalRevenue);
                break;
            case "recent":
            default:
                result.sort((a, b) => b.lastOrderDate.toMillis() - a.lastOrderDate.toMillis());
                break;
        }

        setFilteredCustomers(result);
    };

    const viewCustomerOrders = async (customer: Customer) => {
        setSelectedCustomer(customer);
        setLoadingOrders(true);
        try {
            const orders = await getOrdersByCustomerPhone(customer.phoneNumber);
            setCustomerOrders(orders);
        } catch (error) {
            console.error("Failed to load customer orders:", error);
        } finally {
            setLoadingOrders(false);
        }
    };

    const closeCustomerView = () => {
        setSelectedCustomer(null);
        setCustomerOrders([]);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed": return "bg-green-100 text-green-800";
            case "delivered": return "bg-blue-100 text-blue-800";
            case "in_progress": return "bg-yellow-100 text-yellow-800";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    if (loading) {
        return (
            <ProtectedRoute allowedRoles={["admin"]}>
                <div className="page-container min-h-screen">
                    <TopBar />
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={["admin"]}>
            <div className="page-container min-h-screen">
                <TopBar />

                <div className="page-content">
                    {/* Header */}
                    <div className="mb-6">
                        <div className="flex items-center space-x-3 mb-2">
                            <Users className="w-8 h-8 text-indigo-600" />
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                                Customer Management
                            </h1>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                            View customer-wise orders and financial summaries
                        </p>
                    </div>

                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
                                <div className="flex items-center space-x-3">
                                    <Users className="w-8 h-8 text-blue-600" />
                                    <div>
                                        <p className="text-xs text-blue-600 uppercase font-medium">Customers</p>
                                        <p className="text-xl font-bold text-blue-700">{summary.totalCustomers}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
                                <div className="flex items-center space-x-3">
                                    <ShoppingCart className="w-8 h-8 text-purple-600" />
                                    <div>
                                        <p className="text-xs text-purple-600 uppercase font-medium">Total Orders</p>
                                        <p className="text-xl font-bold text-purple-700">{summary.totalOrders}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
                                <div className="flex items-center space-x-3">
                                    <DollarSign className="w-8 h-8 text-green-600" />
                                    <div>
                                        <p className="text-xs text-green-600 uppercase font-medium">Total Revenue</p>
                                        <p className="text-xl font-bold text-green-700">₹{summary.totalRevenue.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
                                <div className="flex items-center space-x-3">
                                    <Wallet className="w-8 h-8 text-orange-600" />
                                    <div>
                                        <p className="text-xs text-orange-600 uppercase font-medium">Total Expenses</p>
                                        <p className="text-xl font-bold text-orange-700">₹{summary.totalExpenses.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20">
                                <div className="flex items-center space-x-3">
                                    <PiggyBank className="w-8 h-8 text-emerald-600" />
                                    <div>
                                        <p className="text-xs text-emerald-600 uppercase font-medium">Total Profit</p>
                                        <p className="text-xl font-bold text-emerald-700">₹{summary.totalProfit.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20">
                                <div className="flex items-center space-x-3">
                                    <TrendingUp className="w-8 h-8 text-indigo-600" />
                                    <div>
                                        <p className="text-xs text-indigo-600 uppercase font-medium">Avg Order</p>
                                        <p className="text-xl font-bold text-indigo-700">₹{Math.round(summary.averageOrderValue).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Top Customers */}
                    {summary && summary.topCustomers.length > 0 && (
                        <div className="card mb-6">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                                <Award className="w-5 h-5 text-yellow-500" />
                                <span>Top Customers by Revenue</span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                {summary.topCustomers.map((customer, idx) => (
                                    <div
                                        key={customer.phoneNumber}
                                        className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => viewCustomerOrders(customer)}
                                    >
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="w-6 h-6 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center text-xs font-bold">
                                                {idx + 1}
                                            </span>
                                            <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{customer.name}</p>
                                        </div>
                                        <p className="text-xs text-gray-500">{customer.totalOrders} orders</p>
                                        <p className="text-sm font-bold text-green-600">₹{customer.totalRevenue.toLocaleString()}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Search and Sort */}
                    <div className="flex flex-col sm:flex-row gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or phone..."
                                className="input pl-10 w-full"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <ArrowUpDown className="w-5 h-5 text-gray-500" />
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as SortOption)}
                                className="input"
                            >
                                <option value="recent">Latest Activity</option>
                                <option value="orders">Most Orders</option>
                                <option value="revenue">Highest Revenue</option>
                            </select>
                        </div>
                    </div>

                    {/* Customer List */}
                    <div className="card">
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                            All Customers ({filteredCustomers.length})
                        </h3>

                        {filteredCustomers.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                No customers found
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredCustomers.map((customer) => (
                                    <div
                                        key={customer.phoneNumber}
                                        className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => viewCustomerOrders(customer)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-3 mb-2">
                                                    <span className="font-semibold text-gray-900 dark:text-white">
                                                        {customer.name}
                                                    </span>
                                                    <span className="flex items-center space-x-1 text-sm text-gray-500">
                                                        <Phone className="w-3 h-3" />
                                                        <span>{customer.phoneNumber}</span>
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-xs text-gray-500">Total Orders</p>
                                                        <p className="font-medium text-gray-900 dark:text-white">{customer.totalOrders}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Active</p>
                                                        <p className="font-medium text-yellow-600">{customer.activeOrders || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Delivered</p>
                                                        <p className="font-medium text-blue-600">{customer.deliveredOrders || 0}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Revenue</p>
                                                        <p className="font-medium text-green-600">₹{customer.totalRevenue.toLocaleString()}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500">Profit</p>
                                                        <p className={`font-medium ${customer.totalProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            ₹{customer.totalProfit.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="ml-4 flex items-center space-x-2 text-indigo-600">
                                                <span className="text-sm hidden sm:inline">View Orders</span>
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Customer Orders Modal */}
                    {selectedCustomer && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-gray-900 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                                {/* Modal Header */}
                                <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {selectedCustomer.name}
                                        </h2>
                                        <p className="text-sm text-gray-500 flex items-center space-x-1">
                                            <Phone className="w-4 h-4" />
                                            <span>{selectedCustomer.phoneNumber}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={closeCustomerView}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="p-6">
                                    {/* Customer Summary */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-blue-600 uppercase">Total Orders</p>
                                            <p className="text-2xl font-bold text-blue-700">{selectedCustomer.totalOrders}</p>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-green-600 uppercase">Revenue</p>
                                            <p className="text-2xl font-bold text-green-700">₹{selectedCustomer.totalRevenue.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-orange-600 uppercase">Expenses</p>
                                            <p className="text-2xl font-bold text-orange-700">₹{selectedCustomer.totalExpenses.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                                            <p className="text-xs text-emerald-600 uppercase">Profit</p>
                                            <p className={`text-2xl font-bold ${selectedCustomer.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                ₹{selectedCustomer.totalProfit.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Orders List */}
                                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
                                        <Package className="w-5 h-5 text-indigo-600" />
                                        <span>All Orders ({customerOrders.length})</span>
                                    </h3>

                                    {loadingOrders ? (
                                        <div className="flex justify-center py-8">
                                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
                                        </div>
                                    ) : customerOrders.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">
                                            No orders found
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {customerOrders.map((order) => (
                                                <div
                                                    key={order.orderId}
                                                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center space-x-2">
                                                            <span className="font-mono text-sm text-gray-600">
                                                                #{order.orderId.slice(0, 8)}...
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                                {order.status.replace(/_/g, " ")}
                                                            </span>
                                                        </div>
                                                        <span className="text-sm text-gray-500">
                                                            Stage: {order.currentStage}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                                        <div>
                                                            <p className="text-xs text-gray-500">Garment</p>
                                                            <p className="capitalize">{order.garmentType.replace(/_/g, " ")}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Due Date</p>
                                                            <p>{order.dueDate?.toDate().toLocaleDateString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Created</p>
                                                            <p>{order.createdAt?.toDate().toLocaleDateString()}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-gray-500">Price</p>
                                                            <p className="font-medium text-green-600">
                                                                {order.price ? `₹${order.price.toLocaleString()}` : '—'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {order.deliveredAt && (
                                                        <div className="mt-2 text-xs text-blue-600">
                                                            Delivered: {order.deliveredAt.toDate().toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Modal Footer */}
                                <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 px-6 py-4">
                                    <button
                                        onClick={closeCustomerView}
                                        className="w-full btn btn-primary"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </ProtectedRoute>
    );
}
