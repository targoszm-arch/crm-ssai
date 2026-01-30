
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { AuthGuard } from "./components/auth/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import CartAbandonment from "./pages/CartAbandonment";
import Campaigns from "./pages/Campaigns";
import Sequences from "./pages/Sequences";
import Finances from "./pages/Finances";
import AIRecommendations from "./pages/AIRecommendations";
import Payments from "./pages/Payments";
import Inbox from "./pages/Inbox";
import Calendar from "./pages/Calendar";
import Deals from "./pages/Deals";
import Auth from "./pages/Auth";
import OAuthCallback from "./pages/OAuthCallback";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          
          {/* Protected routes */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/customers"
            element={
              <AuthGuard>
                <AppShell>
                  <Customers />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/deals"
            element={
              <AuthGuard>
                <AppShell>
                  <Deals />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/orders"
            element={
              <AuthGuard>
                <AppShell>
                  <Orders />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/abandonment"
            element={
              <AuthGuard>
                <AppShell>
                  <CartAbandonment />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/campaigns"
            element={
              <AuthGuard>
                <AppShell>
                  <Campaigns />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/sequences"
            element={
              <AuthGuard>
                <AppShell>
                  <Sequences />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/finances"
            element={
              <AuthGuard>
                <AppShell>
                  <Finances />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/payments"
            element={
              <AuthGuard>
                <AppShell>
                  <Payments />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/ai-recommendations"
            element={
              <AuthGuard>
                <AppShell>
                  <AIRecommendations />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/inbox"
            element={
              <AuthGuard>
                <AppShell>
                  <Inbox />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/calendar"
            element={
              <AuthGuard>
                <AppShell>
                  <Calendar />
                </AppShell>
              </AuthGuard>
            }
          />
          <Route
            path="/analytics"
            element={
              <AuthGuard>
                <AppShell>
                  <Analytics />
                </AppShell>
              </AuthGuard>
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
