import { Card, CardContent } from "@/components/ui/card";
import { File, AlertTriangle, DollarSign, Clock } from "lucide-react";
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
      icon: File,
      color: "text-primary",
      bgColor: "bg-primary/10",
      testId: "stat-active-contracts",
      href: "/contracts?filter=active",
    },
    {
      title: "Expiring Soon (60 days)",
      value: stats.expiringSoon,
      icon: AlertTriangle,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      testId: "stat-expiring-soon",
      href: "/contracts?filter=expiring",
    },
    {
      title: `Royalties${periodLabel ? ` (${periodLabel})` : ""}`,
      value: `$${Number(stats.totalRoyalties).toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bgColor: "bg-green-100",
      testId: "stat-total-royalties",
      href: "/royalties",
    },
    {
      title: "Pending Reviews",
      value: stats.pendingReviews,
      icon: Clock,
      color: "text-red-600",
      bgColor: "bg-red-100",
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
                <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <card.icon className={`h-6 w-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
