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
  Library
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

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="w-64 bg-[#006666] text-white flex flex-col">
      <div className="p-6 bg-[#004c4c]">
        <div className="flex flex-col items-center space-y-2">
          <img 
            src={promissioLogo} 
            alt="Promissio Logo" 
            className="h-24 w-auto"
            data-testid="img-sidebar-logo"
          />
          <div className="text-center">
            <p className="text-xs text-[#b2d8d8]">Rights & Royalties</p>
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
                    "flex items-center px-3 py-2 rounded-md transition-all text-white hover:bg-[#008080]",
                    isActive && "bg-[#008080] font-medium"
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
      
      <div className="p-4 border-t border-[#004c4c]">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-medium mr-3 bg-[#008080] text-white">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div>
            <p className="text-sm font-medium text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
            </p>
            <p className="text-xs text-[#b2d8d8]">{user?.role || 'Role'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
