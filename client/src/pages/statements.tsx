import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { FileText, Mail, Download, Building2 } from "lucide-react";
import type { Contract, Royalty } from "@shared/schema";

export default function Statements() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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
  const [selectedPartner, setSelectedPartner] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>("");
  const [periodEnd, setPeriodEnd] = useState<string>("");
  const [recipientEmail, setRecipientEmail] = useState<string>("");
  const [showStatement, setShowStatement] = useState(false);

  const { data: contracts } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
  });

  const { data: royalties } = useQuery<(Royalty & { contract: Contract })[]>({
    queryKey: ["/api/royalties"],
  });

  const partners = useMemo(() => {
    if (!contracts) return [];
    const uniquePartners = [...new Set(contracts.map(c => c.partner))];
    return uniquePartners.sort();
  }, [contracts]);

  const partnerContracts = useMemo(() => {
    if (!contracts || !selectedPartner) return [];
    return contracts.filter(c => c.partner === selectedPartner);
  }, [contracts, selectedPartner]);

  const partnerRoyalties = useMemo(() => {
    if (!royalties || !selectedPartner) return [];
    return royalties.filter(r => r.contract?.partner === selectedPartner);
  }, [royalties, selectedPartner]);

  const filteredRoyalties = useMemo(() => {
    if (!partnerRoyalties.length) return [];
    return partnerRoyalties.filter(r => {
      if (!periodStart && !periodEnd) return true;
      const period = r.reportingPeriod;
      if (periodStart && period < periodStart) return false;
      if (periodEnd && period > periodEnd) return false;
      return true;
    });
  }, [partnerRoyalties, periodStart, periodEnd]);

  const statementSummary = useMemo(() => {
    const totalRevenue = filteredRoyalties.reduce((sum, r) => sum + parseFloat(r.revenue || "0"), 0);
    const totalRoyalties = filteredRoyalties.reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);
    const paidRoyalties = filteredRoyalties.filter(r => r.status === "Paid").reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);
    const pendingRoyalties = filteredRoyalties.filter(r => r.status !== "Paid").reduce((sum, r) => sum + parseFloat(r.royaltyAmount || "0"), 0);
    
    return {
      totalRevenue,
      totalRoyalties,
      paidRoyalties,
      pendingRoyalties,
      transactionCount: filteredRoyalties.length,
    };
  }, [filteredRoyalties]);

  const sendStatementMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/statements/send", {
        partner: selectedPartner,
        recipientEmail,
        periodStart,
        periodEnd,
        summary: statementSummary,
        royalties: filteredRoyalties.map(r => ({
          period: r.reportingPeriod,
          revenue: r.revenue,
          royaltyAmount: r.royaltyAmount,
          status: r.status,
          contractContent: r.contract?.content,
        })),
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Statement Sent",
        description: `Royalty statement has been emailed to ${recipientEmail}`,
      });
      setRecipientEmail("");
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateStatement = () => {
    if (!selectedPartner) {
      toast({
        title: "Select Partner",
        description: "Please select a partner to generate a statement for.",
        variant: "destructive",
      });
      return;
    }
    setShowStatement(true);
  };

  const handleSendEmail = () => {
    if (!recipientEmail) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      });
      return;
    }
    sendStatementMutation.mutate();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Royalty Statements</h1>
          <p className="text-muted-foreground">Generate and send royalty statements to rights holders</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Statement Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Partner / Rights Holder</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger data-testid="select-partner">
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((partner) => (
                    <SelectItem key={partner} value={partner}>
                      {partner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input
                type="month"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                data-testid="input-period-start"
              />
            </div>

            <div className="space-y-2">
              <Label>Period End</Label>
              <Input
                type="month"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                data-testid="input-period-end"
              />
            </div>

            <Button 
              onClick={generateStatement} 
              className="w-full"
              data-testid="button-generate"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Statement
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Statement Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showStatement ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a partner and generate a statement to see the preview</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h2 className="text-xl font-bold">Royalty Statement</h2>
                  <p className="text-muted-foreground">Partner: {selectedPartner}</p>
                  <p className="text-muted-foreground">
                    Period: {periodStart || "All time"} - {periodEnd || "Present"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Generated: {new Date().toLocaleDateString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-xl font-bold">{formatCurrency(statementSummary.totalRevenue)}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">Total Royalties</p>
                    <p className="text-xl font-bold">{formatCurrency(statementSummary.totalRoyalties)}</p>
                  </div>
                  <div className="bg-green-100 rounded-lg p-4">
                    <p className="text-sm text-green-700">Paid</p>
                    <p className="text-xl font-bold text-green-800">{formatCurrency(statementSummary.paidRoyalties)}</p>
                  </div>
                  <div className="bg-amber-100 rounded-lg p-4">
                    <p className="text-sm text-amber-700">Outstanding</p>
                    <p className="text-xl font-bold text-amber-800">{formatCurrency(statementSummary.pendingRoyalties)}</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Transaction Details</h3>
                  {filteredRoyalties.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">No royalty records found for this period</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="text-left p-3">Period</th>
                            <th className="text-left p-3">Content</th>
                            <th className="text-right p-3">Revenue</th>
                            <th className="text-right p-3">Royalty</th>
                            <th className="text-center p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRoyalties.map((royalty) => (
                            <tr key={royalty.id} className="border-t">
                              <td className="p-3">{royalty.reportingPeriod}</td>
                              <td className="p-3">{royalty.contract?.content || "-"}</td>
                              <td className="p-3 text-right">{formatCurrency(parseFloat(royalty.revenue || "0"))}</td>
                              <td className="p-3 text-right">{formatCurrency(parseFloat(royalty.royaltyAmount || "0"))}</td>
                              <td className="p-3 text-center">
                                <Badge className={
                                  royalty.status === "Paid" ? "bg-green-100 text-green-800" :
                                  royalty.status === "Approved" ? "bg-blue-100 text-blue-800" :
                                  "bg-amber-100 text-amber-800"
                                }>
                                  {royalty.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted font-semibold">
                          <tr>
                            <td className="p-3" colSpan={2}>Total</td>
                            <td className="p-3 text-right">{formatCurrency(statementSummary.totalRevenue)}</td>
                            <td className="p-3 text-right">{formatCurrency(statementSummary.totalRoyalties)}</td>
                            <td className="p-3"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Send Statement via Email</h3>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="recipient@example.com"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="flex-1"
                      data-testid="input-recipient-email"
                    />
                    <Button 
                      onClick={handleSendEmail}
                      disabled={sendStatementMutation.isPending}
                      data-testid="button-send-email"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      {sendStatementMutation.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
