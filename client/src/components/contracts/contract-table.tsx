import { useState, useEffect } from "react";
import { Contract, ContentItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Edit, Trash2, Film, Tv, Radio, FileVideo, Plus, X, ArrowUpDown, ArrowUp, ArrowDown, History, DollarSign, FileText, Users, ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ContractForm from "./contract-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PaginationControls from "@/components/ui/pagination-controls";

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
  initialViewContractId?: string | null;
  onClearViewContract?: () => void;
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
    oldValues: Record<string, any> | null;
    newValues: Record<string, any> | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }>;
  amendments: Contract[];
}

type SortColumn = "partner" | "licensee" | "territory" | "platform" | "startDate" | "endDate" | "status";
type SortDirection = "asc" | "desc";

export default function ContractTable({ contracts, isLoading, onUpdate, initialViewContractId, onClearViewContract }: ContractTableProps) {
  const { toast } = useToast();
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [royaltiesExpanded, setRoyaltiesExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Handle initial view contract from URL
  useEffect(() => {
    if (initialViewContractId && contracts.length > 0) {
      const contract = contracts.find(c => c.id === initialViewContractId);
      if (contract) {
        setViewContract(contract);
      }
    }
  }, [initialViewContractId, contracts]);

  // Clear URL when dialog is closed
  const handleCloseViewDialog = () => {
    setViewContract(null);
    setRoyaltiesExpanded(false);
    if (onClearViewContract) {
      onClearViewContract();
    }
  };

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

  // Pagination
  const totalPages = Math.ceil(sortedContracts.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedContracts = sortedContracts.slice(startIndex, startIndex + pageSize);

  // Reset to page 1 when contracts change
  useEffect(() => {
    setCurrentPage(1);
  }, [contracts.length, pageSize]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

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
            {paginatedContracts.map((contract) => (
              <tr 
                key={contract.id} 
                className="border-b border-border hover:bg-muted/30 transition-all cursor-pointer"
                data-testid={`contract-row-${contract.id}`}
                onClick={() => setViewContract(contract)}
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
                <td className="py-4 px-6" onClick={(e) => e.stopPropagation()}>
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
        {sortedContracts.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedContracts.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        )}
      </div>

      {/* View Contract Dialog */}
      <Dialog open={!!viewContract} onOpenChange={handleCloseViewDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
          </DialogHeader>
          {viewContract && (
            <div className="space-y-6">
              {/* Section: Contract Details */}
              <div className="bg-muted/20 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Contract Details
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Partner</label>
                    <p className="text-sm font-medium">{viewContract.partner}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Licensor</label>
                    <p className="text-sm">{viewContract.licensor}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Licensee</label>
                    <p className="text-sm">{viewContract.licensee}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Territory</label>
                    <p className="text-sm">{viewContract.territory}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Platform</label>
                    <p className="text-sm">{viewContract.platform}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Exclusivity</label>
                    <p className="text-sm">{viewContract.exclusivity}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                    <p className="text-sm">{formatDateLocal(viewContract.startDate)}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">End Date</label>
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
                    <label className="text-xs font-medium text-muted-foreground">Status</label>
                    <div>
                      <Badge className={getStatusColor(getComputedStatus(viewContract))}>
                        {getComputedStatus(viewContract)}
                      </Badge>
                      {viewContract.parentContractId && (
                        <Badge className="bg-purple-100 text-purple-800 ml-1">Amendment</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {viewContract.contractDocumentUrl && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <a 
                      href={viewContract.contractDocumentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      View Contract Document
                    </a>
                  </div>
                )}
              </div>

              {/* Section: Financial Terms */}
              <div className="bg-muted/20 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Terms
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Royalty Type</label>
                    <p className="text-sm font-medium">{viewContract.royaltyType}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      {viewContract.royaltyType === "Flat Fee" ? "Flat Fee Amount" : "Revenue Share Rate"}
                    </label>
                    <p className="text-sm font-medium">
                      {viewContract.royaltyType === "Flat Fee" 
                        ? `$${Number(viewContract.flatFeeAmount || 0).toLocaleString()}`
                        : `${viewContract.royaltyRate || 0}%`
                      }
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Payment Terms</label>
                    <p className="text-sm">{viewContract.paymentTerms || "Net 30"}</p>
                  </div>
                  {viewContract.minimumPayment && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Minimum Threshold</label>
                      <p className="text-sm">${Number(viewContract.minimumPayment).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Linked Content */}
              <div className="bg-muted/20 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Film className="h-4 w-4" />
                  Linked Content
                  {contractContent.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{contractContent.length}</Badge>
                  )}
                </h3>
                
                {contractContent.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contractContent.map((link) => (
                      <div 
                        key={link.id} 
                        className="flex items-center justify-between bg-background rounded-md px-3 py-2 border border-border"
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
                  <p className="text-sm text-muted-foreground">No content linked to this contract.</p>
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

              {/* Section: Amendments */}
              {contractHistory?.amendments && contractHistory.amendments.length > 0 && (
                <div className="bg-muted/20 rounded-lg p-4 border border-border">
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Amendments
                    <Badge variant="secondary" className="ml-auto">{contractHistory.amendments.length}</Badge>
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {contractHistory.amendments.map((amendment) => (
                      <div key={amendment.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 text-sm border border-border">
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

              {/* Section: Royalties */}
              {contractHistory?.royalties && contractHistory.royalties.length > 0 && (() => {
                const totalRoyalties = contractHistory.royalties.reduce((sum, r) => sum + Number(r.royaltyAmount), 0);
                const paidRoyalties = contractHistory.royalties.filter(r => r.status === "Paid").reduce((sum, r) => sum + Number(r.royaltyAmount), 0);
                const pendingRoyalties = contractHistory.royalties.filter(r => r.status === "Pending").reduce((sum, r) => sum + Number(r.royaltyAmount), 0);
                
                return (
                  <div className="bg-muted/20 rounded-lg p-4 border border-border">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Royalties
                    </h3>
                    
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="bg-background rounded-md p-3 border border-border text-center">
                        <div className="text-lg font-bold text-foreground">${totalRoyalties.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </div>
                      <div className="bg-background rounded-md p-3 border border-border text-center">
                        <div className="text-lg font-bold text-green-600">${paidRoyalties.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Paid</div>
                      </div>
                      <div className="bg-background rounded-md p-3 border border-border text-center">
                        <div className="text-lg font-bold text-amber-600">${pendingRoyalties.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">Pending</div>
                      </div>
                    </div>
                    
                    {/* Expandable Details */}
                    <button
                      onClick={() => setRoyaltiesExpanded(!royaltiesExpanded)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-background rounded-md border border-border hover:bg-muted/50 transition-colors text-sm"
                      data-testid="button-expand-royalties"
                    >
                      <span className="font-medium">View Detailed Report ({contractHistory.royalties.length} payments)</span>
                      {royaltiesExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    {royaltiesExpanded && (
                      <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                        {contractHistory.royalties.map((royalty) => (
                          <div key={royalty.id} className="flex items-center justify-between bg-background rounded-md px-3 py-2 text-sm border border-border">
                            <div className="flex items-center gap-3">
                              <span className="font-medium min-w-[80px]">{royalty.period}</span>
                              <Badge className={
                                royalty.status === "Paid" ? "bg-green-100 text-green-800" :
                                royalty.status === "Approved" ? "bg-blue-100 text-blue-800" :
                                "bg-yellow-100 text-yellow-800"
                              }>
                                {royalty.status}
                              </Badge>
                              <span className="text-muted-foreground">Revenue: ${Number(royalty.revenue).toLocaleString()}</span>
                            </div>
                            <span className="font-semibold">${Number(royalty.royaltyAmount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Section: Activity Log */}
              <div className="bg-muted/20 rounded-lg p-4 border border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Activity Log
                  {contractHistory?.auditLogs && contractHistory.auditLogs.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">{contractHistory.auditLogs.length}</Badge>
                  )}
                </h3>
                
                {/* Creation Info */}
                {contractHistory && (
                  <div className="flex items-center gap-2 text-sm mb-3 pb-3 border-b border-border">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created</span>
                    {contractHistory.createdAt && (
                      <span className="font-medium">{new Date(contractHistory.createdAt).toLocaleDateString()}</span>
                    )}
                    {contractHistory.createdBy && (
                      <span className="text-muted-foreground">
                        by <span className="font-medium text-foreground">{contractHistory.createdBy.firstName} {contractHistory.createdBy.lastName}</span>
                      </span>
                    )}
                  </div>
                )}

                {contractHistory?.auditLogs && contractHistory.auditLogs.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {contractHistory.auditLogs.map((log) => {
                      // Determine what changed
                      const getChangeSummary = () => {
                        if (!log.oldValues || !log.newValues) return null;
                        const changes: string[] = [];
                        const fieldsToTrack = ['partner', 'licensee', 'territory', 'platform', 'startDate', 'endDate', 'status', 'royaltyType', 'royaltyRate', 'flatFeeAmount', 'minimumPayment', 'paymentTerms'];
                        
                        for (const field of fieldsToTrack) {
                          const oldVal = log.oldValues[field];
                          const newVal = log.newValues[field];
                          if (oldVal !== newVal && (oldVal || newVal)) {
                            const label = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                            changes.push(`${label}: "${oldVal || '—'}" → "${newVal || '—'}"`);
                          }
                        }
                        return changes;
                      };
                      
                      const changes = getChangeSummary();
                      
                      return (
                        <div key={log.id} className="bg-background rounded-md px-3 py-2 border border-border">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{log.action}</span>
                              {log.user && (
                                <span className="text-muted-foreground">
                                  by <span className="text-foreground">{log.user.firstName} {log.user.lastName}</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {changes && changes.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className="text-xs text-muted-foreground space-y-1">
                                {changes.map((change, idx) => (
                                  <div key={idx} className="font-mono">{change}</div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
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
