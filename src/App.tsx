
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import CartAbandonment from "./pages/CartAbandonment";
import Campaigns from "./pages/Campaigns";
import Finances from "./pages/Finances";
import AIRecommendations from "./pages/AIRecommendations";
import Payments from "./pages/Payments";
import Inbox from "./pages/Inbox";
import Calendar from "./pages/Calendar";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          <Route
            path="/"
            element={
              <AppShell>
                <Dashboard />
              </AppShell>
            }
          />
          <Route
            path="/customers"
            element={
              <AppShell>
                <Customers />
              </AppShell>
            }
          />
          <Route
            path="/orders"
            element={
              <AppShell>
                <Orders />
              </AppShell>
            }
          />
          <Route
            path="/abandonment"
            element={
              <AppShell>
                <CartAbandonment />
              </AppShell>
            }
          />
          <Route
            path="/campaigns"
            element={
              <AppShell>
                <Campaigns />
              </AppShell>
            }
          />
          <Route
            path="/finances"
            element={
              <AppShell>
                <Finances />
              </AppShell>
            }
          />
          <Route
            path="/payments"
            element={
              <AppShell>
                <Payments />
              </AppShell>
            }
          />
          <Route
            path="/ai-recommendations"
            element={
              <AppShell>
                <AIRecommendations />
              </AppShell>
            }
          />
          <Route
            path="/inbox"
            element={
              <AppShell>
                <Inbox />
              </AppShell>
            }
          />
          <Route
            path="/calendar"
            element={
              <AppShell>
                <Calendar />
              </AppShell>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
