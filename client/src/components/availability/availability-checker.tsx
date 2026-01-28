import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Search, CheckCircle, XCircle } from "lucide-react";

const PREDEFINED_PLATFORMS = ["SVOD", "TVOD", "AVOD", "FAST", "Linear"];

const availabilitySchema = z.object({
  partner: z.string().min(1, "Partner name is required"),
  territory: z.string().min(1, "Territory is required"),
  platform: z.string().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type AvailabilityData = z.infer<typeof availabilitySchema>;

export default function AvailabilityChecker() {
  const { toast } = useToast();
  const [result, setResult] = useState<{
    available: boolean;
    conflicts: any[];
    suggestions?: { territories: string[]; platforms: string[] };
  } | null>(null);
  const [platformType, setPlatformType] = useState<"predefined" | "custom">("predefined");
  const [customPlatform, setCustomPlatform] = useState<string>("");

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
    // Use custom platform if that's what the user selected
    const finalData = {
      ...data,
      platform: platformType === "custom" ? customPlatform : data.platform,
    };
    checkAvailabilityMutation.mutate(finalData);
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
                    <FormLabel>Partner</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-territory">
                          <SelectValue placeholder="Select Territory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Global">Global</SelectItem>
                        <SelectItem value="US">US</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="UK">UK</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          if (value === "custom") {
                            setPlatformType("custom");
                            field.onChange("");
                          } else {
                            setPlatformType("predefined");
                            setCustomPlatform("");
                            field.onChange(value);
                          }
                        }} 
                        value={platformType === "custom" ? "custom" : field.value ?? undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-platform">
                            <SelectValue placeholder="Select Platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PREDEFINED_PLATFORMS.map((platform) => (
                            <SelectItem key={platform} value={platform}>
                              {platform}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {platformType === "custom" && (
                  <div className="pt-2">
                    <Input 
                      placeholder="Enter custom platform" 
                      data-testid="input-custom-platform"
                      value={customPlatform}
                      onChange={(e) => setCustomPlatform(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
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
                    <FormLabel>End Date</FormLabel>
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
                ? 'border-green-200 bg-green-50' 
                : 'border-blue-200 bg-blue-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-semibold ${
                    result.conflicts.length === 0 ? 'text-green-800' : 'text-blue-800'
                  }`} data-testid="availability-status">
                    {result.conflicts.length === 0 ? 'No Existing Contracts' : 'Existing Contracts Found'}
                  </h4>
                  <p className={`${
                    result.conflicts.length === 0 ? 'text-green-700' : 'text-blue-700'
                  }`}>
                    {result.conflicts.length === 0 
                      ? 'No existing contracts found for this partner, territory, and time period.'
                      : `Found ${result.conflicts.length} existing contract(s) for this combination. Rights can overlap with multiple partners.`
                    }
                  </p>
                </div>
                <CheckCircle className={`h-8 w-8 ${
                  result.conflicts.length === 0 ? 'text-green-600' : 'text-blue-600'
                }`} />
              </div>
            </div>

            {result.conflicts.length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Existing Contracts</h4>
                <div className="space-y-2">
                  {result.conflicts.map((contract: any) => (
                    <div key={contract.id} className="bg-background p-3 rounded border" data-testid={`existing-contract-${contract.id}`}>
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-foreground">{contract.partner}</p>
                        {contract.exclusivity === "Exclusive" && (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Exclusive</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {contract.licensee} • {contract.startDate} to {contract.autoRenew ? 'Auto-renew' : contract.endDate}
                      </p>
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
                    {result.conflicts.filter((c: any) => c.exclusivity === "Exclusive").length} found
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Non-Exclusive Deals:</span>
                  <span className="text-foreground font-medium" data-testid="platform-rights">
                    {result.conflicts.filter((c: any) => c.exclusivity !== "Exclusive").length} found
                  </span>
                </div>
              </div>
            </div>

            {/* Alternative Suggestions - only shown when exclusive rights are found */}
            {result.suggestions && (
              <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 mb-3">Alternative Options Available</h4>
                <p className="text-sm text-amber-700 mb-3">
                  Exclusive rights exist for the searched combination. Consider these alternatives:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.suggestions.territories.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-2">Available Territories:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.suggestions.territories.map((territory) => (
                          <span 
                            key={territory} 
                            className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded"
                          >
                            {territory}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.suggestions.platforms.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-amber-800 mb-2">Available Platforms:</p>
                      <div className="flex flex-wrap gap-1">
                        {result.suggestions.platforms.map((platform) => (
                          <span 
                            key={platform} 
                            className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded"
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
    </div>
  );
}
