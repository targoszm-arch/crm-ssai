
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, RefreshCw, ChevronDown, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SalesPerformanceReportProps {
  apiKey: string;
}

export function SalesPerformanceReport({ apiKey }: SalesPerformanceReportProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [timeframe, setTimeframe] = useState("last30days");
  const [reportType, setReportType] = useState("summary");
  const [generatedReport, setGeneratedReport] = useState("");

  const generateReport = async () => {
    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please add your OpenAI API key in the configuration section.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedReport("");
    
    // Simulating AI response - in a real app, this would be an API call to OpenAI
    setTimeout(() => {
      const reportData = {
        summary: `# Sales Performance Report: ${timeframe === "last30days" ? "Last 30 Days" : timeframe === "last90days" ? "Last 90 Days" : "Year to Date"}

## Executive Summary
Sales have shown a strong upward trend with a 23% increase compared to the previous period. The total revenue reached $426,589, exceeding the target by 12%.

## Key Insights
1. **Product Performance**: The Electronics category led sales with 34% of total revenue, followed by Home Goods (27%) and Apparel (22%).
2. **Customer Behavior**: Repeat customers accounted for 63% of sales, indicating strong customer loyalty.
3. **Regional Analysis**: The Western region showed the highest growth at 31%, while the Southern region underperformed targets by 8%.
4. **Marketing Effectiveness**: Email campaigns delivered the highest ROI at 342%, while social media advertising showed a 24% increase in conversion rates.

## Recommendations
- Increase inventory for top-selling electronics products to meet growing demand
- Develop targeted promotions for the Southern region to boost performance
- Expand email marketing efforts based on their high ROI
- Consider bundle offers for frequently co-purchased items to increase average order value`,

        detailed: `# Detailed Sales Performance Analysis: ${timeframe === "last30days" ? "Last 30 Days" : timeframe === "last90days" ? "Last 90 Days" : "Year to Date"}

## Revenue Analysis
Total Revenue: $426,589 (+23% YoY)
Average Order Value: $94.32 (+7.8% YoY)
Conversion Rate: 3.7% (+0.4% points)

## Product Category Performance
1. **Electronics**: $145,040 (34% of total)
   - Top product: Wireless Headphones ($28,740)
   - Highest growth: Smart Home Devices (+47%)
   - Opportunity: Bundle offers with accessories

2. **Home Goods**: $115,179 (27% of total)
   - Top product: Kitchen Appliances ($42,690)
   - Highest margin: Decorative Items (68% margin)
   - Challenge: Increasing shipping costs (+12%)

3. **Apparel**: $93,850 (22% of total)
   - Top product: Athletic Wear ($38,211)
   - Seasonal trend: 28% increase in summer collection
   - Challenge: High return rate (18%)

4. **Others**: $72,520 (17% of total)

## Customer Segment Analysis
- New Customers: 3,827 (37% of orders)
- Returning Customers: 6,549 (63% of orders)
- Average Customer Lifetime Value: $342 (+8.7%)
- Churn Rate: 5.2% (improved from 6.8%)

## Regional Performance
- Western: $148,745 (+31% YoY)
- Eastern: $121,214 (+18% YoY)
- Northern: $91,562 (+21% YoY)
- Southern: $65,068 (-8% YoY)

## Marketing Channel Effectiveness
- Email: $128,940 (342% ROI)
- Social Media: $98,115 (287% ROI)
- Search: $85,318 (264% ROI)
- Affiliate: $62,871 (186% ROI)
- Direct: $51,345 (N/A)

## Recommendations
1. Increase inventory for wireless headphones and smart home devices
2. Develop targeted marketing for the Southern region
3. Implement a loyalty program to further improve customer retention
4. Optimize return process for apparel to reduce costs
5. Allocate more budget to email campaigns based on ROI performance`,

        forecast: `# Sales Forecast and Trend Analysis: ${timeframe === "last30days" ? "Next 30 Days" : timeframe === "last90days" ? "Next Quarter" : "Next Year"}

## Revenue Forecast
Projected Total Revenue: $498,120 (projected +16.8% YoY)
Projected Average Order Value: $101.55 (projected +7.7%)
Projected Conversion Rate: 4.1% (projected +0.4% points)

## Market Trends and Opportunities
1. **Emerging Product Categories**
   - Sustainable products trending upward (+42% industry growth)
   - Health and wellness items showing strong momentum
   - Smart home integration products gaining market share

2. **Seasonal Projections**
   - Summer seasonal peak expected to increase by 24%
   - Back-to-school promotion opportunity identified
   - Holiday season projected to start earlier this year

3. **Competitive Landscape**
   - Market share stable at 23.4% (+1.2% YoY)
   - New competitor entry in electronics space
   - Price competition increasing in home goods category

## Customer Acquisition Forecast
- Projected New Customers: 4,350 (+13.7%)
- Customer Acquisition Cost: $22.40 (target to reduce by 5%)
- Projected Retention Rate: 68% (target to increase by 3%)

## Risk Factors and Mitigations
1. **Supply Chain Constraints**
   - Electronics components shortage likely to continue
   - Shipping costs expected to increase by 8-12%
   - Recommendation: Secure inventory for Q4 early

2. **Consumer Spending Patterns**
   - Discretionary spending showing sensitivity to economic indicators
   - Financing options becoming more important for higher-ticket items
   - Recommendation: Introduce flexible payment options

## Growth Opportunities
1. Expand into the sustainable products category
2. Develop bundle offerings for high-margin product combinations
3. Implement AI-powered product recommendations to increase cross-selling
4. Explore international shipping for key markets (Canada, UK, Australia)
5. Launch subscription service for consumable product categories`
      };

      setGeneratedReport(reportData[reportType as keyof typeof reportData]);
      setIsGenerating(false);
      
      toast({
        title: "Report Generated",
        description: `Your AI sales performance report is ready to view.`,
      });
    }, 2500);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time Period</label>
                  <Select 
                    value={timeframe} 
                    onValueChange={setTimeframe}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeframe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last30days">Last 30 Days</SelectItem>
                      <SelectItem value="last90days">Last 90 Days</SelectItem>
                      <SelectItem value="ytd">Year to Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Report Type</label>
                  <Select 
                    value={reportType} 
                    onValueChange={setReportType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select report type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Executive Summary</SelectItem>
                      <SelectItem value="detailed">Detailed Analysis</SelectItem>
                      <SelectItem value="forecast">Forecast & Trends</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Button 
              onClick={generateReport} 
              disabled={isGenerating || !apiKey}
              size="lg"
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart className="mr-2 h-4 w-4" />
                  Generate AI Report
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generatedReport && (
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">
              AI-Generated Sales Report
            </CardTitle>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              {generatedReport.split('\n\n').map((paragraph, i) => {
                if (paragraph.startsWith('# ')) {
                  return <h1 key={i} className="text-xl font-bold mt-0 mb-4">{paragraph.replace('# ', '')}</h1>;
                } else if (paragraph.startsWith('## ')) {
                  return <h2 key={i} className="text-lg font-bold mt-6 mb-3">{paragraph.replace('## ', '')}</h2>;
                } else if (paragraph.startsWith('- ')) {
                  return (
                    <ul key={i} className="list-disc pl-5 mb-4">
                      {paragraph.split('\n').map((item, j) => (
                        <li key={j} className="mb-1">{item.replace('- ', '')}</li>
                      ))}
                    </ul>
                  );
                } else if (paragraph.startsWith('1. ')) {
                  return (
                    <ol key={i} className="list-decimal pl-5 mb-4">
                      {paragraph.split('\n').map((item, j) => {
                        if (item.match(/^\d+\.\s/)) {
                          return <li key={j} className="mb-1">{item.replace(/^\d+\.\s/, '')}</li>;
                        } else if (item.startsWith('   - ')) {
                          return <li key={j} className="ml-4 list-disc">{item.replace('   - ', '')}</li>;
                        }
                        return null;
                      })}
                    </ol>
                  );
                } else {
                  return <p key={i} className="mb-4">{paragraph}</p>;
                }
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
