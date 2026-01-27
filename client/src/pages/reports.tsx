import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, FileSpreadsheet, FileText, Download, Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";

type Contract = {
  id: string;
  partner: string;
  content: string;
  territories: string[];
  platforms: string[];
  status: string;
  startDate: string;
  endDate: string | null;
  royaltyType: string;
  royaltyPercentage: string | null;
  flatFeeAmount: string | null;
  paymentTerms: string | null;
  autoRenewal: boolean;
};

type Royalty = {
  id: string;
  contractId: string;
  period: string;
  revenue: string;
  royaltyAmount: string;
  status: string;
  contract?: Contract;
};

export default function Reports() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [reportType, setReportType] = useState("contract-summary");
  const [expiringDays, setExpiringDays] = useState("30");

  const { data: contracts = [], isLoading: contractsLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: royalties = [], isLoading: royaltiesLoading } = useQuery<Royalty[]>({
    queryKey: ["/api/royalties"],
  });

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

  const getExpiringContracts = () => {
    const days = parseInt(expiringDays);
    const today = new Date();
    const futureDate = addDays(today, days);
    
    return contracts.filter(contract => {
      if (!contract.endDate || contract.status === "Terminated" || contract.status === "In Perpetuity") {
        return false;
      }
      const endDate = new Date(contract.endDate);
      return endDate >= today && endDate <= futureDate;
    }).sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime());
  };

  const getContractSummary = () => {
    const summary = {
      total: contracts.length,
      active: contracts.filter(c => c.status === "Active").length,
      expired: contracts.filter(c => c.status === "Expired").length,
      inPerpetuity: contracts.filter(c => c.status === "In Perpetuity").length,
      terminated: contracts.filter(c => c.status === "Terminated").length,
      autoRenewal: contracts.filter(c => c.autoRenewal).length,
      byPlatform: {} as Record<string, number>,
      byTerritory: {} as Record<string, number>,
    };

    contracts.forEach(contract => {
      contract.platforms?.forEach(platform => {
        summary.byPlatform[platform] = (summary.byPlatform[platform] || 0) + 1;
      });
      contract.territories?.forEach(territory => {
        summary.byTerritory[territory] = (summary.byTerritory[territory] || 0) + 1;
      });
    });

    return summary;
  };

  const getRoyaltySummary = () => {
    const totalRevenue = royalties.reduce((sum, r) => sum + parseFloat(r.revenue || "0"), 0);
    const totalRoyalties = royalties.reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);
    const paidRoyalties = royalties.filter(r => r.status === "Paid").reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);
    const pendingRoyalties = royalties.filter(r => r.status === "Pending").reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);

    return { totalRevenue, totalRoyalties, paidRoyalties, pendingRoyalties, count: royalties.length };
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const handleExportCSV = () => {
    let csvContent = "";
    let filename = "";

    if (reportType === "contract-summary") {
      csvContent = "Partner,Content,Status,Platforms,Territories,Start Date,End Date,Royalty Type,Auto Renewal\n";
      contracts.forEach(c => {
        csvContent += `"${c.partner}","${c.content}","${c.status}","${c.platforms?.join('; ')}","${c.territories?.join('; ')}","${c.startDate}","${c.endDate || 'N/A'}","${c.royaltyType}","${c.autoRenewal}"\n`;
      });
      filename = "contract-summary.csv";
    } else if (reportType === "royalty-statements") {
      csvContent = "Period,Partner,Revenue,Royalty Amount,Status\n";
      royalties.forEach(r => {
        csvContent += `"${r.period}","${r.contract?.partner || 'N/A'}","${r.revenue}","${r.royaltyAmount}","${r.status}"\n`;
      });
      filename = "royalty-statements.csv";
    } else if (reportType === "expiring-contracts") {
      csvContent = "Partner,Content,End Date,Days Remaining,Platforms,Auto Renewal\n";
      getExpiringContracts().forEach(c => {
        const daysRemaining = differenceInDays(new Date(c.endDate!), new Date());
        csvContent += `"${c.partner}","${c.content}","${c.endDate}","${daysRemaining}","${c.platforms?.join('; ')}","${c.autoRenewal}"\n`;
      });
      filename = "expiring-contracts.csv";
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `${filename} has been downloaded`,
    });
  };

  const isLoading = contractsLoading || royaltiesLoading;
  const summary = getContractSummary();
  const royaltySummary = getRoyaltySummary();
  const expiringContracts = getExpiringContracts();

  return (
    <div className="p-6 space-y-6" data-testid="reports-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-muted-foreground">Generate and export contract and royalty reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-[250px]" data-testid="select-report-type">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contract-summary">Contract Summary</SelectItem>
                <SelectItem value="royalty-statements">Royalty Statements</SelectItem>
                <SelectItem value="expiring-contracts">Expiring Contracts</SelectItem>
              </SelectContent>
            </Select>

            {reportType === "expiring-contracts" && (
              <Select value={expiringDays} onValueChange={setExpiringDays}>
                <SelectTrigger className="w-[180px]" data-testid="select-expiring-days">
                  <SelectValue placeholder="Time Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">Next 30 Days</SelectItem>
                  <SelectItem value="60">Next 60 Days</SelectItem>
                  <SelectItem value="90">Next 90 Days</SelectItem>
                  <SelectItem value="180">Next 6 Months</SelectItem>
                  <SelectItem value="365">Next Year</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button onClick={handleExportCSV} variant="outline" data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {reportType === "contract-summary" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">{summary.total}</p>
                      <p className="text-sm text-muted-foreground">Total Contracts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-500">{summary.active}</p>
                      <p className="text-sm text-muted-foreground">Active</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-500">{summary.inPerpetuity}</p>
                      <p className="text-sm text-muted-foreground">In Perpetuity</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-500">{summary.expired}</p>
                      <p className="text-sm text-muted-foreground">Expired</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-500">{summary.autoRenewal}</p>
                      <p className="text-sm text-muted-foreground">Auto-Renewal</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">By Platform</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(summary.byPlatform).map(([platform, count]) => (
                        <div key={platform} className="flex justify-between items-center">
                          <span className="text-foreground">{platform}</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                      {Object.keys(summary.byPlatform).length === 0 && (
                        <p className="text-muted-foreground text-sm">No platform data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">By Territory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {Object.entries(summary.byTerritory)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 10)
                        .map(([territory, count]) => (
                          <div key={territory} className="flex justify-between items-center">
                            <span className="text-foreground">{territory}</span>
                            <Badge variant="secondary">{count}</Badge>
                          </div>
                        ))}
                      {Object.keys(summary.byTerritory).length === 0 && (
                        <p className="text-muted-foreground text-sm">No territory data</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>All Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Content</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Platforms</TableHead>
                        <TableHead>Royalty Type</TableHead>
                        <TableHead>End Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contracts.map(contract => (
                        <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                          <TableCell className="font-medium">{contract.partner}</TableCell>
                          <TableCell>{contract.content}</TableCell>
                          <TableCell>
                            <Badge variant={
                              contract.status === "Active" ? "default" :
                              contract.status === "In Perpetuity" ? "secondary" :
                              "outline"
                            }>
                              {contract.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{contract.platforms?.join(", ")}</TableCell>
                          <TableCell>
                            {contract.royaltyType === "revenue_share" 
                              ? `${contract.royaltyPercentage}%` 
                              : formatCurrency(parseFloat(contract.flatFeeAmount || "0"))}
                          </TableCell>
                          <TableCell>
                            {contract.endDate 
                              ? format(new Date(contract.endDate), 'MMM dd, yyyy')
                              : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "royalty-statements" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(royaltySummary.totalRevenue)}</p>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{formatCurrency(royaltySummary.totalRoyalties)}</p>
                      <p className="text-sm text-muted-foreground">Total Royalties</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-500">{formatCurrency(royaltySummary.paidRoyalties)}</p>
                      <p className="text-sm text-muted-foreground">Paid</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-500">{formatCurrency(royaltySummary.pendingRoyalties)}</p>
                      <p className="text-sm text-muted-foreground">Pending</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Royalty Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Royalty Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {royalties.map(royalty => (
                        <TableRow key={royalty.id} data-testid={`royalty-row-${royalty.id}`}>
                          <TableCell className="font-medium">{royalty.period}</TableCell>
                          <TableCell>{royalty.contract?.partner || 'N/A'}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(royalty.revenue || "0"))}</TableCell>
                          <TableCell>{formatCurrency(parseFloat(royalty.royaltyAmount || "0"))}</TableCell>
                          <TableCell>
                            <Badge variant={royalty.status === "Paid" ? "default" : "secondary"}>
                              {royalty.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {royalties.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No royalty transactions found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "expiring-contracts" && (
            <>
              <Card className="border-yellow-500/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    Contracts Expiring in Next {expiringDays} Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {expiringContracts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No contracts expiring in the selected time period
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Partner</TableHead>
                          <TableHead>Content</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Days Remaining</TableHead>
                          <TableHead>Platforms</TableHead>
                          <TableHead>Auto-Renewal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expiringContracts.map(contract => {
                          const daysRemaining = differenceInDays(new Date(contract.endDate!), new Date());
                          return (
                            <TableRow key={contract.id} data-testid={`expiring-row-${contract.id}`}>
                              <TableCell className="font-medium">{contract.partner}</TableCell>
                              <TableCell>{contract.content}</TableCell>
                              <TableCell>{format(new Date(contract.endDate!), 'MMM dd, yyyy')}</TableCell>
                              <TableCell>
                                <Badge variant={daysRemaining <= 7 ? "destructive" : daysRemaining <= 30 ? "secondary" : "outline"}>
                                  {daysRemaining} days
                                </Badge>
                              </TableCell>
                              <TableCell>{contract.platforms?.join(", ")}</TableCell>
                              <TableCell>
                                {contract.autoRenewal ? (
                                  <Badge variant="default">Yes</Badge>
                                ) : (
                                  <Badge variant="outline">No</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
