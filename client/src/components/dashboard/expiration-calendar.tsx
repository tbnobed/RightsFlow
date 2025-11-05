import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay,
  addMonths,
  startOfWeek,
  endOfWeek,
  parseISO
} from "date-fns";
import type { Contract } from "@shared/schema";

interface ExpirationCalendarProps {
  contracts: Contract[];
}

export default function ExpirationCalendar({ contracts }: ExpirationCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getContractsForDay = (day: Date) => {
    return contracts.filter((contract) => {
      if (!contract.endDate) return false;
      const endDate = typeof contract.endDate === 'string' 
        ? parseISO(contract.endDate) 
        : new Date(contract.endDate);
      return isSameDay(endDate, day);
    });
  };

  const getUrgencyClass = (day: Date) => {
    const dayContracts = getContractsForDay(day);
    if (dayContracts.length === 0) return "";
    
    const today = new Date();
    const daysUntilExpiry = Math.floor((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return "bg-red-500/20 border-red-500";
    if (daysUntilExpiry <= 7) return "bg-orange-500/20 border-orange-500";
    if (daysUntilExpiry <= 30) return "bg-yellow-500/20 border-yellow-500";
    return "bg-blue-500/20 border-blue-500";
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <Card className="bg-card border-border" data-testid="calendar-expiration">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Contract Expirations</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              data-testid="button-calendar-today"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToPreviousMonth}
              data-testid="button-calendar-prev"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center" data-testid="text-calendar-month">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={goToNextMonth}
              data-testid="button-calendar-next"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayContracts = getContractsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const urgencyClass = getUrgencyClass(day);

            return (
              <div
                key={index}
                className={`
                  relative min-h-[60px] p-2 border rounded-md text-sm
                  ${isCurrentMonth ? "bg-background" : "bg-muted/30"}
                  ${isToday ? "border-primary" : "border-border"}
                  ${urgencyClass}
                  transition-colors hover:bg-accent/50
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className={`text-xs mb-1 ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                {dayContracts.length > 0 && (
                  <div className="space-y-1">
                    {dayContracts.slice(0, 2).map((contract) => (
                      <div
                        key={contract.id}
                        className="text-[10px] leading-tight px-1 py-0.5 bg-primary/10 rounded truncate"
                        title={contract.partner}
                        data-testid={`contract-indicator-${contract.id}`}
                      >
                        {contract.partner}
                      </div>
                    ))}
                    {dayContracts.length > 2 && (
                      <div className="text-[10px] text-muted-foreground px-1">
                        +{dayContracts.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-xs font-medium text-muted-foreground mb-2">Legend:</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border border-red-500 bg-red-500/20"></div>
              <span className="text-muted-foreground">Expired</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border border-orange-500 bg-orange-500/20"></div>
              <span className="text-muted-foreground">≤ 7 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border border-yellow-500 bg-yellow-500/20"></div>
              <span className="text-muted-foreground">≤ 30 days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border border-blue-500 bg-blue-500/20"></div>
              <span className="text-muted-foreground">&gt; 30 days</span>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border p-4">
        <Link href="/contracts" className="w-full">
          <Button 
            variant="outline" 
            className="w-full" 
            data-testid="button-view-all-contracts"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View All Expiring Contracts
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
