import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Settings, LogOut } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "./notification-bell";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/contracts": "Contract Management",
  "/availability": "Rights Availability",
  "/royalties": "Royalty Management",
  "/statements": "Royalty Statements",
  "/reports": "Reports & Analytics",
  "/settings": "Settings",
  "/audit": "Audit Trail",
  "/users": "User Management",
};

export default function Header() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";
  
  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      
      if (response.ok) {
        // Clear the query cache to remove user data
        queryClient.clear();
        // Redirect to reload the page and show login form
        window.location.reload();
      } else {
        console.error("Logout failed");
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <header className="bg-[hsl(215,20%,18%)] border-b border-[hsl(215,20%,25%)] px-6 py-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-[hsl(215,15%,90%)]" data-testid="page-title">
          {pageTitles[location] || "Rights & Royalties Management"}
        </h2>
        <div className="flex items-center space-x-4">
          <NotificationBell />
          {isAdmin && (
            <Link href="/settings">
              <Button variant="ghost" size="icon" data-testid="button-settings" className="text-[hsl(215,15%,85%)] hover:text-[hsl(215,15%,95%)] hover:bg-[hsl(215,20%,25%)]">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout" className="text-[hsl(215,15%,85%)] hover:text-[hsl(215,15%,95%)] hover:bg-[hsl(215,20%,25%)]">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
