import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, FileWarning, FilePlus, Clock } from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { Link } from "wouter";

type Contract = {
  id: string;
  partner: string;
  content: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
};

type Notification = {
  id: string;
  type: "expired" | "expiring" | "new";
  title: string;
  description: string;
  date: Date;
  contractId?: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const getNotifications = (): Notification[] => {
    const notifications: Notification[] = [];
    const today = new Date();
    const thirtyDaysAgo = addDays(today, -30);
    const thirtyDaysFromNow = addDays(today, 30);

    contracts.forEach((contract) => {
      if (contract.status === "Expired") {
        const endDate = contract.endDate ? new Date(contract.endDate) : null;
        if (endDate && endDate >= thirtyDaysAgo) {
          notifications.push({
            id: `expired-${contract.id}`,
            type: "expired",
            title: "Contract Expired",
            description: `${contract.partner}${contract.content ? ` - ${contract.content}` : ""}`,
            date: endDate,
            contractId: contract.id,
          });
        }
      }

      if (contract.status === "Active" && contract.endDate) {
        const endDate = new Date(contract.endDate);
        const daysRemaining = differenceInDays(endDate, today);
        if (daysRemaining >= 0 && daysRemaining <= 30) {
          notifications.push({
            id: `expiring-${contract.id}`,
            type: "expiring",
            title: `Expiring in ${daysRemaining} days`,
            description: `${contract.partner}${contract.content ? ` - ${contract.content}` : ""}`,
            date: endDate,
            contractId: contract.id,
          });
        }
      }

      const createdAt = new Date(contract.createdAt);
      if (createdAt >= thirtyDaysAgo) {
        notifications.push({
          id: `new-${contract.id}`,
          type: "new",
          title: "New Contract",
          description: `${contract.partner}${contract.content ? ` - ${contract.content}` : ""}`,
          date: createdAt,
          contractId: contract.id,
        });
      }
    });

    return notifications.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);
  };

  const notifications = getNotifications();
  const hasNotifications = notifications.length > 0;

  const getIcon = (type: string) => {
    switch (type) {
      case "expired":
        return <FileWarning className="h-4 w-4 text-red-500" />;
      case "expiring":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "new":
        return <FilePlus className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-[hsl(215,15%,85%)] hover:text-[hsl(215,15%,95%)] hover:bg-[hsl(215,20%,25%)]"
          data-testid="button-notifications"
        >
          <Bell className="h-4 w-4" />
          {hasNotifications && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No recent notifications
            </div>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.id}
                href="/contracts"
                onClick={() => setOpen(false)}
              >
                <div
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                  data-testid={`notification-${notification.id}`}
                >
                  <div className="mt-0.5">{getIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {notification.description}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(notification.date, "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
        {hasNotifications && (
          <div className="p-2 border-t">
            <Link href="/contracts" onClick={() => setOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full">
                View All Contracts
              </Button>
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
