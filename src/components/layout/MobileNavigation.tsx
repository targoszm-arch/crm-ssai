
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Users, ShoppingCart, LineChart, Calendar, 
  CreditCard, Settings, Home, MessageSquare,
  GanttChartSquare, Wallet, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MobileNavigationProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  const location = useLocation();
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      handleClose();
    }
  }, [location.pathname]);

  if (!isOpen && !isClosing) return null;

  const navigationItems = [
    {
      icon: <Home size={18} />,
      label: "Dashboard",
      path: "/"
    },
    {
      icon: <Users size={18} />,
      label: "Customers",
      path: "/customers"
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
    <div 
      className={cn(
        "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity",
        isClosing ? "opacity-0" : "opacity-100"
      )}
    >
      <div 
        className={cn(
          "fixed inset-y-0 left-0 bg-sidebar w-3/4 transform transition-transform duration-300",
          isClosing ? "-translate-x-full" : "translate-x-0"
        )}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-4 justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary">
              <span className="text-white text-sm font-bold">CC</span>
            </div>
            <span className="text-sidebar-foreground">Clari CRM</span>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5 text-sidebar-foreground" />
          </Button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-3.5rem)] py-4">
          <nav className="px-3 space-y-1">
            {navigationItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  location.pathname === item.path 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <div className="w-5 h-5">{item.icon}</div>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
