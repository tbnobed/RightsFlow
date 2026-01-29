import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Calendar, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { 
  startOfMonth, 
  endOfMonth, 
  endOfQuarter,
  endOfYear,
  eachDayOfInterval, 
  format, 
  isSameMonth, 
  isSameDay,
  addMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  getMonth,
  getYear,
  differenceInDays
} from "date-fns";
import type { Contract } from "@shared/schema";

type TimePeriod = "month" | "quarter" | "year";

interface ExpirationCalendarProps {
  contracts: Contract[];
  timePeriod?: TimePeriod;
}

type CalendarEvent = {
  type: "expiration" | "report";
  contract: Contract;
  label: string;
};

export default function ExpirationCalendar({ contracts, timePeriod = "month" }: ExpirationCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDay, setSelectedDay] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);
  

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getReportDueDates = useMemo(() => {
    const reportDates: Map<string, CalendarEvent[]> = new Map();
    
    const monthsInRange = new Set<string>();
    calendarDays.forEach(day => {
      monthsInRange.add(`${getYear(day)}-${getMonth(day)}`);
    });
    
    contracts.forEach((contract) => {
      if (!contract.reportingFrequency || contract.reportingFrequency === "None") return;
      if (contract.status === "Expired" || contract.status === "Terminated") return;
      
      const contractStart = typeof contract.startDate === 'string' 
        ? parseISO(contract.startDate) 
        : new Date(contract.startDate);
      
      // For auto-renewing contracts, use far future date for report checks
      const contractEnd = contract.autoRenew || !contract.endDate
        ? new Date(2099, 11, 31) 
        : typeof contract.endDate === 'string' 
          ? parseISO(contract.endDate) 
          : new Date(contract.endDate);
      
      monthsInRange.forEach(monthKey => {
        const [yearStr, monthStr] = monthKey.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const monthDate = new Date(year, month, 1);
        const monthEndDate = endOfMonth(monthDate);
        
        if (contract.reportingFrequency === "Monthly") {
          if (monthEndDate >= contractStart && monthEndDate <= contractEnd) {
            const dateKey = format(monthEndDate, "yyyy-MM-dd");
            const events = reportDates.get(dateKey) || [];
            events.push({
              type: "report",
              contract,
              label: `${contract.partner} (Monthly)`
            });
            reportDates.set(dateKey, events);
          }
        } else if (contract.reportingFrequency === "Quarterly") {
          const quarterEndMonths = [2, 5, 8, 11];
          if (quarterEndMonths.includes(month)) {
            if (monthEndDate >= contractStart && monthEndDate <= contractEnd) {
              const quarterNum = Math.floor(month / 3) + 1;
              const dateKey = format(monthEndDate, "yyyy-MM-dd");
              const events = reportDates.get(dateKey) || [];
              events.push({
                type: "report",
                contract,
                label: `${contract.partner} (Q${quarterNum})`
              });
              reportDates.set(dateKey, events);
            }
          }
        } else if (contract.reportingFrequency === "Annually") {
          if (month === 11) {
            const yearEndDate = new Date(year, 11, 31);
            if (yearEndDate >= contractStart && yearEndDate <= contractEnd) {
              const dateKey = format(yearEndDate, "yyyy-MM-dd");
              const events = reportDates.get(dateKey) || [];
              events.push({
                type: "report",
                contract,
                label: `${contract.partner} (Annual)`
              });
              reportDates.set(dateKey, events);
            }
          }
        }
      });
    });
    
    return reportDates;
  }, [contracts, calendarDays]);

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    contracts.forEach((contract) => {
      if (!contract.endDate) return;
      const endDate = typeof contract.endDate === 'string' 
        ? parseISO(contract.endDate) 
        : new Date(contract.endDate);
      if (isSameDay(endDate, day)) {
        events.push({
          type: "expiration",
          contract,
          label: contract.partner
        });
      }
    });
    
    const dateKey = format(day, "yyyy-MM-dd");
    const reportEvents = getReportDueDates.get(dateKey) || [];
    events.push(...reportEvents);
    
    return events;
  };

  const getDayClasses = (day: Date, events: CalendarEvent[]) => {
    const hasExpiration = events.some(e => e.type === "expiration");
    const hasReport = events.some(e => e.type === "report");
    
    if (!hasExpiration && !hasReport) return "";
    
    if (hasExpiration) {
      const daysUntilExpiry = Math.floor((day.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) return "bg-red-500/20 border-red-500";
      if (daysUntilExpiry <= 30) return "bg-orange-500/20 border-orange-500";
      if (daysUntilExpiry <= 60) return "bg-yellow-500/20 border-yellow-500";
      return "bg-blue-500/20 border-blue-500";
    }
    
    if (hasReport) {
      return "bg-purple-500/20 border-purple-500";
    }
    
    return "";
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(addMonths(currentMonth, -1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(today);
  };

  const getPeriodEndDate = () => {
    switch (timePeriod) {
      case "month": return endOfMonth(today);
      case "quarter": return endOfQuarter(today);
      case "year": return endOfYear(today);
      default: return endOfMonth(today);
    }
  };

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case "month": return "This Month";
      case "quarter": return "This Quarter";
      case "year": return "This Year";
      default: return "This Month";
    }
  };

  const expiringContracts = useMemo(() => {
    const periodEnd = getPeriodEndDate();
    return contracts
      .filter((contract) => {
        if (!contract.endDate || contract.autoRenew) return false;
        if (contract.status === "Expired" || contract.status === "Terminated") return false;
        const endDate = typeof contract.endDate === 'string' 
          ? parseISO(contract.endDate) 
          : new Date(contract.endDate);
        return endDate >= today && endDate <= periodEnd;
      })
      .sort((a, b) => {
        const dateA = typeof a.endDate === 'string' ? parseISO(a.endDate) : new Date(a.endDate!);
        const dateB = typeof b.endDate === 'string' ? parseISO(b.endDate) : new Date(b.endDate!);
        return dateA.getTime() - dateB.getTime();
      });
  }, [contracts, timePeriod]);

  const getUrgencyBadge = (endDate: Date) => {
    const daysLeft = differenceInDays(endDate, today);
    if (daysLeft <= 7) return <Badge className="bg-red-500 text-white">Expires in {daysLeft} days</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-orange-500 text-white">Expires in {daysLeft} days</Badge>;
    if (daysLeft <= 60) return <Badge className="bg-yellow-500 text-black">Expires in {daysLeft} days</Badge>;
    return <Badge className="bg-blue-500 text-white">Expires in {daysLeft} days</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border" data-testid="calendar-expiration">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Contract Calendar</CardTitle>
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

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const events = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, today);
            const dayClasses = getDayClasses(day, events);

            return (
              <div
                key={index}
                className={`
                  relative min-h-[60px] p-2 border rounded-md text-sm
                  ${isCurrentMonth ? "bg-background" : "bg-muted/30"}
                  ${isToday ? "border-primary border-2" : "border-border"}
                  ${dayClasses}
                  transition-colors hover:bg-accent/50
                `}
                data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
              >
                <div className={`text-xs mb-1 ${isCurrentMonth ? "text-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </div>
                {events.length > 0 && (
                  <div className="space-y-1">
                    {events.slice(0, 2).map((event, idx) => (
                      <Link
                        key={`${event.contract.id}-${event.type}-${idx}`}
                        href={event.type === "expiration" 
                          ? `/contracts?view=${event.contract.id}`
                          : `/royalties?partner=${encodeURIComponent(event.contract.partner)}`
                        }
                      >
                        <div
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate flex items-center gap-1 cursor-pointer hover:opacity-80 ${
                            event.type === "expiration" 
                              ? "bg-primary/10" 
                              : "bg-purple-500/20"
                          }`}
                          title={`${event.type === "expiration" ? "Expires: " : "Report Due: "}${event.label} - Click to view`}
                          data-testid={`event-${event.type}-${event.contract.id}`}
                        >
                          {event.type === "expiration" ? (
                            <Calendar className="h-2 w-2 flex-shrink-0" />
                          ) : (
                            <FileText className="h-2 w-2 flex-shrink-0" />
                          )}
                          <span className="truncate">{event.label}</span>
                        </div>
                      </Link>
                    ))}
                    {events.length > 2 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay({ date: day, events });
                        }}
                        className="text-[10px] text-primary hover:text-primary/80 px-1 cursor-pointer hover:underline font-medium"
                        data-testid={`button-more-events-${format(day, "yyyy-MM-dd")}`}
                      >
                        +{events.length - 2} more
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded border border-red-500 bg-red-500/20"></div>
            <span>Expired</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded border border-orange-500 bg-orange-500/20"></div>
            <span>≤30d</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded border border-yellow-500 bg-yellow-500/20"></div>
            <span>≤60d</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded border border-blue-500 bg-blue-500/20"></div>
            <span>&gt;60d</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded border border-purple-500 bg-purple-500/20"></div>
            <span>Report Due</span>
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
            View All Contracts
          </Button>
        </Link>
      </CardFooter>
    </Card>

      <Card className="bg-card border-border" data-testid="expiring-contracts-cards">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Expiring Contracts - {getPeriodLabel()}
            </CardTitle>
            <Badge variant="outline">{expiringContracts.length} contract{expiringContracts.length !== 1 ? 's' : ''}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {expiringContracts.length > 0 ? (
            <div className="max-h-[280px] overflow-y-auto">
              <div className="divide-y divide-border">
                {expiringContracts.map((contract) => {
                  const endDate = typeof contract.endDate === 'string' 
                    ? parseISO(contract.endDate) 
                    : new Date(contract.endDate!);
                  return (
                    <div 
                      key={contract.id} 
                      className="px-4 py-3 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3"
                      data-testid={`expiring-contract-card-${contract.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-foreground truncate">{contract.partner}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground truncate">{contract.licensee}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{contract.territory}</span>
                          <span>•</span>
                          <span className="whitespace-nowrap">{format(endDate, "MMM d, yyyy")}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {getUrgencyBadge(endDate)}
                        <Link href={`/contracts?edit=${contract.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-6">
              No contracts expiring {getPeriodLabel().toLowerCase()}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedDay} onOpenChange={() => setSelectedDay(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Events for {selectedDay && format(selectedDay.date, "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-2">
              <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary/20 border border-primary"></div>
                  Expirations: {selectedDay.events.filter(e => e.type === "expiration").length}
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500"></div>
                  Reports: {selectedDay.events.filter(e => e.type === "report").length}
                </span>
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {selectedDay.events.map((event, idx) => (
                  <Link
                    key={`${event.contract.id}-${event.type}-${idx}`}
                    href={event.type === "expiration" 
                      ? `/contracts?view=${event.contract.id}`
                      : `/royalties?partner=${encodeURIComponent(event.contract.partner)}`
                    }
                    onClick={() => setSelectedDay(null)}
                  >
                    <div
                      className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                        event.type === "expiration" 
                          ? "border-primary/30 bg-primary/5" 
                          : "border-purple-500/30 bg-purple-500/5"
                      }`}
                      data-testid={`dialog-event-${event.type}-${event.contract.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {event.type === "expiration" ? (
                          <Calendar className="h-4 w-4 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 text-purple-500" />
                        )}
                        <span className="font-medium text-sm">{event.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {event.type === "expiration" ? "Expiration" : "Report Due"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground ml-6">
                        <span>{event.contract.licensee}</span>
                        <span className="mx-2">•</span>
                        <span>{event.contract.territory}</span>
                        {event.contract.platform && (
                          <>
                            <span className="mx-2">•</span>
                            <span>{event.contract.platform}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
