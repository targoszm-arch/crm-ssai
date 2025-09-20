
import { format, subDays, subHours } from "date-fns";

// Customer data
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: string;
  dateAdded: string;
  status: "active" | "inactive";
}

export const customerData: Customer[] = [
  {
    id: "c001",
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    totalOrders: 12,
    totalSpent: 1250.75,
    lastOrderDate: format(subDays(new Date(), 2), "MMM dd, yyyy"),
    dateAdded: format(subDays(new Date(), 45), "MMM dd, yyyy"),
    status: "active"
  },
  {
    id: "c002",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+1 (555) 987-6543",
    totalOrders: 8,
    totalSpent: 980.25,
    lastOrderDate: format(subDays(new Date(), 5), "MMM dd, yyyy"),
    dateAdded: format(subDays(new Date(), 60), "MMM dd, yyyy"),
    status: "active"
  },
  {
    id: "c003",
    name: "Robert Johnson",
    email: "robert.j@example.com",
    phone: "+1 (555) 234-5678",
    totalOrders: 5,
    totalSpent: 650.50,
    lastOrderDate: format(subDays(new Date(), 8), "MMM dd, yyyy"),
    dateAdded: format(subDays(new Date(), 30), "MMM dd, yyyy"),
    status: "active"
  },
  {
    id: "c004",
    name: "Emily Williams",
    email: "emily.w@example.com",
    phone: "+1 (555) 876-5432",
    totalOrders: 3,
    totalSpent: 320.75,
    lastOrderDate: format(subDays(new Date(), 12), "MMM dd, yyyy"),
    dateAdded: format(subDays(new Date(), 20), "MMM dd, yyyy"),
    status: "inactive"
  },
  {
    id: "c005",
    name: "Michael Brown",
    email: "michael.b@example.com",
    phone: "+1 (555) 345-6789",
    totalOrders: 7,
    totalSpent: 890.25,
    lastOrderDate: format(subDays(new Date(), 3), "MMM dd, yyyy"),
    dateAdded: format(subDays(new Date(), 90), "MMM dd, yyyy"),
    status: "active"
  }
];

// Order data
export interface Order {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
  };
  amount: number;
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  date: string;
  items: number;
  paymentMethod: string;
}

export const orderData: Order[] = [
  {
    id: "ORD-001",
    customer: {
      id: "c001",
      name: "John Doe",
      email: "john.doe@example.com"
    },
    amount: 125.99,
    status: "completed",
    date: format(subDays(new Date(), 2), "MMM dd, yyyy"),
    items: 3,
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-002",
    customer: {
      id: "c002",
      name: "Jane Smith",
      email: "jane.smith@example.com"
    },
    amount: 85.50,
    status: "processing",
    date: format(subDays(new Date(), 1), "MMM dd, yyyy"),
    items: 2,
    paymentMethod: "PayPal"
  },
  {
    id: "ORD-003",
    customer: {
      id: "c003",
      name: "Robert Johnson",
      email: "robert.j@example.com"
    },
    amount: 220.75,
    status: "pending",
    date: format(new Date(), "MMM dd, yyyy"),
    items: 4,
    paymentMethod: "Credit Card"
  },
  {
    id: "ORD-004",
    customer: {
      id: "c005",
      name: "Michael Brown",
      email: "michael.b@example.com"
    },
    amount: 65.25,
    status: "completed",
    date: format(subDays(new Date(), 3), "MMM dd, yyyy"),
    items: 1,
    paymentMethod: "Stripe"
  },
  {
    id: "ORD-005",
    customer: {
      id: "c004",
      name: "Emily Williams",
      email: "emily.w@example.com"
    },
    amount: 180.00,
    status: "cancelled",
    date: format(subDays(new Date(), 5), "MMM dd, yyyy"),
    items: 3,
    paymentMethod: "Flutterwave"
  }
];

// Abandoned Cart data
export interface AbandonedCart {
  id: string;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  amount: number;
  items: number;
  abandonedAt: string;
  recoveryStatus: "not_attempted" | "email_sent" | "sms_sent" | "recovered" | "lost";
}

export const abandonedCartData: AbandonedCart[] = [
  {
    id: "CART-001",
    customer: {
      id: "c001",
      name: "John Doe",
      email: "john.doe@example.com",
      phone: "+1 (555) 123-4567"
    },
    amount: 94.99,
    items: 2,
    abandonedAt: format(subHours(new Date(), 3), "MMM dd, yyyy h:mm a"),
    recoveryStatus: "email_sent"
  },
  {
    id: "CART-002",
    customer: {
      id: "c004",
      name: "Emily Williams",
      email: "emily.w@example.com",
      phone: "+1 (555) 876-5432"
    },
    amount: 145.50,
    items: 3,
    abandonedAt: format(subHours(new Date(), 6), "MMM dd, yyyy h:mm a"),
    recoveryStatus: "not_attempted"
  },
  {
    id: "CART-003",
    customer: {
      id: "c003",
      name: "Robert Johnson",
      email: "robert.j@example.com",
      phone: "+1 (555) 234-5678"
    },
    amount: 65.75,
    items: 1,
    abandonedAt: format(subHours(new Date(), 12), "MMM dd, yyyy h:mm a"),
    recoveryStatus: "sms_sent"
  },
  {
    id: "CART-004",
    customer: {
      id: "c005",
      name: "Michael Brown",
      email: "michael.b@example.com",
      phone: "+1 (555) 345-6789"
    },
    amount: 210.25,
    items: 4,
    abandonedAt: format(subDays(new Date(), 1), "MMM dd, yyyy h:mm a"),
    recoveryStatus: "recovered"
  },
  {
    id: "CART-005",
    customer: {
      id: "c002",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      phone: "+1 (555) 987-6543"
    },
    amount: 55.00,
    items: 1,
    abandonedAt: format(subDays(new Date(), 2), "MMM dd, yyyy h:mm a"),
    recoveryStatus: "lost"
  }
];

// Finance data
export interface FinanceEntry {
  id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  date: string;
  description: string;
}

export const financeData: FinanceEntry[] = [
  {
    id: "FIN-001",
    type: "income",
    category: "Sales",
    amount: 1250.75,
    date: format(subDays(new Date(), 1), "MMM dd, yyyy"),
    description: "Online shop sales"
  },
  {
    id: "FIN-002",
    type: "expense",
    category: "Advertising",
    amount: 300.00,
    date: format(subDays(new Date(), 2), "MMM dd, yyyy"),
    description: "Facebook ads campaign"
  },
  {
    id: "FIN-003",
    type: "income",
    category: "Sales",
    amount: 895.50,
    date: format(subDays(new Date(), 3), "MMM dd, yyyy"),
    description: "Online shop sales"
  },
  {
    id: "FIN-004",
    type: "expense",
    category: "Supplies",
    amount: 150.25,
    date: format(subDays(new Date(), 4), "MMM dd, yyyy"),
    description: "Packaging materials"
  },
  {
    id: "FIN-005",
    type: "expense",
    category: "Shipping",
    amount: 85.50,
    date: format(subDays(new Date(), 5), "MMM dd, yyyy"),
    description: "Delivery service fees"
  }
];

// Dashboard stats
export const dashboardStats = {
  // Revenue stats
  totalRevenue: "$12,580.50",
  revenueChange: {
    value: 12,
    isPositive: true
  },
  
  // Order stats
  totalOrders: "186",
  orderChange: {
    value: 8,
    isPositive: true
  },
  
  // Customer stats
  totalCustomers: "1,205",
  customerChange: {
    value: 5,
    isPositive: true
  },
  
  // Conversion stats
  conversionRate: "3.2%",
  conversionChange: {
    value: 1.5,
    isPositive: true
  },

  // Cart abandonment stats
  abandonmentRate: "68%",
  abandonmentChange: {
    value: 2.3,
    isPositive: false
  },
  
  // Expense stats
  totalExpenses: "$3,850.25",
  expenseChange: {
    value: 4.2,
    isPositive: false
  }
};

// Sales trend data
export const salesTrendData = [
  { name: "Jan", revenue: 2400 },
  { name: "Feb", revenue: 1398 },
  { name: "Mar", revenue: 9800 },
  { name: "Apr", revenue: 3908 },
  { name: "May", revenue: 4800 },
  { name: "Jun", revenue: 3800 },
  { name: "Jul", revenue: 4300 },
];

// Revenue breakdown
export const revenueBreakdownData = [
  { name: "Electronics", value: 40 },
  { name: "Clothing", value: 30 },
  { name: "Home", value: 15 },
  { name: "Beauty", value: 10 },
  { name: "Other", value: 5 },
];
