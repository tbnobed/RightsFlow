import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, Download, DollarSign, AlertTriangle } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  const getPartnerPerformance = () => {
    const partnerData: Record<string, { revenue: number; royalties: number; contracts: number }> = {};
    
    royalties.forEach(r => {
      const partner = r.contract?.partner || 'Unknown';
      if (!partnerData[partner]) {
        partnerData[partner] = { revenue: 0, royalties: 0, contracts: 0 };
      }
      partnerData[partner].revenue += parseFloat(r.revenue || "0");
      partnerData[partner].royalties += parseFloat(r.royaltyAmount || "0");
    });

    contracts.forEach(c => {
      if (!partnerData[c.partner]) {
        partnerData[c.partner] = { revenue: 0, royalties: 0, contracts: 0 };
      }
      partnerData[c.partner].contracts += 1;
    });

    return Object.entries(partnerData)
      .map(([partner, data]) => ({ partner, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const getPlatformPerformance = () => {
    const platformData: Record<string, { contracts: number; revenue: number }> = {};
    
    contracts.forEach(c => {
      c.platforms?.forEach(platform => {
        if (!platformData[platform]) {
          platformData[platform] = { contracts: 0, revenue: 0 };
        }
        platformData[platform].contracts += 1;
      });
    });

    royalties.forEach(r => {
      r.contract?.platforms?.forEach(platform => {
        if (!platformData[platform]) {
          platformData[platform] = { contracts: 0, revenue: 0 };
        }
        platformData[platform].revenue += parseFloat(r.revenue || "0") / (r.contract?.platforms?.length || 1);
      });
    });

    return Object.entries(platformData)
      .map(([platform, data]) => ({ platform, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  const getPaymentsDue = () => {
    const pendingRoyalties = royalties.filter(r => r.status === "Pending" || r.status === "Calculated");
    
    return pendingRoyalties.map(r => {
      const contract = r.contract;
      const paymentTerms = contract?.paymentTerms || "Net 30";
      const daysToAdd = paymentTerms === "Net 60" ? 60 : paymentTerms === "Net 90" ? 90 : 30;
      
      const periodParts = r.period?.split(' ') || [];
      let dueDate = new Date();
      if (periodParts.length >= 2) {
        const monthYear = periodParts.slice(-2).join(' ');
        const parsedDate = new Date(monthYear + " 1");
        if (!isNaN(parsedDate.getTime())) {
          dueDate = addDays(new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0), daysToAdd);
        }
      }

      return {
        ...r,
        dueDate,
        paymentTerms,
        isOverdue: dueDate < new Date(),
      };
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
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
    } else if (reportType === "partner-performance") {
      csvContent = "Partner,Contracts,Revenue,Royalties\n";
      getPartnerPerformance().forEach(p => {
        csvContent += `"${p.partner}","${p.contracts}","${p.revenue}","${p.royalties}"\n`;
      });
      filename = "partner-performance.csv";
    } else if (reportType === "platform-performance") {
      csvContent = "Platform,Contracts,Revenue\n";
      getPlatformPerformance().forEach(p => {
        csvContent += `"${p.platform}","${p.contracts}","${p.revenue}"\n`;
      });
      filename = "platform-performance.csv";
    } else if (reportType === "payments-due") {
      csvContent = "Partner,Period,Amount,Payment Terms,Due Date,Status\n";
      getPaymentsDue().forEach(p => {
        csvContent += `"${p.contract?.partner || 'N/A'}","${p.period}","${p.royaltyAmount}","${p.paymentTerms}","${format(p.dueDate, 'yyyy-MM-dd')}","${p.isOverdue ? 'Overdue' : 'Pending'}"\n`;
      });
      filename = "payments-due.csv";
    }

    if (!csvContent) {
      toast({ title: "Error", description: "No data to export", variant: "destructive" });
      return;
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

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const reportTitles: Record<string, string> = {
      "contract-summary": "Contract Summary Report",
      "royalty-statements": "Royalty Statements Report",
      "expiring-contracts": `Expiring Contracts (Next ${expiringDays} Days)`,
      "partner-performance": "Partner Performance Report",
      "platform-performance": "Platform Performance Report",
      "payments-due": "Payments Due Report",
    };

    doc.setFontSize(18);
    doc.setTextColor(40, 60, 80);
    doc.text(reportTitles[reportType] || "Report", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, 14, 30);
    doc.text("Promissio Rights Management", 14, 35);

    let tableData: string[][] = [];
    let columns: string[] = [];

    if (reportType === "contract-summary") {
      columns = ["Partner", "Content", "Status", "Platforms", "Royalty Type", "End Date"];
      tableData = contracts.map(c => [
        c.partner,
        c.content?.substring(0, 30) + (c.content?.length > 30 ? "..." : ""),
        c.status,
        c.platforms?.join(", ") || "",
        c.royaltyType === "revenue_share" ? `${c.royaltyPercentage}%` : formatCurrency(parseFloat(c.flatFeeAmount || "0")),
        c.endDate ? format(new Date(c.endDate), 'MMM dd, yyyy') : "N/A",
      ]);
    } else if (reportType === "royalty-statements") {
      columns = ["Period", "Partner", "Revenue", "Royalty", "Status"];
      tableData = royalties.map(r => [
        r.period,
        r.contract?.partner || "N/A",
        formatCurrency(parseFloat(r.revenue || "0")),
        formatCurrency(parseFloat(r.royaltyAmount || "0")),
        r.status,
      ]);
    } else if (reportType === "expiring-contracts") {
      columns = ["Partner", "Content", "End Date", "Days Left", "Auto-Renewal"];
      tableData = getExpiringContracts().map(c => {
        const daysRemaining = differenceInDays(new Date(c.endDate!), new Date());
        return [
          c.partner,
          c.content?.substring(0, 30) + (c.content?.length > 30 ? "..." : ""),
          format(new Date(c.endDate!), 'MMM dd, yyyy'),
          `${daysRemaining} days`,
          c.autoRenewal ? "Yes" : "No",
        ];
      });
    } else if (reportType === "partner-performance") {
      columns = ["Partner", "Contracts", "Revenue", "Royalties"];
      tableData = getPartnerPerformance().map(p => [
        p.partner,
        p.contracts.toString(),
        formatCurrency(p.revenue),
        formatCurrency(p.royalties),
      ]);
    } else if (reportType === "platform-performance") {
      columns = ["Platform", "Contracts", "Revenue"];
      tableData = getPlatformPerformance().map(p => [
        p.platform,
        p.contracts.toString(),
        formatCurrency(p.revenue),
      ]);
    } else if (reportType === "payments-due") {
      columns = ["Partner", "Period", "Amount", "Terms", "Due Date", "Status"];
      tableData = getPaymentsDue().map(p => [
        p.contract?.partner || "N/A",
        p.period,
        formatCurrency(parseFloat(p.royaltyAmount || "0")),
        p.paymentTerms,
        format(p.dueDate, 'MMM dd, yyyy'),
        p.isOverdue ? "Overdue" : "Due",
      ]);
    }

    if (tableData.length === 0) {
      toast({ title: "Error", description: "No data to export", variant: "destructive" });
      return;
    }

    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: 42,
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [40, 60, 80], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    const filename = `${reportType}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);

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
                <SelectItem value="partner-performance">Partner Performance</SelectItem>
                <SelectItem value="platform-performance">Platform Performance</SelectItem>
                <SelectItem value="payments-due">Payments Due</SelectItem>
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
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={handleExportPDF} variant="outline" data-testid="button-export-pdf">
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
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

          {reportType === "partner-performance" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Partner Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead className="text-right">Contracts</TableHead>
                        <TableHead className="text-right">Total Revenue</TableHead>
                        <TableHead className="text-right">Total Royalties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPartnerPerformance().map(p => (
                        <TableRow key={p.partner} data-testid={`partner-row-${p.partner}`}>
                          <TableCell className="font-medium">{p.partner}</TableCell>
                          <TableCell className="text-right">{p.contracts}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.royalties)}</TableCell>
                        </TableRow>
                      ))}
                      {getPartnerPerformance().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No partner data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "platform-performance" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Platform Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Contracts</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPlatformPerformance().map(p => (
                        <TableRow key={p.platform} data-testid={`platform-row-${p.platform}`}>
                          <TableCell className="font-medium">{p.platform}</TableCell>
                          <TableCell className="text-right">{p.contracts}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                      {getPlatformPerformance().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No platform data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}

          {reportType === "payments-due" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    Payments Due
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Partner</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Payment Terms</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getPaymentsDue().map(p => (
                        <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                          <TableCell className="font-medium">{p.contract?.partner || 'N/A'}</TableCell>
                          <TableCell>{p.period}</TableCell>
                          <TableCell className="text-right">{formatCurrency(parseFloat(p.royaltyAmount || "0"))}</TableCell>
                          <TableCell>{p.paymentTerms}</TableCell>
                          <TableCell>{format(p.dueDate, 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={p.isOverdue ? "destructive" : "secondary"}>
                              {p.isOverdue ? "Overdue" : "Due"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {getPaymentsDue().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No pending payments
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
