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
    <div className="w-52 bg-[#004c4c] text-white flex flex-col text-sm">
      <div className="p-4 bg-black">
        <div className="flex flex-col items-center space-y-1">
          <img 
            src={promissioLogo} 
            alt="Promissio Logo" 
            className="h-16 w-auto"
            data-testid="img-sidebar-logo"
          />
          <p className="text-[10px] text-[#b2d8d8]">Rights & Royalties</p>
        </div>
      </div>
      
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <li key={item.name}>
                <Link 
                  href={item.href}
                  className={cn(
                    "flex items-center px-2 py-1.5 rounded-md transition-all text-white hover:bg-[#006666] text-sm",
                    isActive && "bg-[#006666] font-medium"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className="p-3 border-t border-[#003333]">
        <div className="flex items-center">
          <div className="w-7 h-7 rounded-full flex items-center justify-center font-medium mr-2 bg-[#006666] text-white text-xs">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div>
            <p className="text-xs font-medium text-white">
              {user ? `${user.firstName} ${user.lastName}` : 'Loading...'}
            </p>
            <p className="text-[10px] text-[#b2d8d8]">{user?.role || 'Role'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
