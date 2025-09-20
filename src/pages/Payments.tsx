
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/ui/section-header";
import { DataTable } from "@/components/ui/data-table";
import { CreditCard, DollarSign, Eye, PlusCircle, Receipt, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const Payments = () => {
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 5;

  interface Transaction {
    id: string;
    date: string;
    amount: string;
    status: string;
    method: string;
    description: string;
  }

  const transactions: Transaction[] = [
    {
      id: "TX-12345",
      date: "2023-04-01",
      amount: "$299.99",
      status: "Completed",
      method: "Credit Card",
      description: "Monthly subscription payment"
    },
    {
      id: "TX-12346",
      date: "2023-04-02",
      amount: "$129.50",
      status: "Pending",
      method: "PayPal",
      description: "Product purchase - Premium plan"
    },
    {
      id: "TX-12347",
      date: "2023-04-05",
      amount: "$59.99",
      status: "Completed",
      method: "Credit Card",
      description: "Add-on purchase"
    },
    {
      id: "TX-12348",
      date: "2023-04-07",
      amount: "$452.00",
      status: "Refunded",
      method: "Bank Transfer",
      description: "Bulk order - refunded due to out of stock"
    },
    {
      id: "TX-12349",
      date: "2023-04-09",
      amount: "$89.99",
      status: "Completed",
      method: "Credit Card",
      description: "One-time service fee"
    },
    {
      id: "TX-12350",
      date: "2023-04-10",
      amount: "$199.99",
      status: "Completed",
      method: "Credit Card",
      description: "Annual plan upgrade"
    },
    {
      id: "TX-12351",
      date: "2023-04-12",
      amount: "$45.00",
      status: "Pending",
      method: "PayPal",
      description: "Digital product purchase"
    },
  ];

  const paginatedTransactions = transactions.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const pageCount = Math.ceil(transactions.length / pageSize);

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would submit to an API
    toast({
      title: "Payment method added",
      description: "Your new payment method has been added successfully.",
    });
    setShowAddPaymentMethod(false);
  };

  const handleViewTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setShowTransactionDetails(true);
  };

  const transactionColumns = [
    { accessorKey: "id", header: "Transaction ID" },
    { accessorKey: "date", header: "Date" },
    { accessorKey: "amount", header: "Amount" },
    { 
      accessorKey: "method", 
      header: "Payment Method",
      cell: (transaction: Transaction) => (
        <div className="font-medium">{transaction.method}</div>
      )
    },
    { 
      accessorKey: "status", 
      header: "Status",
      cell: (transaction: Transaction) => {
        const statusStyles: Record<string, string> = {
          "Completed": "bg-green-100 text-green-800",
          "Pending": "bg-yellow-100 text-yellow-800",
          "Refunded": "bg-red-100 text-red-800"
        };
        
        return (
          <Badge className={statusStyles[transaction.status] || "bg-gray-100 text-gray-800"}>
            {transaction.status}
          </Badge>
        );
      }
    },
    { 
      accessorKey: "actions", 
      header: "",
      cell: (transaction: Transaction) => (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => handleViewTransaction(transaction)}
        >
          <Eye className="h-4 w-4 mr-2" />
          View
        </Button>
      )
    }
  ];

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          Manage your payment methods, view transactions, and handle refunds.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">
              +20.1% from last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$3,452.00</div>
            <p className="text-xs text-muted-foreground">
              4 transactions in progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refunds</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$752.40</div>
            <p className="text-xs text-muted-foreground">
              3 refunds processed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-2xl font-bold">5</div>
                <p className="text-xs text-muted-foreground">
                  Credit cards, PayPal, etc.
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="h-8"
                onClick={() => setShowAddPaymentMethod(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <SectionHeader
        title="Recent Transactions"
        description="View and manage your recent payment transactions"
      />

      <DataTable
        columns={transactionColumns}
        data={paginatedTransactions}
        emptyMessage="No transactions found"
        pagination={{
          pageIndex: currentPage,
          pageSize: pageSize,
          pageCount: pageCount,
          onPageChange: setCurrentPage
        }}
      />

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddPaymentMethod} onOpenChange={setShowAddPaymentMethod}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Enter your card details to add a new payment method to your account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPaymentMethod}>
            <div className="grid gap-4 py-4">
              <RadioGroup defaultValue="card" className="grid grid-cols-3 gap-4">
                <div>
                  <RadioGroupItem value="card" id="card" className="peer sr-only" />
                  <Label
                    htmlFor="card"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <CreditCard className="mb-3 h-6 w-6" />
                    Card
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="paypal" id="paypal" className="peer sr-only" />
                  <Label
                    htmlFor="paypal"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <svg className="mb-3 h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.36 9.42h1.28c1.04 0 1.89-.37 2.11-1.43.28-1.35-.46-1.43-1.47-1.43H8.11l-.75 2.86Z" fill="currentColor" />
                      <path d="M6.5 11.04h1.28c1.04 0 1.89-.37 2.11-1.43.28-1.35-.46-1.43-1.47-1.43H7.25l-.75 2.86Z" fill="currentColor" />
                      <path d="M12.94 11.04h1.28c1.04 0 1.89-.37 2.11-1.43.28-1.35-.46-1.43-1.47-1.43h-1.17l-.75 2.86Z" fill="currentColor" />
                      <path d="M21.17 16.81c.05-.26.08-.53.08-.81 0-2.21-1.79-4-4-4-1.7 0-3.15 1.07-3.72 2.56-.27.72-.17 1.55.25 2.2.4.65 1.05 1.12 1.79 1.31.64.16 1.28.24 1.93.24h1.25c.27 0 .49.18.56.43.09.35.13.7.13 1.07 0 1.05-.86 1.91-1.91 1.91H13.1c-.32 0-.58-.26-.58-.58v-.15c0-.32.26-.58.58-.58h4.65c.38 0 .68-.31.68-.68 0-.38-.31-.68-.68-.68H13.1c-.99 0-1.81.81-1.81 1.81v.15c0 .99.81 1.81 1.81 1.81h4.42c1.8 0 3.26-1.46 3.26-3.26 0-.39-.07-.76-.19-1.11l-.42-.01Z" fill="currentColor" />
                      <path d="M13.6 11.04h1.28c1.04 0 1.89-.37 2.11-1.43.28-1.35-.46-1.43-1.47-1.43h-1.17l-.75 2.86Z" fill="currentColor" />
                      <path d="M10.78 6.69C10.39 4.87 8.85 4 6.86 4H2.28c-.4 0-.73.32-.73.72 0 .06.02.13.03.19L4.35 19.6c.1.51.59.91 1.12.91h2.7c.4 0 .73-.32.73-.72 0-.06-.02-.13-.03-.19l-.65-3.23c-.07-.38.21-.74.6-.74h1.3c3.31 0 5.34-1.51 5.71-4.91.16-1.49-.15-2.68-.97-3.49-.32-.31-.71-.55-1.18-.7l-2.9.16Z" fill="currentColor" />
                    </svg>
                    PayPal
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="apple" id="apple" className="peer sr-only" />
                  <Label
                    htmlFor="apple"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <svg className="mb-3 h-6 w-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M14.47 6.22c.85 0 1.55-.7 1.55-1.55 0-.85-.7-1.55-1.55-1.55-.85 0-1.55.7-1.55 1.55 0 .85.7 1.55 1.55 1.55Z" fill="currentColor" />
                      <path d="M16.98 6.8c-.85 0-1.55.7-1.55 1.55v6.92c0 .85.7 1.55 1.55 1.55.85 0 1.55-.7 1.55-1.55V8.35c0-.85-.7-1.55-1.55-1.55Z" fill="currentColor" />
                      <path d="M11.97 6.8c-.85 0-1.55.7-1.55 1.55v7.75c0 .85.7 1.55 1.55 1.55.85 0 1.55-.7 1.55-1.55V8.35c0-.85-.7-1.55-1.55-1.55Z" fill="currentColor" />
                      <path d="M6.95 6.8c-.85 0-1.55.7-1.55 1.55v7.75c0 .85.7 1.55 1.55 1.55.85 0 1.55-.7 1.55-1.55V8.35c0-.85-.7-1.55-1.55-1.55Z" fill="currentColor" />
                      <path d="M9.46 13.16c-.85 0-1.55.7-1.55 1.55v3.53c0 .85.7 1.55 1.55 1.55.85 0 1.55-.7 1.55-1.55v-3.53c0-.85-.7-1.55-1.55-1.55Z" fill="currentColor" />
                      <path d="M14.47 13.16c-.85 0-1.55.7-1.55 1.55v3.53c0 .85.7 1.55 1.55 1.55.85 0 1.55-.7 1.55-1.55v-3.53c0-.85-.7-1.55-1.55-1.55Z" fill="currentColor" />
                    </svg>
                    Apple Pay
                  </Label>
                </div>
              </RadioGroup>
              <div className="space-y-2">
                <Label htmlFor="cardName">Name on card</Label>
                <Input id="cardName" placeholder="John Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card number</Label>
                <Input id="cardNumber" placeholder="XXXX XXXX XXXX XXXX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">Expiry date</Label>
                  <Input id="expiry" placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" placeholder="123" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">Save Payment Method</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction Details Dialog */}
      <Dialog open={showTransactionDetails} onOpenChange={setShowTransactionDetails}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Complete information about this transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Transaction ID</p>
                  <p className="font-medium">{selectedTransaction.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Date</p>
                  <p className="font-medium">{selectedTransaction.date}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amount</p>
                  <p className="font-medium">{selectedTransaction.amount}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge className={
                    selectedTransaction.status === "Completed" ? "bg-green-100 text-green-800" :
                    selectedTransaction.status === "Pending" ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }>
                    {selectedTransaction.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{selectedTransaction.method}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedTransaction.description}</p>
                </div>
              </div>
              <div className="mt-6">
                {selectedTransaction.status === "Pending" && (
                  <Button 
                    className="mr-2"
                    onClick={() => {
                      toast({
                        title: "Transaction processed",
                        description: "The transaction has been successfully processed.",
                      });
                      setShowTransactionDetails(false);
                    }}
                  >
                    Process Transaction
                  </Button>
                )}
                {selectedTransaction.status === "Completed" && (
                  <Button 
                    variant="destructive"
                    className="mr-2"
                    onClick={() => {
                      toast({
                        title: "Refund initiated",
                        description: "The refund process has been initiated and will be completed in 3-5 business days.",
                      });
                      setShowTransactionDetails(false);
                    }}
                  >
                    Refund Transaction
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Receipt sent",
                      description: "Transaction receipt has been sent to your email.",
                    });
                  }}
                >
                  Send Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Payments;
