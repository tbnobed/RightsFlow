import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Calculator, Check } from "lucide-react";

const calculatorSchema = z.object({
  contractId: z.string().min(1, "Contract is required"),
  revenue: z.string().min(1, "Revenue is required"),
  reportingPeriod: z.string().min(1, "Reporting period is required"),
});

type CalculatorData = z.infer<typeof calculatorSchema>;

interface RoyaltyCalculatorProps {
  onCalculated?: () => void;
  initialPartner?: string | null;
}

export default function RoyaltyCalculator({ onCalculated, initialPartner }: RoyaltyCalculatorProps) {
  const { toast } = useToast();
  const [calculation, setCalculation] = useState<{
    revenue: number;
    royaltyRate: number;
    grossRoyalty: number;
    netRoyalty: number;
  } | null>(null);

  const form = useForm<CalculatorData>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      contractId: "",
      revenue: "",
      reportingPeriod: "",
    },
  });

  const { data: contracts } = useQuery({
    queryKey: ["/api/contracts"],
    select: (data) => Array.isArray(data) ? data.filter((contract: any) => 
      contract.status === "Active" || contract.status === "In Perpetuity"
    ) : [],
  });

  // Pre-select contract based on initial partner
  useEffect(() => {
    if (initialPartner && contracts && contracts.length > 0) {
      const matchingContract = contracts.find((c: any) => c.partner === initialPartner);
      if (matchingContract) {
        form.setValue("contractId", matchingContract.id);
      }
    }
  }, [initialPartner, contracts, form]);

  const selectedContract = contracts?.find((c: any) => c.id === form.watch("contractId"));

  const calculateRoyaltyMutation = useMutation({
    mutationFn: async (data: CalculatorData) => {
      const royaltyAmount = (parseFloat(data.revenue) * (parseFloat(selectedContract?.royaltyRate || "0") / 100)).toFixed(2);
      
      return await apiRequest("POST", "/api/royalties", {
        contractId: data.contractId,
        revenue: data.revenue,
        royaltyAmount,
        reportingPeriod: data.reportingPeriod,
        status: "Pending",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Royalty calculated and saved successfully",
      });
      form.reset();
      setCalculation(null);
      onCalculated?.();
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

  const handleCalculate = () => {
    const revenue = parseFloat(form.getValues("revenue"));
    const royaltyRate = parseFloat(selectedContract?.royaltyRate || "0");
    
    if (!revenue || !royaltyRate) {
      toast({
        title: "Error",
        description: "Please select a contract and enter revenue amount",
        variant: "destructive",
      });
      return;
    }

    const grossRoyalty = revenue * (royaltyRate / 100);
    const netRoyalty = grossRoyalty * 0.9; // Assuming 10% deduction

    setCalculation({
      revenue,
      royaltyRate,
      grossRoyalty,
      netRoyalty,
    });
  };

  const onSubmit = (data: CalculatorData) => {
    if (!calculation) {
      handleCalculate();
      return;
    }
    calculateRoyaltyMutation.mutate(data);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Calculate Royalties</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="contractId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-contract">
                          <SelectValue placeholder="Select Contract" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contracts?.map((contract: any) => (
                          <SelectItem key={contract.id} value={contract.id}>
                            {contract.partner} - {contract.licensee}
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
                name="revenue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue Amount</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="0.00" 
                        data-testid="input-revenue"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reportingPeriod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reporting Period</FormLabel>
                    <FormControl>
                      <Input 
                        type="month" 
                        data-testid="input-period"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type={calculation ? "submit" : "button"}
                onClick={calculation ? undefined : handleCalculate}
                className="w-full"
                disabled={calculateRoyaltyMutation.isPending}
                data-testid="button-calculate"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {calculation ? "Save Calculation" : "Calculate Royalties"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calculation Result</CardTitle>
        </CardHeader>
        <CardContent>
          {calculation ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                    <p className="text-xl font-semibold text-foreground" data-testid="calc-revenue">
                      ${calculation.revenue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Royalty Rate</p>
                    <p className="text-xl font-semibold text-foreground" data-testid="calc-rate">
                      {calculation.royaltyRate}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gross Royalty</p>
                    <p className="text-xl font-semibold text-foreground" data-testid="calc-gross">
                      ${calculation.grossRoyalty.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Net Royalty</p>
                    <p className="text-xl font-semibold text-green-600" data-testid="calc-net">
                      ${calculation.netRoyalty.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Select a contract and enter revenue to see calculation</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
