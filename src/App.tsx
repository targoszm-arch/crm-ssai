
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { AuthGuard } from "./components/auth/AuthGuard";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import PersonDetail from "./pages/PersonDetail";
import CompanyDetail from "./pages/CompanyDetail";
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
import Growth from "./pages/Growth";
import Visitors from "./pages/Visitors";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// React Query's defaults are staleTime 0 + refetch on every mount and every window
// focus. In a CRM that means every navigation and every alt-tab re-pulls every list on
// the page from Postgres — the flood of requests that made the app feel like it was
// constantly syncing. Data here is not second-to-second critical: a short staleTime and
// no refetch-on-focus is both calmer and closer to how a mail client actually behaves.
// Anything that must be live says so itself (the emails query keeps its own realtime
// subscription, and mutations invalidate the keys they touch).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Every protected page gets the same shell, so a page can't quietly opt out of
 * the app's width, padding or header by forgetting to wrap itself.
 */
const PROTECTED_ROUTES: Array<{ path: string; element: ReactNode }> = [
  { path: "/", element: <Dashboard /> },
  { path: "/customers", element: <Customers /> },
  { path: "/people/:id", element: <PersonDetail /> },
  { path: "/companies/:id", element: <CompanyDetail /> },
  { path: "/deals", element: <Deals /> },
  { path: "/orders", element: <Orders /> },
  { path: "/abandonment", element: <CartAbandonment /> },
  { path: "/campaigns", element: <Campaigns /> },
  { path: "/sequences", element: <Sequences /> },
  { path: "/finances", element: <Finances /> },
  { path: "/payments", element: <Payments /> },
  { path: "/ai-recommendations", element: <AIRecommendations /> },
  { path: "/inbox", element: <Inbox /> },
  { path: "/calendar", element: <Calendar /> },
  { path: "/visitors", element: <Visitors /> },
  { path: "/analytics", element: <Analytics /> },
  { path: "/growth", element: <Growth /> },
  { path: "/settings", element: <Settings /> },
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />

          {/* Protected routes */}
          {PROTECTED_ROUTES.map(({ path, element }) => (
            <Route
              key={path}
              path={path}
              element={
                <AuthGuard>
                  <AppShell>{element}</AppShell>
                </AuthGuard>
              }
            />
          ))}

          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
        <Sonner />
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
