import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  BarChart3, 
  File, 
  Calendar, 
  DollarSign, 
  FileText,
  ChartBar,
  Library,
  ClipboardList
} from "lucide-react";
import promissioLogo from "@assets/promissio_1758823299279.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Contracts", href: "/contracts", icon: File },
  { name: "Content", href: "/content", icon: Library },
  { name: "Rights Availability", href: "/availability", icon: Calendar },
  { name: "Royalties", href: "/royalties", icon: DollarSign },
  { name: "Statements", href: "/statements", icon: FileText },
  { name: "Reports", href: "/reports", icon: ChartBar },
];

const adminNavigation = [
  { name: "Audit Trail", href: "/audit", icon: ClipboardList, roles: ["Admin", "Sales Manager"] },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="w-64 sidebar flex flex-col">
      <div className="p-6 bg-[hsl(215,20%,40%)]">
        <div className="flex flex-col items-center space-y-2">
          <img 
            src={promissioLogo} 
            alt="Promissio Logo" 
            className="h-24 w-auto"
            data-testid="img-sidebar-logo"
          />
          <div className="text-center">
            <p className="text-xs sidebar-muted">Rights & Royalties</p>
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
                    "flex items-center px-3 py-2 rounded-md transition-all sidebar-link",
                    isActive && "sidebar-link-active"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-4 w-4 mr-3" />
                  {item.name}
                </Link>
              </li>
            );
          })}
          {adminNavigation
            .filter(item => user?.role && item.roles.includes(user.role))
            .map((item) => {
              const isActive = location === item.href;
              return (
                <li key={item.name}>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center px-3 py-2 rounded-md transition-all sidebar-link",
                      isActive && "sidebar-link-active"
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
      
      <div className="p-4">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-medium mr-3 sidebar-link-active">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium">
              {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
            </p>
            <p className="text-xs sidebar-muted">{user?.role || 'Role'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
