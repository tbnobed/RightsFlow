import { useState } from "react";
import { Contract, ContentItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Edit, Trash2, Film, Tv, Radio, FileVideo, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, History, DollarSign, FileText, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ContractForm from "./contract-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDateLocal(dateString: string | null | undefined): string {
  if (!dateString) return "-";
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function getContentIcon(type: string) {
  switch (type) {
    case "Film":
      return <Film className="h-4 w-4" />;
    case "TV Series":
      return <Tv className="h-4 w-4" />;
    case "TBN FAST":
    case "WoF FAST":
      return <Radio className="h-4 w-4" />;
    case "TBN Linear":
      return <FileVideo className="h-4 w-4" />;
    default:
      return <Film className="h-4 w-4" />;
  }
}

interface ContractTableProps {
  contracts: Contract[];
  isLoading: boolean;
  onUpdate: () => void;
}

interface ContractContentLink {
  id: string;
  contractId: string;
  contentId: string;
  notes: string | null;
  createdAt: Date | null;
  content: ContentItem;
}

interface ContractHistory {
  createdAt: string | null;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  royalties: Array<{
    id: string;
    period: string;
    revenue: string;
    royaltyAmount: string;
    status: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    createdAt: string;
    userId: string | null;
  }>;
  amendments: Contract[];
}

type SortColumn = "partner" | "licensee" | "territory" | "platform" | "startDate" | "endDate" | "status";
type SortDirection = "asc" | "desc";

export default function ContractTable({ contracts, isLoading, onUpdate }: ContractTableProps) {
  const { toast } = useToast();
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const { data: contractContent = [], refetch: refetchContractContent } = useQuery<ContractContentLink[]>({
    queryKey: ["/api/contracts", viewContract?.id, "content"],
    queryFn: async () => {
      if (!viewContract) return [];
      const response = await fetch(`/api/contracts/${viewContract.id}/content`);
      if (!response.ok) throw new Error("Failed to fetch contract content");
      return response.json();
    },
    enabled: !!viewContract,
  });

  const { data: allContentItems = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
    enabled: !!viewContract,
  });

  const { data: contractHistory } = useQuery<ContractHistory>({
    queryKey: ["/api/contracts", viewContract?.id, "history"],
    queryFn: async () => {
      if (!viewContract) return null;
      const response = await fetch(`/api/contracts/${viewContract.id}/history`);
      if (!response.ok) throw new Error("Failed to fetch contract history");
      return response.json();
    },
    enabled: !!viewContract,
  });

  const linkedContentIds = new Set(contractContent.map((c) => c.contentId));
  const availableContent = allContentItems.filter((c) => !linkedContentIds.has(c.id));

  const linkContentMutation = useMutation({
    mutationFn: async ({ contractId, contentId }: { contractId: string; contentId: string }) => {
      return await apiRequest("POST", `/api/contracts/${contractId}/content`, { contentId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Content linked to contract" });
      if (viewContract) {
        queryClient.invalidateQueries({ queryKey: ["/api/contracts", viewContract.id, "content"] });
      }
      setSelectedContentId("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to link content", variant: "destructive" });
    },
  });

  const unlinkContentMutation = useMutation({
    mutationFn: async ({ contractId, contentId }: { contractId: string; contentId: string }) => {
      return await apiRequest("DELETE", `/api/contracts/${contractId}/content/${contentId}`);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Content unlinked from contract" });
      if (viewContract) {
        queryClient.invalidateQueries({ queryKey: ["/api/contracts", viewContract.id, "content"] });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to unlink content", variant: "destructive" });
    },
  });

  const deleteContractMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/contracts/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contract deleted successfully",
      });
      onUpdate();
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

  const getComputedStatus = (contract: Contract): string => {
    if (contract.status === 'Terminated' || contract.status === 'In Perpetuity') {
      return contract.status;
    }
    if (contract.autoRenew) {
      return contract.status || 'Active';
    }
    if (contract.endDate) {
      const endDate = new Date(contract.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) {
        return 'Expired';
      }
    }
    return contract.status || 'Active';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Expired': return 'bg-red-100 text-red-800';
      case 'In Perpetuity': return 'bg-blue-100 text-blue-800';
      case 'Terminated': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this contract?")) {
      deleteContractMutation.mutate(id);
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedContracts = [...contracts].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let aVal: string | number = "";
    let bVal: string | number = "";
    
    switch (sortColumn) {
      case "partner":
        aVal = a.partner?.toLowerCase() || "";
        bVal = b.partner?.toLowerCase() || "";
        break;
      case "licensee":
        aVal = a.licensee?.toLowerCase() || "";
        bVal = b.licensee?.toLowerCase() || "";
        break;
      case "territory":
        aVal = a.territory?.toLowerCase() || "";
        bVal = b.territory?.toLowerCase() || "";
        break;
      case "platform":
        aVal = a.platform?.toLowerCase() || "";
        bVal = b.platform?.toLowerCase() || "";
        break;
      case "startDate":
        aVal = a.startDate || "";
        bVal = b.startDate || "";
        break;
      case "endDate":
        aVal = a.endDate || "";
        bVal = b.endDate || "";
        break;
      case "status":
        aVal = getComputedStatus(a).toLowerCase();
        bVal = getComputedStatus(b).toLowerCase();
        break;
    }
    
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border overflow-hidden">
        <div className="animate-pulse p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("partner")}
              >
                <div className="flex items-center">Partner{getSortIcon("partner")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("licensee")}
              >
                <div className="flex items-center">Licensee{getSortIcon("licensee")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("territory")}
              >
                <div className="flex items-center">Territory{getSortIcon("territory")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("platform")}
              >
                <div className="flex items-center">Platform{getSortIcon("platform")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("startDate")}
              >
                <div className="flex items-center">Start Date{getSortIcon("startDate")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("endDate")}
              >
                <div className="flex items-center">End Date{getSortIcon("endDate")}</div>
              </th>
              <th 
                className="text-left py-4 px-6 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground select-none"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center">Status{getSortIcon("status")}</div>
              </th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedContracts.map((contract) => (
              <tr 
                key={contract.id} 
                className="border-b border-border hover:bg-muted/30 transition-all"
                data-testid={`contract-row-${contract.id}`}
              >
                <td className="py-4 px-6 font-medium text-foreground" data-testid={`text-partner-${contract.id}`}>
                  <div className="flex items-center gap-2">
                    {contract.parentContractId && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded" data-testid={`badge-amendment-${contract.id}`}>
                        Amendment
                      </span>
                    )}
                    {contract.partner}
                  </div>
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-licensee-${contract.id}`}>
                  {contract.licensee}
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-territory-${contract.id}`}>
                  {contract.territory}
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-platform-${contract.id}`}>
                  {contract.platform}
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-start-date-${contract.id}`}>
                  {formatDateLocal(contract.startDate)}
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-end-date-${contract.id}`}>
                  <div className="flex items-center gap-1">
                    {contract.autoRenew ? (
                      <Badge className="bg-cyan-100 text-cyan-800">Auto-renew</Badge>
                    ) : contract.endDate ? (
                      formatDateLocal(contract.endDate)
                    ) : (
                      "-"
                    )}
                  </div>
                </td>
                <td className="py-4 px-6" data-testid={`status-${contract.id}`}>
                  <Badge className={getStatusColor(getComputedStatus(contract))}>
                    {getComputedStatus(contract)}
                  </Badge>
                </td>
                <td className="py-4 px-6">
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setViewContract(contract)}
                      data-testid={`button-view-${contract.id}`}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => setEditContract(contract)}
                      data-testid={`button-edit-${contract.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDelete(contract.id)}
                      disabled={deleteContractMutation.isPending}
                      data-testid={`button-delete-${contract.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No contracts found. Create a new contract to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* View Contract Dialog */}
      <Dialog open={!!viewContract} onOpenChange={() => setViewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          {viewContract && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Partner</label>
                  <p className="text-sm">{viewContract.partner}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Licensor</label>
                  <p className="text-sm">{viewContract.licensor}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Licensee</label>
                  <p className="text-sm">{viewContract.licensee}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Territory</label>
                  <p className="text-sm">{viewContract.territory}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Platform</label>
                  <p className="text-sm">{viewContract.platform}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Royalty Terms</label>
                  <p className="text-sm">
                    {viewContract.royaltyType === "Flat Fee" ? (
                      `Flat Fee: $${viewContract.flatFeeAmount || 0}`
                    ) : (
                      `Revenue Share: ${viewContract.royaltyRate || 0}%`
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <p className="text-sm">{formatDateLocal(viewContract.startDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p className="text-sm">
                    {viewContract.autoRenew ? (
                      <Badge className="bg-cyan-100 text-cyan-800">Auto-renew</Badge>
                    ) : viewContract.endDate ? (
                      formatDateLocal(viewContract.endDate)
                    ) : (
                      "-"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Exclusivity</label>
                  <p className="text-sm">{viewContract.exclusivity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                  <p className="text-sm">{viewContract.paymentTerms || "Net 30"}</p>
                </div>
                {viewContract.minimumPayment && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Minimum Threshold</label>
                    <p className="text-sm">${viewContract.minimumPayment}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(getComputedStatus(viewContract))}>
                    {getComputedStatus(viewContract)}
                  </Badge>
                </div>
                {viewContract.parentContractId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <Badge className="bg-purple-100 text-purple-800">Amendment</Badge>
                  </div>
                )}
              </div>
              {viewContract.contractDocumentUrl && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contract Document</label>
                  <p className="text-sm">
                    <a 
                      href={viewContract.contractDocumentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View Document
                    </a>
                  </p>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <label className="text-sm font-medium text-muted-foreground">Linked Content</label>
                
                {contractContent.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {contractContent.map((link) => (
                      <div 
                        key={link.id} 
                        className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                        data-testid={`linked-content-${link.contentId}`}
                      >
                        <div className="flex items-center gap-2">
                          {getContentIcon(link.content.type)}
                          <span className="text-sm font-medium">{link.content.title}</span>
                          <Badge variant="outline" className="text-xs">{link.content.type}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => unlinkContentMutation.mutate({ 
                            contractId: viewContract.id, 
                            contentId: link.contentId 
                          })}
                          disabled={unlinkContentMutation.isPending}
                          data-testid={`button-unlink-content-${link.contentId}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">No content linked to this contract.</p>
                )}

                <div className="mt-3 flex gap-2">
                  <Select value={selectedContentId} onValueChange={setSelectedContentId}>
                    <SelectTrigger className="flex-1" data-testid="select-add-content">
                      <SelectValue placeholder="Select content to link..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableContent.length === 0 ? (
                        <SelectItem value="__none" disabled>No available content</SelectItem>
                      ) : (
                        availableContent.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            <div className="flex items-center gap-2">
                              {getContentIcon(item.type)}
                              <span>{item.title}</span>
                              <span className="text-muted-foreground text-xs">({item.type})</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => {
                      if (selectedContentId && viewContract) {
                        linkContentMutation.mutate({ 
                          contractId: viewContract.id, 
                          contentId: selectedContentId 
                        });
                      }
                    }}
                    disabled={!selectedContentId || linkContentMutation.isPending}
                    data-testid="button-link-content"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Link
                  </Button>
                </div>
              </div>

              {/* Contract History Section */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <label className="text-sm font-medium text-muted-foreground">Contract History</label>
                </div>

                {/* Creation Info */}
                {contractHistory && (
                  <div className="bg-muted/30 rounded-md px-3 py-2 mb-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Created</span>
                      {contractHistory.createdAt && (
                        <span>{new Date(contractHistory.createdAt).toLocaleDateString()}</span>
                      )}
                      {contractHistory.createdBy && (
                        <span className="text-muted-foreground">
                          by {contractHistory.createdBy.firstName} {contractHistory.createdBy.lastName}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Amendments */}
                {contractHistory?.amendments && contractHistory.amendments.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Amendments ({contractHistory.amendments.length})</span>
                    </div>
                    <div className="space-y-1">
                      {contractHistory.amendments.map((amendment) => (
                        <div key={amendment.id} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-md px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-purple-100 text-purple-800 text-xs">Amendment</Badge>
                            <span>{amendment.partner}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateLocal(amendment.startDate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Royalties */}
                {contractHistory?.royalties && contractHistory.royalties.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Royalties ({contractHistory.royalties.length})</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {contractHistory.royalties.map((royalty) => (
                        <div key={royalty.id} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span>{royalty.period}</span>
                            <Badge className={
                              royalty.status === "Paid" ? "bg-green-100 text-green-800" :
                              royalty.status === "Approved" ? "bg-blue-100 text-blue-800" :
                              "bg-yellow-100 text-yellow-800"
                            }>
                              {royalty.status}
                            </Badge>
                          </div>
                          <span className="font-medium">${Number(royalty.royaltyAmount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit Trail */}
                {contractHistory?.auditLogs && contractHistory.auditLogs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <History className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Activity Log ({contractHistory.auditLogs.length})</span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {contractHistory.auditLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
                          <span>{log.action}</span>
                          <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                        </div>
                      ))}
                      {contractHistory.auditLogs.length > 10 && (
                        <p className="text-xs text-muted-foreground text-center py-1">
                          +{contractHistory.auditLogs.length - 10} more entries
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {(!contractHistory?.royalties?.length && !contractHistory?.auditLogs?.length && !contractHistory?.amendments?.length) && (
                  <p className="text-sm text-muted-foreground">No history available for this contract.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog */}
      <Dialog open={!!editContract} onOpenChange={() => setEditContract(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
          </DialogHeader>
          {editContract && (
            <ContractForm 
              contractId={editContract.id}
              onSuccess={() => {
                setEditContract(null);
                onUpdate();
              }}
              onCancel={() => setEditContract(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
