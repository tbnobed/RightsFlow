import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Contracts from "@/pages/contracts";
import Content from "@/pages/content";
import Availability from "@/pages/availability";
import Royalties from "@/pages/royalties";
import Reports from "@/pages/reports";
import Statements from "@/pages/statements";
import Notifications from "@/pages/notifications";
import Settings from "@/pages/settings";
import AcceptInvite from "@/pages/accept-invite";
import ResetPassword from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Check if this is the accept invite page
  if (location.startsWith("/accept-invite")) {
    return <AcceptInvite />;
  }

  // Check if this is the password reset page
  if (location.startsWith("/reset-password")) {
    return <ResetPassword />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/contracts" component={Contracts} />
            <Route path="/content" component={Content} />
            <Route path="/availability" component={Availability} />
            <Route path="/royalties" component={Royalties} />
            <Route path="/statements" component={Statements} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/reports" component={Reports} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
