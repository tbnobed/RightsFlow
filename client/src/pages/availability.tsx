import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AvailabilityChecker from "@/components/availability/availability-checker";

export default function Availability() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  return (
    <div className="p-6 space-y-6" data-testid="availability-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Rights Availability Check</h1>
        <p className="text-muted-foreground">Check if intellectual property rights are available for licensing in specific territories and date ranges</p>
      </div>

      <AvailabilityChecker />
    </div>
  );
}
