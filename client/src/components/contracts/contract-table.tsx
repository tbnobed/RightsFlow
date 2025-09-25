import { useState } from "react";
import { Contract } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import ContractForm from "./contract-form";

interface ContractTableProps {
  contracts: Contract[];
  isLoading: boolean;
  onUpdate: () => void;
}

export default function ContractTable({ contracts, isLoading, onUpdate }: ContractTableProps) {
  const { toast } = useToast();
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);

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
      case 'Pending': return 'bg-amber-100 text-amber-800';
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
              <th className="text-left py-4 px-6 text-sm font-medium text-muted-foreground">IP Name</th>
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
                <td className="py-4 px-6 font-medium text-foreground" data-testid={`text-ip-name-${contract.id}`}>
                  {contract.ipName}
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
                  {new Date(contract.endDate).toLocaleDateString()}
                </td>
                <td className="py-4 px-6" data-testid={`status-${contract.id}`}>
                  <Badge className={getStatusColor(contract.status || "Pending")}>
                    {contract.status || "Pending"}
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
                  <label className="text-sm font-medium text-muted-foreground">IP Name</label>
                  <p className="text-sm">{viewContract.ipName}</p>
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
                  <label className="text-sm font-medium text-muted-foreground">Royalty Rate</label>
                  <p className="text-sm">{viewContract.royaltyRate}%</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <p className="text-sm">{new Date(viewContract.startDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p className="text-sm">{new Date(viewContract.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Exclusivity</label>
                  <p className="text-sm">{viewContract.exclusivity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <Badge className={getStatusColor(viewContract.status || "Pending")}>
                    {viewContract.status || "Pending"}
                  </Badge>
                </div>
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
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
