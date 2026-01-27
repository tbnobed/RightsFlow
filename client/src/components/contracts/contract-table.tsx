import { useState } from "react";
import { Contract, ContentItem } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Edit, Trash2, Film, Tv, Radio, FileVideo, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ContractForm from "./contract-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function ContractTable({ contracts, isLoading, onUpdate }: ContractTableProps) {
  const { toast } = useToast();
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [selectedContentId, setSelectedContentId] = useState<string>("");

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

  const linkedContentIds = new Set(contractContent.map((c) => c.contentId));
  const availableContent = allContentItems.filter((c) => !linkedContentIds.has(c.id));

  const linkContentMutation = useMutation({
    mutationFn: async ({ contractId, contentId }: { contractId: string; contentId: string }) => {
      return await apiRequest("POST", `/api/contracts/${contractId}/content`, { contentId });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Content linked to contract" });
      refetchContractContent();
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
      refetchContractContent();
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
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Partner</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Licensee</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Territory</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Platform</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Start Date</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">End Date</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Status</th>
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((contract) => (
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
                  {new Date(contract.startDate).toLocaleDateString()}
                </td>
                <td className="py-4 px-6 text-muted-foreground" data-testid={`text-end-date-${contract.id}`}>
                  <div className="flex items-center gap-1">
                    {contract.autoRenew ? (
                      <Badge className="bg-cyan-100 text-cyan-800">Auto-renew</Badge>
                    ) : contract.endDate ? (
                      new Date(contract.endDate).toLocaleDateString()
                    ) : (
                      "-"
                    )}
                  </div>
                </td>
                <td className="py-4 px-6" data-testid={`status-${contract.id}`}>
                  <Badge className={getStatusColor(contract.status || "Active")}>
                    {contract.status || "Active"}
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
                  <p className="text-sm">{new Date(viewContract.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p className="text-sm">
                    {viewContract.autoRenew ? (
                      <Badge className="bg-cyan-100 text-cyan-800">Auto-renew</Badge>
                    ) : viewContract.endDate ? (
                      new Date(viewContract.endDate).toLocaleDateString()
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
                  <Badge className={getStatusColor(viewContract.status || "Active")}>
                    {viewContract.status || "Active"}
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
                        <SelectItem value="_none" disabled>No available content</SelectItem>
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
