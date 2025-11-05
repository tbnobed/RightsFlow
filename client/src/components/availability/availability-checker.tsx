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

const availabilitySchema = z.object({
  partner: z.string().min(1, "Partner name is required"),
  territory: z.string().min(1, "Territory is required"),
  platform: z.string().min(1, "Platform is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type AvailabilityData = z.infer<typeof availabilitySchema>;

export default function AvailabilityChecker() {
  const { toast } = useToast();
  const [result, setResult] = useState<{
    available: boolean;
    conflicts: any[];
  } | null>(null);

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
    checkAvailabilityMutation.mutate(data);
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
                        <SelectItem value="North America">North America</SelectItem>
                        <SelectItem value="Europe">Europe</SelectItem>
                        <SelectItem value="Asia Pacific">Asia Pacific</SelectItem>
                        <SelectItem value="Latin America">Latin America</SelectItem>
                        <SelectItem value="Global">Global</SelectItem>
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
                    <FormControl>
                      <Input 
                        placeholder="Enter platform (optional)" 
                        data-testid="input-platform"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
            <CardTitle>Availability Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`border rounded-lg p-4 ${
              result.available 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-semibold ${
                    result.available ? 'text-green-800' : 'text-red-800'
                  }`} data-testid="availability-status">
                    {result.available ? 'Available' : 'Not Available'}
                  </h4>
                  <p className={`${
                    result.available ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {result.available 
                      ? 'The requested rights are available for the specified period and territory.'
                      : `Found ${result.conflicts.length} conflicting contract(s).`
                    }
                  </p>
                </div>
                {result.available ? (
                  <CheckCircle className="text-green-600 h-8 w-8" />
                ) : (
                  <XCircle className="text-red-600 h-8 w-8" />
                )}
              </div>
            </div>

            {result.conflicts.length > 0 && (
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-3">Conflicting Contracts</h4>
                <div className="space-y-2">
                  {result.conflicts.map((conflict: any) => (
                    <div key={conflict.id} className="bg-background p-3 rounded border" data-testid={`conflict-${conflict.id}`}>
                      <p className="font-medium text-foreground">{conflict.partner}</p>
                      <p className="text-sm text-muted-foreground">
                        {conflict.licensee} • {conflict.startDate} to {conflict.endDate}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-3">Analysis Summary</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Territory Coverage:</span>
                  <span className="text-foreground font-medium" data-testid="territory-coverage">
                    {result.available ? '100% Available' : 'Conflict Detected'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Date Range Coverage:</span>
                  <span className="text-foreground font-medium" data-testid="date-coverage">
                    {result.available ? '100% Available' : 'Overlap Detected'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Platform Rights:</span>
                  <span className="text-foreground font-medium" data-testid="platform-rights">
                    {result.available ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
