
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { MetricCard } from "@/components/ui/metric-card";
import { DataTable } from "@/components/ui/data-table";
import { 
  DollarSign, Users, ShoppingBag, BarChart as BarChartIcon, ShoppingCart, 
  ArrowUpRight, CircleDollarSign, AreaChart as AreaChartIcon, PlusCircle
} from "lucide-react";
import { 
  dashboardStats, 
  orderData, 
  abandonedCartData,
  salesTrendData
} from "@/data/mockData";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, Legend } from "recharts";
import { revenueBreakdownData } from "@/data/mockData";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Dashboard() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const renderOrderStatus = (status: string) => {
    const statusMap: Record<string, { color: string; label: string }> = {
      pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending" },
      processing: { color: "bg-blue-100 text-blue-800", label: "Processing" },
      completed: { color: "bg-green-100 text-green-800", label: "Completed" },
      cancelled: { color: "bg-red-100 text-red-800", label: "Cancelled" },
      refunded: { color: "bg-gray-100 text-gray-800", label: "Refunded" },
    };

    const { color, label } = statusMap[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  const orderColumns = [
    { accessorKey: "id", header: "Order ID" },
    { 
      accessorKey: "customer.name", 
      header: "Customer",
      cell: (order: typeof orderData[0]) => (
        <div>
          <div className="font-medium">{order.customer.name}</div>
          <div className="text-sm text-muted-foreground">{order.customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "amount", 
      header: "Amount",
      cell: (order: typeof orderData[0]) => formatCurrency(order.amount)
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (order: typeof orderData[0]) => renderOrderStatus(order.status)
    },
    { accessorKey: "date", header: "Date" },
  ];

  const abandonedCartColumns = [
    { accessorKey: "id", header: "Cart ID" },
    { 
      accessorKey: "customer.name", 
      header: "Customer",
      cell: (cart: typeof abandonedCartData[0]) => (
        <div>
          <div className="font-medium">{cart.customer.name}</div>
          <div className="text-sm text-muted-foreground">{cart.customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "amount", 
      header: "Value",
      cell: (cart: typeof abandonedCartData[0]) => formatCurrency(cart.amount)
    },
    { accessorKey: "items", header: "Items" },
    { 
      accessorKey: "recoveryStatus", 
      header: "Status",
      cell: (cart: typeof abandonedCartData[0]) => {
        const statusMap: Record<string, { color: string; label: string }> = {
          not_attempted: { color: "bg-gray-100 text-gray-800", label: "Not Attempted" },
          email_sent: { color: "bg-blue-100 text-blue-800", label: "Email Sent" },
          sms_sent: { color: "bg-purple-100 text-purple-800", label: "SMS Sent" },
          recovered: { color: "bg-green-100 text-green-800", label: "Recovered" },
          lost: { color: "bg-red-100 text-red-800", label: "Lost" },
        };

        const { color, label } = statusMap[cart.recoveryStatus] || { color: "bg-gray-100 text-gray-800", label: cart.recoveryStatus };

        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {label}
          </span>
        );
      }
    },
  ];

  return (
    <div className="container mx-auto py-6 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your store's performance.
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Total Revenue"
          value={dashboardStats.totalRevenue}
          icon={<DollarSign className="h-4 w-4" />}
          change={dashboardStats.revenueChange}
        />
        <MetricCard
          title="Total Orders"
          value={dashboardStats.totalOrders}
          icon={<ShoppingBag className="h-4 w-4" />}
          change={dashboardStats.orderChange}
        />
        <MetricCard
          title="Total Customers"
          value={dashboardStats.totalCustomers}
          icon={<Users className="h-4 w-4" />}
          change={dashboardStats.customerChange}
        />
        <MetricCard
          title="Cart Abandonment"
          value={dashboardStats.abandonmentRate}
          icon={<ShoppingCart className="h-4 w-4" />}
          change={dashboardStats.abandonmentChange}
          className="border-amber-200"
        />
        <MetricCard
          title="Conversion Rate"
          value={dashboardStats.conversionRate}
          icon={<BarChartIcon className="h-4 w-4" />}
          change={dashboardStats.conversionChange}
        />
        <MetricCard
          title="Total Expenses"
          value={dashboardStats.totalExpenses}
          icon={<CircleDollarSign className="h-4 w-4" />}
          change={dashboardStats.expenseChange}
          className="border-red-200"
        />
      </div>

      {/* Sales trends and revenue breakdown */}
      <div className="grid gap-4 md:grid-cols-7">
        <Card className="md:col-span-4 hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Revenue Trends</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="outline">This Year</Badge>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={salesTrendData}
                  margin={{
                    top: 20,
                    right: 0,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                    formatter={(value) => [`$${value}`, "Revenue"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary) / 0.2)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 hover-scale">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Revenue Breakdown</CardTitle>
            <AreaChartIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pb-4">
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {revenueBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={36} />
                  <Tooltip formatter={(value) => [`${value}%`, "Percentage"]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <div>
        <SectionHeader
          title="Recent Orders"
          description="Latest customer orders across your store"
          actions={
            <Button size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Order
            </Button>
          }
          className="mb-4"
        />
        <DataTable
          columns={orderColumns}
          data={orderData}
        />
      </div>

      {/* Abandoned Carts */}
      <div>
        <SectionHeader
          title="Abandoned Carts"
          description="Customers who added items to cart but didn't complete checkout"
          actions={
            <Button size="sm" variant="outline">
              Recovery Settings
            </Button>
          }
          className="mb-4"
        />
        <DataTable
          columns={abandonedCartColumns}
          data={abandonedCartData}
        />
      </div>
    </div>
  );
}
