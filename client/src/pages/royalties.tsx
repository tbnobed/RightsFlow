import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import RoyaltyCalculator from "@/components/royalties/royalty-calculator";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function Royalties() {
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

  const { data: royalties, isLoading: royaltiesLoading, refetch } = useQuery({
    queryKey: ["/api/royalties"],
  });

  const handleExport = async () => {
    try {
      const response = await fetch('/api/royalties/export/csv');
      if (!response.ok) throw new Error('Failed to export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'royalties.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Royalties exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export royalties",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800';
      case 'Approved': return 'bg-blue-100 text-blue-800';
      case 'Pending': return 'bg-amber-100 text-amber-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="royalties-view">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Royalty Management</h1>
          <p className="text-muted-foreground">Calculate and track royalty payments for active contracts</p>
        </div>
        <Button onClick={handleExport} variant="outline" data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <RoyaltyCalculator onCalculated={refetch} />

      {/* Royalty Summary */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-foreground">Royalty Summary</h3>
        </div>
        
        {royaltiesLoading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Contract</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Partner</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Period</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Revenue</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Royalty</th>
                  <th className="text-left py-3 text-sm font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(royalties) && royalties.map((royalty: any) => (
                  <tr key={royalty.id} className="border-b border-border hover:bg-muted/50 transition-all">
                    <td className="py-3 text-foreground font-medium" data-testid={`text-contract-${royalty.id}`}>
                      {royalty.contract.partner}
                    </td>
                    <td className="py-3 text-muted-foreground" data-testid={`text-partner-${royalty.id}`}>
                      {royalty.contract.licensee}
                    </td>
                    <td className="py-3 text-muted-foreground" data-testid={`text-period-${royalty.id}`}>
                      {royalty.reportingPeriod}
                    </td>
                    <td className="py-3 text-muted-foreground" data-testid={`text-revenue-${royalty.id}`}>
                      ${Number(royalty.revenue).toLocaleString()}
                    </td>
                    <td className="py-3 text-foreground font-medium" data-testid={`text-royalty-${royalty.id}`}>
                      ${Number(royalty.royaltyAmount).toLocaleString()}
                    </td>
                    <td className="py-3" data-testid={`status-${royalty.id}`}>
                      <Badge className={getStatusColor(royalty.status)}>
                        {royalty.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(!Array.isArray(royalties) || royalties.length === 0) && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No royalty calculations found. Create a new calculation to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
