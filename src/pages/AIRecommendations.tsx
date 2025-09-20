
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  ShoppingCart,
  ChartBarIcon,
  BarChart,
  RefreshCw,
  MessageSquare,
  CornerRightDown
} from "lucide-react";
import { abandonedCartData } from "@/data/mockData";
import { UpsellSuggestions } from "@/components/ai/UpsellSuggestions";
import { AbandonedCartReminders } from "@/components/ai/AbandonedCartReminders";
import { SalesPerformanceReport } from "@/components/ai/SalesPerformanceReport";

export default function AIRecommendations() {
  const { toast } = useToast();
  const [openAIKey, setOpenAIKey] = useState(() => {
    return localStorage.getItem("openai_api_key") || "";
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const saveAPIKey = () => {
    if (openAIKey) {
      localStorage.setItem("openai_api_key", openAIKey);
      toast({
        title: "API Key Saved",
        description: "Your OpenAI API key has been saved to your browser's local storage.",
      });
    } else {
      toast({
        title: "Error",
        description: "Please enter a valid API key",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Recommendations</h1>
        <p className="text-muted-foreground">
          Leverage AI to improve sales, reduce cart abandonment, and gain insights.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">OpenAI API Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                type="password"
                placeholder="Enter your OpenAI API key"
                value={openAIKey}
                onChange={(e) => setOpenAIKey(e.target.value)}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your API key is stored locally in your browser and is never sent to our servers.
              </p>
            </div>
            <Button onClick={saveAPIKey}>Save API Key</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upsells" className="w-full space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="upsells">
            <Sparkles className="mr-2 h-4 w-4" />
            Upsell Suggestions
          </TabsTrigger>
          <TabsTrigger value="abandonment">
            <ShoppingCart className="mr-2 h-4 w-4" />
            Cart Reminders
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart className="mr-2 h-4 w-4" />
            AI Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upsells" className="space-y-6">
          <SectionHeader
            title="AI-Powered Upsell Suggestions"
            description="Get smart product recommendations based on customer purchase history"
            className="mb-4"
          />
          <UpsellSuggestions apiKey={openAIKey} />
        </TabsContent>

        <TabsContent value="abandonment" className="space-y-6">
          <SectionHeader
            title="Abandoned Cart AI Reminders"
            description="Personalized messages to recover abandoned carts"
            className="mb-4"
          />
          <AbandonedCartReminders carts={abandonedCartData} apiKey={openAIKey} />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <SectionHeader
            title="AI-Generated Sales Reports"
            description="Get AI-powered insights on your sales performance"
            className="mb-4"
          />
          <SalesPerformanceReport apiKey={openAIKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
