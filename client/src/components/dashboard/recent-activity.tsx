import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Contract } from "@shared/schema";

interface RecentActivityProps {
  contracts: Contract[];
}

export default function RecentActivity({ contracts }: RecentActivityProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Expired': return 'bg-red-100 text-red-800';
      case 'In Perpetuity': return 'bg-blue-100 text-blue-800';
      case 'Terminated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link href="/contracts">
            <Button variant="outline" className="w-full justify-start hover:bg-accent hover:text-accent-foreground" data-testid="quick-action-add-contract">
              Add New Contract
            </Button>
          </Link>
          <Link href="/availability">
            <Button variant="outline" className="w-full justify-start hover:bg-accent hover:text-accent-foreground" data-testid="quick-action-check-availability">
              Check Rights Availability
            </Button>
          </Link>
          <Link href="/royalties">
            <Button variant="outline" className="w-full justify-start hover:bg-accent hover:text-accent-foreground" data-testid="quick-action-calculate-royalties">
              Calculate Royalties
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Recent Contracts */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Recent Contracts</CardTitle>
            <Link href="/contracts">
              <Button variant="link" className="p-0" data-testid="view-all-contracts">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {contracts.length > 0 ? (
            <div className="space-y-4">
              {contracts.map((contract) => (
                <div key={contract.id} className="flex items-center justify-between p-3 bg-muted rounded-md" data-testid={`recent-contract-${contract.id}`}>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{contract.partner}</p>
                    <p className="text-sm text-muted-foreground">{contract.licensee} • {contract.territory}</p>
                  </div>
                  <Badge className={getStatusColor(contract.status || "Active")}>
                    {contract.status || "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No recent contracts found
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
