import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

interface AuditLogProps {
  filters: {
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default function AuditLog({ filters }: AuditLogProps) {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["/api/audit", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await fetch(`/api/audit?${params}`);
      if (!response.ok) throw new Error('Failed to fetch audit logs');
      return response.json();
    },
  });

  const getInitials = (user: any) => {
    if (!user) return "?";
    const firstName = user.firstName || "";
    const lastName = user.lastName || "";
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || user.email?.charAt(0).toUpperCase() || "?";
  };

  const getActionColor = (action: string) => {
    if (action.includes("Created")) return "bg-green-600";
    if (action.includes("Updated")) return "bg-blue-600";
    if (action.includes("Deleted")) return "bg-red-600";
    return "bg-gray-600";
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-muted rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border">
          {auditLogs?.map((log: any) => (
            <div 
              key={log.id} 
              className="p-6 hover:bg-muted/30 transition-all"
              data-testid={`audit-log-${log.id}`}
            >
              <div className="flex items-start space-x-4">
                <div className={`w-10 h-10 ${getActionColor(log.action)} rounded-full flex items-center justify-center text-white font-medium`}>
                  {getInitials(log.user)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-foreground" data-testid={`audit-action-${log.id}`}>
                      {log.action}
                    </h4>
                    <span className="text-sm text-muted-foreground" data-testid={`audit-time-${log.id}`}>
                      {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1" data-testid={`audit-details-${log.id}`}>
                    {log.user ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email : 'System'} 
                    {log.entityType && ` performed action on ${log.entityType}`}
                    {log.entityId && ` (ID: ${log.entityId.slice(0, 8)}...)`}
                  </p>
                  <div className="flex items-center space-x-4 mt-2 text-sm">
                    {log.ipAddress && (
                      <span className="text-muted-foreground" data-testid={`audit-ip-${log.id}`}>
                        IP: {log.ipAddress}
                      </span>
                    )}
                    <span className="text-primary cursor-pointer hover:underline">
                      View Details
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!auditLogs || auditLogs.length === 0) && (
            <div className="py-8 text-center text-muted-foreground">
              No audit logs found for the selected criteria.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
