
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, RefreshCw, SendHorizonal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AbandonedCart } from "@/data/mockData";

interface AbandonedCartRemindersProps {
  carts: AbandonedCart[];
  apiKey: string;
}

export function AbandonedCartReminders({ carts, apiKey }: AbandonedCartRemindersProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [aiMessage, setAiMessage] = useState("");

  const generateReminder = async (cart: AbandonedCart) => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please add your OpenAI API key in the configuration section.",
        variant: "destructive",
      });
      return;
    }

    setSelectedCart(cart);
    setIsGenerating(true);
    
    // Simulating AI response - in a real app, this would be an API call to OpenAI
    setTimeout(() => {
      const message = `
Dear ${cart.customer.name},

We noticed you left some great items in your cart! Your selection of ${cart.items} items worth $${cart.amount.toFixed(2)} is waiting for you.

Would you like to complete your purchase? We're offering a special 10% discount if you complete your order in the next 24 hours. Just use code COMEBACK10 at checkout.

If you have any questions about your items, please don't hesitate to reach out.

Best regards,
The Store Team
      `;
      
      setAiMessage(message);
      setIsGenerating(false);
    }, 2000);
  };

  const sendReminder = () => {
    if (!selectedCart) return;
    
    toast({
      title: "Reminder Sent",
      description: `Recovery message sent to ${selectedCart.customer.name}`,
    });
    
    setSelectedCart(null);
    setAiMessage("");
  };

  const columns = [
    { 
      accessorKey: "customer.name", 
      header: "Customer",
      cell: (cart: AbandonedCart) => (
        <div>
          <div className="font-medium">{cart.customer.name}</div>
          <div className="text-sm text-muted-foreground">{cart.customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "amount", 
      header: "Cart Value",
      cell: (cart: AbandonedCart) => (
        <div className="font-medium">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(cart.amount)}
        </div>
      )
    },
    { 
      accessorKey: "items", 
      header: "Items",
      cell: (cart: AbandonedCart) => (
        <Badge variant="outline" className="rounded-full">
          {cart.items} {cart.items === 1 ? 'item' : 'items'}
        </Badge>
      )
    },
    { accessorKey: "abandonedAt", header: "Abandoned At" },
    { 
      accessorKey: "recoveryStatus", 
      header: "Status",
      cell: (cart: AbandonedCart) => {
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
    { 
      accessorKey: "actions", 
      header: "Actions",
      cell: (cart: AbandonedCart) => (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => generateReminder(cart)}
          disabled={isGenerating}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Generate Reminder
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        data={carts}
        emptyMessage="No abandoned carts found"
      />

      {selectedCart && (
        <Card className="mt-6 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              AI-Generated Recovery Message for {selectedCart.customer.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isGenerating ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea 
                  value={aiMessage} 
                  onChange={(e) => setAiMessage(e.target.value)}
                  className="min-h-[200px]"
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedCart(null);
                      setAiMessage("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={sendReminder}>
                    <SendHorizonal className="mr-2 h-4 w-4" />
                    Send Reminder
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
