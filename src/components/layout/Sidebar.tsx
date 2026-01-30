
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Users, ShoppingCart, LineChart, Calendar, 
  CreditCard, Settings, Home, MessageSquare,
  GanttChartSquare, Wallet, Mail, Workflow, DollarSign
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  path: string;
  active?: boolean;
}

const SidebarItem = ({ icon, label, path, active }: SidebarItemProps) => {
  return (
    <Link
      to={path}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active 
          ? "bg-sidebar-accent text-sidebar-accent-foreground" 
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <div className="w-5 h-5">{icon}</div>
      <span>{label}</span>
    </Link>
  );
};

export default function Sidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  const mainNavItems = [
    {
      icon: <Home size={18} />,
      label: "Dashboard",
      path: "/"
    },
    {
      icon: <Mail size={18} />,
      label: "Inbox",
      path: "/inbox"
    },
    {
      icon: <Users size={18} />,
      label: "Customers",
      path: "/customers"
    },
    {
      icon: <DollarSign size={18} />,
      label: "Deals",
      path: "/deals"
    },
    {
      icon: <ShoppingCart size={18} />,
      label: "Orders",
      path: "/orders"
    },
    {
      icon: <MessageSquare size={18} />,
      label: "Campaigns",
      path: "/campaigns"
    },
    {
      icon: <Workflow size={18} />,
      label: "Sequences",
      path: "/sequences"
    },
    {
      icon: <GanttChartSquare size={18} />,
      label: "Abandonment",
      path: "/abandonment"
    },
    {
      icon: <Wallet size={18} />,
      label: "Finances",
      path: "/finances"
    },
    {
      icon: <LineChart size={18} />,
      label: "Analytics",
      path: "/analytics"
    },
  ];

  const otherNavItems = [
    {
      icon: <CreditCard size={18} />,
      label: "Payments",
      path: "/payments"
    },
    {
      icon: <Calendar size={18} />,
      label: "Calendar",
      path: "/calendar"
    },
    {
      icon: <Settings size={18} />,
      label: "Settings",
      path: "/settings"
    }
  ];

  return (
    <aside className="bg-sidebar flex w-64 shrink-0 flex-col border-r border-sidebar-border">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary">
            <span className="text-white text-sm font-bold">CC</span>
          </div>
          <span className="text-sidebar-foreground">Clari CRM</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4 px-3">
        <nav className="flex flex-col gap-1">
          {mainNavItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              active={currentPath === item.path}
            />
          ))}
          
          <div className="mt-6 mb-2 px-3">
            <p className="text-xs font-medium text-sidebar-foreground/50">
              Settings
            </p>
          </div>
          
          {otherNavItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              active={currentPath === item.path}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
