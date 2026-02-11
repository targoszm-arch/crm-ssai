import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Search,
  PlusCircle,
  X,
  Filter,
  ArrowUpCircle,
  ArrowDownCircle,
  CalendarIcon,
  Wallet,
  BarChart as BarChartIcon,
  DollarSign,
  PieChart as PieChartIcon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { financeData, FinanceEntry } from "@/data/mockData";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface ChartDataItem {
  name: string;
  income: number;
  expense: number;
}

export default function Finances() {
  const [searchQuery, setSearchQuery] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const filteredEntries = financeData.filter(entry => {
    const matchesSearch = !searchQuery || 
      entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = !typeFilter || entry.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const chartData: ChartDataItem[] = [];
  const categories = [...new Set(financeData.map(entry => entry.category))];
  
  categories.forEach(category => {
    const incomeAmount = financeData
      .filter(entry => entry.category === category && entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    const expenseAmount = financeData
      .filter(entry => entry.category === category && entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0);
    
    chartData.push({
      name: category,
      income: incomeAmount,
      expense: expenseAmount
    });
  });

  const totalIncome = financeData
    .filter(entry => entry.type === 'income')
    .reduce((sum, entry) => sum + entry.amount, 0);
  
  const totalExpense = financeData
    .filter(entry => entry.type === 'expense')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const financeColumns = [
    { accessorKey: "id", header: "ID" },
    { 
      accessorKey: "type", 
      header: "Type",
      cell: (entry: FinanceEntry) => (
        <div className="flex items-center">
          {entry.type === 'income' ? (
            <div className="flex items-center">
              <ArrowUpCircle className="mr-2 h-4 w-4 text-green-500" />
              <span>Income</span>
            </div>
          ) : (
            <div className="flex items-center">
              <ArrowDownCircle className="mr-2 h-4 w-4 text-red-500" />
              <span>Expense</span>
            </div>
          )}
        </div>
      )
    },
    { accessorKey: "category", header: "Category" },
    { 
      accessorKey: "amount", 
      header: "Amount",
      cell: (entry: FinanceEntry) => (
        <div className={entry.type === 'income' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
          {entry.type === 'income' ? '+' : '-'}
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(entry.amount)}
        </div>
      )
    },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "description", header: "Description" }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finances</h1>
        <p className="text-muted-foreground">
          Track your revenue, expenses, and generate financial reports.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">{
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totalIncome)
                }</p>
              </div>
              <div className="p-2 rounded-md bg-green-100 text-green-600">
                <DollarSign className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-red-600">{
                  new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totalExpense)
                }</p>
              </div>
              <div className="p-2 rounded-md bg-red-100 text-red-600">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="hover-scale">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Net Profit</p>
                <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(totalIncome - totalExpense)}
                </p>
              </div>
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <BarChartIcon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="hover-scale">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Income vs Expenses by Category</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 30,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis 
                  dataKey="name" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={true}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  formatter={(value) => [
                    `$${Number(value).toFixed(2)}`,
                    ''
                  ]}
                />
                <Legend />
                <Bar dataKey="income" name="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-auto flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Press Enter to search..."
                className="pl-8 w-full"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setSearchQuery(localSearch)}
              />
              {localSearch && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9"
                  onClick={() => { setLocalSearch(""); setSearchQuery(""); }}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select onValueChange={(value) => setTypeFilter(value || null)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <div className="flex items-center">
                    <Filter className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Type" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <SectionHeader
        title="Transaction History"
        description={`Showing ${filteredEntries.length} transactions`}
        actions={
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <CalendarIcon className="mr-2 h-4 w-4" />
              Date Range
            </Button>
            <Button variant="outline" size="sm">
              <PieChartIcon className="mr-2 h-4 w-4" />
              Reports
            </Button>
          </div>
        }
        className="mt-8 mb-4"
      />

      <DataTable
        columns={financeColumns}
        data={filteredEntries}
        emptyMessage="No transactions found"
      />
    </div>
  );
}
