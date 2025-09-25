import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3, 
  File, 
  Calendar, 
  DollarSign, 
  ChartBar, 
  History,
  Users
} from "lucide-react";
import promissioLogo from "@assets/promissio_1758823299279.png";

const getNavigation = (isAdmin: boolean) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: BarChart3 },
    { name: "Contracts", href: "/contracts", icon: File },
    { name: "Rights Availability", href: "/availability", icon: Calendar },
    { name: "Royalties", href: "/royalties", icon: DollarSign },
    { name: "Reports", href: "/reports", icon: ChartBar },
    { name: "Audit Trail", href: "/audit", icon: History },
  ];

  if (isAdmin) {
    baseNavigation.push({ name: "Users", href: "/users", icon: Users });
  }

  return baseNavigation;
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const navigation = getNavigation(user?.role === "Admin" || false);

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex flex-col items-center space-y-2">
          <img 
            src={promissioLogo} 
            alt="Promissio Logo" 
            className="h-24 w-auto"
            data-testid="img-sidebar-logo"
          />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Rights & Royalties</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary text-foreground"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium mr-3">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
            </p>
            <p className="text-xs text-muted-foreground">{user?.role || 'Role'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
