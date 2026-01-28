import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import ContractTable from "@/components/contracts/contract-table";
import ContractForm from "@/components/contracts/contract-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";

export default function Contracts() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  
  const [urlFilter, setUrlFilter] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('filter');
  });
  
  // Sync URL filter with location changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUrlFilter(params.get('filter'));
  }, [location]);
  
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    territory: "",
  });
  const [showForm, setShowForm] = useState(false);
  
  const clearUrlFilter = () => {
    setUrlFilter(null);
    setLocation('/contracts');
    window.history.replaceState({}, '', '/contracts');
  };

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
    queryKey: ["/api/contracts", filters, urlFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.territory && filters.territory !== 'all') params.append('territory', filters.territory);
      if (urlFilter) params.append('filter', urlFilter);
      
      const response = await fetch(`/api/contracts?${params}`);
      if (!response.ok) throw new Error('Failed to fetch contracts');
      return response.json();
    },
  });
  
  const getFilterLabel = () => {
    switch (urlFilter) {
      case 'expiring': return 'Expiring in 60 days';
      case 'active': return 'Active contracts';
      default: return null;
    }
  };

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
          {urlFilter && getFilterLabel() && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary">
                Showing: {getFilterLabel()}
              </Badge>
              <button 
                type="button"
                onClick={clearUrlFilter} 
                className="hover:bg-muted rounded-full p-1 cursor-pointer text-muted-foreground hover:text-foreground"
                data-testid="button-clear-filter"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
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
                onCancel={() => {
                  setShowForm(false);
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
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Expired">Expired</SelectItem>
              <SelectItem value="In Perpetuity">In Perpetuity</SelectItem>
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
              <SelectItem value="all">All Territories</SelectItem>
              <SelectItem value="North America">North America</SelectItem>
              <SelectItem value="Europe">Europe</SelectItem>
              <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
              <SelectItem value="Latin America">Latin America</SelectItem>
              <SelectItem value="Global">Global</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="secondary" 
            data-testid="button-reset-filters"
            onClick={() => setFilters({ search: "", status: "", territory: "" })}
            disabled={!filters.search && !filters.status && !filters.territory}
          >
            <X className="h-4 w-4 mr-2" />
            Reset Filters
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
