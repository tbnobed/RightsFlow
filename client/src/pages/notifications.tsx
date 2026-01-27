import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Calendar, FileText, Send, Loader2 } from "lucide-react";

export default function Notifications() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  const [expiringEmail, setExpiringEmail] = useState("");
  const [expiringName, setExpiringName] = useState("");
  const [expiringDays, setExpiringDays] = useState("30");
  
  const [revenueEmail, setRevenueEmail] = useState("");
  const [revenueName, setRevenueName] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
  }, [isAuthenticated, authLoading, toast]);

  useEffect(() => {
    if (user?.email) {
      setExpiringEmail(user.email);
      setRevenueEmail(user.email);
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
      setExpiringName(name);
      setRevenueName(name);
    }
  }, [user]);

  const expiringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/expiring-contracts", {
        recipientEmail: expiringEmail,
        recipientName: expiringName,
        daysThreshold: expiringDays,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Notification Sent",
        description: data.message || "Contract expiration notification sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  const revenueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/revenue-reports-due", {
        recipientEmail: revenueEmail,
        recipientName: revenueName,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Notification Sent",
        description: data.message || "Revenue report reminder sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send notification",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="p-6 space-y-6" data-testid="notifications-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Notifications</h1>
        <p className="text-muted-foreground">Send email alerts for contract expirations and revenue report reminders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-yellow-500" />
              Contract Expiration Alerts
            </CardTitle>
            <CardDescription>
              Send email notifications about contracts that are expiring soon
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="expiring-email">Recipient Email</Label>
              <Input
                id="expiring-email"
                type="email"
                value={expiringEmail}
                onChange={(e) => setExpiringEmail(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-expiring-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiring-name">Recipient Name</Label>
              <Input
                id="expiring-name"
                type="text"
                value={expiringName}
                onChange={(e) => setExpiringName(e.target.value)}
                placeholder="John Doe"
                data-testid="input-expiring-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiring-days">Expiration Threshold</Label>
              <Select value={expiringDays} onValueChange={setExpiringDays}>
                <SelectTrigger data-testid="select-expiring-days">
                  <SelectValue placeholder="Days before expiration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Within 7 Days</SelectItem>
                  <SelectItem value="14">Within 14 Days</SelectItem>
                  <SelectItem value="30">Within 30 Days</SelectItem>
                  <SelectItem value="60">Within 60 Days</SelectItem>
                  <SelectItem value="90">Within 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => expiringMutation.mutate()}
              disabled={expiringMutation.isPending || !expiringEmail}
              className="w-full"
              data-testid="button-send-expiring"
            >
              {expiringMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Expiration Alert
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Revenue Report Reminders
            </CardTitle>
            <CardDescription>
              Send reminders about upcoming revenue reports based on contract reporting frequency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="revenue-email">Recipient Email</Label>
              <Input
                id="revenue-email"
                type="email"
                value={revenueEmail}
                onChange={(e) => setRevenueEmail(e.target.value)}
                placeholder="email@example.com"
                data-testid="input-revenue-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="revenue-name">Recipient Name</Label>
              <Input
                id="revenue-name"
                type="text"
                value={revenueName}
                onChange={(e) => setRevenueName(e.target.value)}
                placeholder="John Doe"
                data-testid="input-revenue-name"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Report Types</Label>
              <p className="text-sm text-muted-foreground">
                Includes contracts with Monthly, Quarterly, and Annual reporting frequencies
              </p>
            </div>
            <Button
              onClick={() => revenueMutation.mutate()}
              disabled={revenueMutation.isPending || !revenueEmail}
              className="w-full"
              data-testid="button-send-revenue"
            >
              {revenueMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Report Reminder
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            About Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-medium mb-2">Contract Expiration Alerts</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Sends a summary of contracts expiring within your chosen timeframe</li>
                <li>Shows days remaining, partner name, and auto-renewal status</li>
                <li>Helps you proactively manage contract renewals</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Revenue Report Reminders</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Lists all active contracts with reporting requirements</li>
                <li>Shows reporting frequency (Monthly, Quarterly, Annually)</li>
                <li>Helps ensure timely collection of revenue reports from partners</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
