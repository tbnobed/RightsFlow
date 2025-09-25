import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Bell, Settings, LogOut } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/contracts": "Contract Management",
  "/availability": "Rights Availability",
  "/royalties": "Royalty Management",
  "/reports": "Reports & Analytics",
  "/audit": "Audit Trail",
};

export default function Header() {
  const [location] = useLocation();
  
  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground" data-testid="page-title">
          {pageTitles[location] || "Rights & Royalties Management"}
        </h2>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" data-testid="button-notifications">
            <Bell className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
