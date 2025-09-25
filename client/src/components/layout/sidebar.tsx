import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  File, 
  Calendar, 
  DollarSign, 
  ChartBar, 
  History 
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Contracts", href: "/contracts", icon: File },
  { name: "Rights Availability", href: "/availability", icon: Calendar },
  { name: "Royalties", href: "/royalties", icon: DollarSign },
  { name: "Reports", href: "/reports", icon: ChartBar },
  { name: "Audit Trail", href: "/audit", icon: History },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">R&R Management</h1>
        <p className="text-sm text-muted-foreground">Rights & Royalties</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <a
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
                  </a>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-medium mr-3">
            U
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">User</p>
            <p className="text-xs text-muted-foreground">Role</p>
          </div>
        </div>
      </div>
    </div>
  );
}
