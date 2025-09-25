import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ContractTable from "@/components/contracts/contract-table";
import ContractForm from "@/components/contracts/contract-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Filter, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Contracts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    territory: "",
  });
  const [showForm, setShowForm] = useState(false);

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

  const { data: contracts, isLoading: contractsLoading, refetch } = useQuery({
    queryKey: ["/api/contracts", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status) params.append('status', filters.status);
      if (filters.territory) params.append('territory', filters.territory);
      
      const response = await fetch(`/api/contracts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
  });

  const handleExport = async () => {
    try {
      const response = await fetch('/api/contracts/export/csv');
      if (!response.ok) throw new Error('Failed to export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'contracts.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Contracts exported successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export contracts",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="contracts-view">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contract Management</h1>
          <p className="text-muted-foreground">Manage intellectual property licensing contracts</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} variant="outline" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-contract">
                <Plus className="h-4 w-4 mr-2" />
                Add Contract
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Contract</DialogTitle>
              </DialogHeader>
              <ContractForm 
                onSuccess={() => {
                  setShowForm(false);
                  refetch();
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg border p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Search contracts..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            data-testid="input-search"
          />
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger data-testid="select-status">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Terminated">Terminated</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.territory}
            onValueChange={(value) => setFilters(prev => ({ ...prev, territory: value }))}
          >
            <SelectTrigger data-testid="select-territory">
              <SelectValue placeholder="All Territories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Territories</SelectItem>
              <SelectItem value="North America">North America</SelectItem>
              <SelectItem value="Europe">Europe</SelectItem>
              <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
              <SelectItem value="Latin America">Latin America</SelectItem>
              <SelectItem value="Global">Global</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="secondary" data-testid="button-filter">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <ContractTable 
        contracts={contracts || []} 
        isLoading={contractsLoading}
        onUpdate={refetch}
      />
    </div>
  );
}
