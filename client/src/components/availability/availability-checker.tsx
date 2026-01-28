import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Search, CheckCircle, Eye, FileText, Calendar, MapPin, Monitor } from "lucide-react";
import type { Contract } from "@shared/schema";

const TERRITORY_OPTIONS = ["Any", "Global", "US", "Canada", "UK"];
const PLATFORM_OPTIONS = ["Any", "SVOD", "TVOD", "AVOD", "FAST", "Linear", "VOD"];

const availabilitySchema = z.object({
  partner: z.string().min(1, "Partner name is required"),
  territory: z.string().optional(),
  platform: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type AvailabilityData = z.infer<typeof availabilitySchema>;

export default function AvailabilityChecker() {
  const { toast } = useToast();
  const [result, setResult] = useState<{
    available: boolean;
    conflicts: Contract[];
    suggestions?: { territories: string[]; platforms: string[] };
  } | null>(null);
  const [viewContract, setViewContract] = useState<Contract | null>(null);

  const form = useForm<AvailabilityData>({
    resolver: zodResolver(availabilitySchema),
    defaultValues: {
      partner: "",
      territory: "",
      platform: "",
      startDate: "",
      endDate: "",
    },
  });

  const checkAvailabilityMutation = useMutation({
    mutationFn: async (data: AvailabilityData) => {
      const response = await apiRequest("POST", "/api/availability/check", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setResult(data);
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

  const onSubmit = (data: AvailabilityData) => {
    // Convert "Any" to empty string so backend doesn't filter on it
    const searchData = {
      ...data,
      territory: data.territory === "Any" ? "" : data.territory,
      platform: data.platform === "Any" ? "" : data.platform,
    };
    checkAvailabilityMutation.mutate(searchData);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader>
          <CardTitle>Search Criteria</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="partner"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter partner name..." 
                        data-testid="input-partner"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="territory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Territory</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Any"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-territory">
                          <SelectValue placeholder="Select Territory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TERRITORY_OPTIONS.map((territory) => (
                          <SelectItem key={territory} value={territory}>
                            {territory}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Any"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-platform">
                          <SelectValue placeholder="Select Platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PLATFORM_OPTIONS.map((platform) => (
                          <SelectItem key={platform} value={platform}>
                            {platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        data-testid="input-start-date"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        data-testid="input-end-date"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-end">
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={checkAvailabilityMutation.isPending}
                  data-testid="button-check"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {checkAvailabilityMutation.isPending ? "Checking..." : "Check Availability"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Rights Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`border rounded-lg p-4 ${
              result.conflicts.length === 0 
                ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' 
                : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-semibold ${
                    result.conflicts.length === 0 ? 'text-green-800 dark:text-green-200' : 'text-blue-800 dark:text-blue-200'
                  }`} data-testid="availability-status">
                    {result.conflicts.length === 0 ? 'No Existing Contracts' : 'Existing Contracts Found'}
                  </h4>
                  <p className={`${
                    result.conflicts.length === 0 ? 'text-green-700 dark:text-green-300' : 'text-blue-700 dark:text-blue-300'
                  }`}>
                    {result.conflicts.length === 0 
                      ? 'No existing contracts found for this partner, territory, and time period.'
                      : `Found ${result.conflicts.length} existing contract(s) for this combination.`
                    }
                  </p>
                </div>
                <CheckCircle className={`h-8 w-8 ${
                  result.conflicts.length === 0 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'
                }`} />
              </div>
            </div>

            {result.conflicts.length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Existing Contracts</h4>
                <div className="space-y-3">
                  {result.conflicts.map((contract: Contract) => (
                    <div key={contract.id} className="bg-background p-4 rounded border" data-testid={`existing-contract-${contract.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground">{contract.partner}</p>
                            {contract.exclusivity === "Exclusive" && (
                              <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-300">
                                Exclusive
                              </Badge>
                            )}
                            <Badge variant="outline" className={
                              contract.status === "Active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                              contract.status === "In Perpetuity" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" :
                              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }>
                              {contract.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{contract.licensee}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span>{contract.territory}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Monitor className="h-3 w-3" />
                              <span>{contract.platform}</span>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(contract.startDate)} - {contract.autoRenew ? 'Auto-renew' : formatDate(contract.endDate)}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewContract(contract)}
                          data-testid={`button-view-contract-${contract.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3">Search Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Existing Contracts:</span>
                  <span className="text-foreground font-medium" data-testid="territory-coverage">
                    {result.conflicts.length} found
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Exclusive Deals:</span>
                  <span className="text-foreground font-medium" data-testid="date-coverage">
                    {result.conflicts.filter((c: Contract) => c.exclusivity === "Exclusive").length} found
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Non-Exclusive Deals:</span>
                  <span className="text-foreground font-medium" data-testid="platform-rights">
                    {result.conflicts.filter((c: Contract) => c.exclusivity !== "Exclusive").length} found
                  </span>
                </div>
              </div>
            </div>

            {/* Alternative Suggestions - only shown when exclusive rights are found */}
            {result.suggestions && (
              <div className="border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-3">Alternative Options Available</h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  Exclusive rights exist for the searched combination. Consider these alternatives:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.suggestions.territories.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Available Territories:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.suggestions.territories.map((territory) => (
                          <span 
                            key={territory} 
                            className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-1 rounded"
                          >
                            {territory}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.suggestions.platforms.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">Available Platforms:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.suggestions.platforms.map((platform) => (
                          <span 
                            key={platform} 
                            className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 px-2 py-1 rounded"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contract Detail Dialog */}
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
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="text-sm">
                    <Badge variant="outline" className={
                      viewContract.status === "Active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                      viewContract.status === "In Perpetuity" ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" :
                      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                    }>
                      {viewContract.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Licensor</label>
                  <p className="text-sm">{viewContract.licensor || "N/A"}</p>
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
                  <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                  <p className="text-sm">{formatDate(viewContract.startDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">End Date</label>
                  <p className="text-sm">{viewContract.autoRenew ? 'Auto-renew' : formatDate(viewContract.endDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Exclusivity</label>
                  <p className="text-sm">{viewContract.exclusivity}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Royalty Type</label>
                  <p className="text-sm">{viewContract.royaltyType}</p>
                </div>
                {viewContract.royaltyType === "Revenue Share" && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Royalty Rate</label>
                    <p className="text-sm">{viewContract.royaltyRate}%</p>
                  </div>
                )}
                {viewContract.royaltyType === "Flat Fee" && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Flat Fee</label>
                    <p className="text-sm">${viewContract.flatFeeAmount}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Minimum Payment</label>
                  <p className="text-sm">{viewContract.minimumPayment ? `$${viewContract.minimumPayment}` : "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Payment Terms</label>
                  <p className="text-sm">{viewContract.paymentTerms || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
