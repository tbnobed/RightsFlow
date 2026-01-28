import { Card, CardContent } from "@/components/ui/card";
import { FileText, CalendarClock, TrendingUp, ClipboardCheck } from "lucide-react";
import { Link } from "wouter";

interface StatsCardsProps {
  stats?: {
    activeContracts: number;
    expiringSoon: number;
    totalRoyalties: string;
    pendingReviews: number;
  };
  periodLabel?: string;
}

export default function StatsCards({ stats, periodLabel }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Active Contracts",
      value: stats.activeContracts,
      icon: FileText,
      testId: "stat-active-contracts",
      href: "/contracts?filter=active",
    },
    {
      title: "Expiring Soon (60 days)",
      value: stats.expiringSoon,
      icon: CalendarClock,
      testId: "stat-expiring-soon",
      href: "/contracts?filter=expiring",
    },
    {
      title: `Royalties${periodLabel ? ` (${periodLabel})` : ""}`,
      value: `$${Number(stats.totalRoyalties).toLocaleString()}`,
      icon: TrendingUp,
      testId: "stat-total-royalties",
      href: "/royalties",
    },
    {
      title: "Pending Reviews",
      value: stats.pendingReviews,
      icon: ClipboardCheck,
      testId: "stat-pending-reviews",
      href: "/royalties?filter=pending",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <Link key={card.title} href={card.href}>
          <Card className="cursor-pointer hover:bg-accent/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">{card.title}</p>
                  <p 
                    className="text-2xl font-semibold text-foreground" 
                    data-testid={card.testId}
                  >
                    {card.value}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: '#66b2b2' }}>
                  <card.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
