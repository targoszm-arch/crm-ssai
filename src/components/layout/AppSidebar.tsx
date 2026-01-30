import { Link, useLocation } from "react-router-dom";
import { 
  Users, ShoppingCart, LineChart, Calendar, 
  CreditCard, Settings, Home, MessageSquare,
  GanttChartSquare, Wallet, Mail, Workflow, DollarSign
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const mainNavItems = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Mail, label: "Inbox", path: "/inbox" },
  { icon: Users, label: "Customers", path: "/customers" },
  { icon: DollarSign, label: "Deals", path: "/deals" },
  { icon: ShoppingCart, label: "Orders", path: "/orders" },
  { icon: MessageSquare, label: "Campaigns", path: "/campaigns" },
  { icon: Workflow, label: "Sequences", path: "/sequences" },
  { icon: GanttChartSquare, label: "Abandonment", path: "/abandonment" },
  { icon: Wallet, label: "Finances", path: "/finances" },
  { icon: LineChart, label: "Analytics", path: "/analytics" },
];

const settingsNavItems = [
  { icon: CreditCard, label: "Payments", path: "/payments" },
  { icon: Calendar, label: "Calendar", path: "/calendar" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border h-14 flex items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary shrink-0">
            <span className="text-primary-foreground text-sm font-bold">CC</span>
          </div>
          <span className="text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Clari CRM
          </span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.path}
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.path}
                    tooltip={item.label}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarRail />
    </Sidebar>
  );
}
