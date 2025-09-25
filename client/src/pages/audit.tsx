import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import AuditLog from "@/components/audit/audit-log";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

export default function Audit() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [filters, setFilters] = useState({
    action: "",
    userId: "",
    startDate: "",
    endDate: "",
  });

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
    <div className="p-6 space-y-6" data-testid="audit-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
        <p className="text-muted-foreground">Track all changes and activities within the system</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            value={filters.action}
            onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}
          >
            <SelectTrigger data-testid="select-action">
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Actions</SelectItem>
              <SelectItem value="Contract Created">Contract Created</SelectItem>
              <SelectItem value="Contract Updated">Contract Updated</SelectItem>
              <SelectItem value="Contract Deleted">Contract Deleted</SelectItem>
              <SelectItem value="Royalty Calculated">Royalty Calculated</SelectItem>
              <SelectItem value="Royalty Updated">Royalty Updated</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.userId}
            onValueChange={(value) => setFilters(prev => ({ ...prev, userId: value }))}
          >
            <SelectTrigger data-testid="select-user">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Users</SelectItem>
              {/* Users would be populated from API */}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            data-testid="input-start-date"
          />
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            data-testid="input-end-date"
          />
          <Button variant="secondary" data-testid="button-filter">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <AuditLog filters={filters} />
    </div>
  );
}
