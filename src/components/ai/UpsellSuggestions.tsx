
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

interface UpsellSuggestionsProps {
  apiKey: string;
}

// Mock data for now - in a real app, this would come from your backend
const customerData = [
  {
    id: "CUS-1001",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    lastPurchase: "Premium Headphones",
    purchaseHistory: ["Smartphone", "Wireless Earbuds", "Premium Headphones"],
    suggestedUpsell: "Phone Case with Screen Protector Bundle",
    reason: "Customers who purchase phones often need protection accessories. Based on purchase history, this customer values audio quality, suggesting they might also value phone protection."
  },
  {
    id: "CUS-1002",
    name: "John Davis",
    email: "john.davis@example.com",
    lastPurchase: "Gaming Laptop",
    purchaseHistory: ["Gaming Mouse", "Gaming Keyboard", "Gaming Laptop"],
    suggestedUpsell: "Gaming Headset with Surround Sound",
    reason: "This customer is building a gaming setup. A high-quality headset would complete their gaming experience and enhance gameplay."
  },
  {
    id: "CUS-1003",
    name: "Emily Johnson",
    email: "emily.j@example.com",
    lastPurchase: "Digital Camera",
    purchaseHistory: ["Camera Bag", "Memory Card", "Digital Camera"],
    suggestedUpsell: "Premium Lens Kit and Tripod",
    reason: "Customer has purchased a camera and basic accessories. A lens kit and tripod would allow them to take their photography to the next level."
  }
];

export function UpsellSuggestions({ apiKey }: UpsellSuggestionsProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState(customerData);

  const generateSuggestions = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please add your OpenAI API key in the configuration section.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    
    // In a real implementation, this would call OpenAI API
    // This is a simulated delay
    setTimeout(() => {
      setIsGenerating(false);
      toast({
        title: "Suggestions Generated",
        description: "New AI-powered upsell suggestions are ready.",
      });
    }, 2000);
  };

  const columns = [
    { accessorKey: "id", header: "Customer ID" },
    { 
      accessorKey: "name", 
      header: "Customer",
      cell: (customer: typeof customerData[0]) => (
        <div>
          <div className="font-medium">{customer.name}</div>
          <div className="text-sm text-muted-foreground">{customer.email}</div>
        </div>
      )
    },
    { 
      accessorKey: "lastPurchase", 
      header: "Last Purchase",
      cell: (customer: typeof customerData[0]) => (
        <Badge variant="outline">{customer.lastPurchase}</Badge>
      )
    },
    { 
      accessorKey: "suggestedUpsell", 
      header: "Suggested Upsell",
      cell: (customer: typeof customerData[0]) => (
        <div className="font-medium text-primary">{customer.suggestedUpsell}</div>
      )
    },
    { 
      accessorKey: "reason", 
      header: "AI Reasoning",
      cell: (customer: typeof customerData[0]) => (
        <div className="max-w-[300px] text-sm">{customer.reason}</div>
      )
    },
    { 
      accessorKey: "actions", 
      header: "",
      cell: () => (
        <Button variant="ghost" size="sm">
          <MessageSquare className="h-4 w-4 mr-2" />
          Send Message
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
                Smart Upsell Recommendations
              </h3>
              <p className="text-muted-foreground">
                AI-generated product recommendations based on purchase history and behavior
              </p>
            </div>
            <Button 
              onClick={generateSuggestions} 
              disabled={isGenerating || !apiKey}
              className="min-w-[180px]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={suggestions}
        emptyMessage="No upsell suggestions available"
      />
    </div>
  );
}
