import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractSchema } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
// import { ObjectUploader } from "@/components/ObjectUploader"; // Temporarily disabled
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
// import type { UploadResult } from "@uppy/core"; // Temporarily disabled

const formSchema = insertContractSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
});

type FormData = z.infer<typeof formSchema>;

interface ContractFormProps {
  contractId?: string;
  onSuccess?: () => void;
}

export default function ContractForm({ contractId, onSuccess }: ContractFormProps) {
  const { toast } = useToast();
  const [documentUrl, setDocumentUrl] = useState<string>("");

  // Fetch existing contract data if editing
  const { data: existingContract } = useQuery({
    queryKey: ["/api/contracts", contractId],
    queryFn: async () => {
      if (!contractId) return null;
      const response = await fetch(`/api/contracts/${contractId}`);
      if (!response.ok) throw new Error('Failed to fetch contract');
      return response.json();
    },
    enabled: !!contractId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ipName: "",
      licensor: "",
      licensee: "",
      territory: "",
      platform: "",
      startDate: "",
      endDate: "",
      royaltyRate: "0",
      exclusivity: "Non-Exclusive",
      status: "Pending",
    },
  });

  // Update form when existing contract data loads
  useEffect(() => {
    if (existingContract && contractId) {
      form.reset({
        ipName: existingContract.ipName || "",
        licensor: existingContract.licensor || "",
        licensee: existingContract.licensee || "",
        territory: existingContract.territory || "",
        platform: existingContract.platform || "",
        startDate: existingContract.startDate || "",
        endDate: existingContract.endDate || "",
        royaltyRate: existingContract.royaltyRate || "0",
        exclusivity: existingContract.exclusivity || "Non-Exclusive",
        status: existingContract.status || "Pending",
      });
      setDocumentUrl(existingContract.contractDocumentUrl || "");
    }
  }, [existingContract, contractId, form]);

  const createContractMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (contractId) {
        return await apiRequest("PUT", `/api/contracts/${contractId}`, data);
      } else {
        return await apiRequest("POST", "/api/contracts", data);
      }
    },
    onSuccess: async (response) => {
      const contract = await response.json();
      
      // If document was uploaded, attach it to the contract
      if (documentUrl) {
        await apiRequest("PUT", `/api/contracts/${contract.id}/document`, {
          documentURL: documentUrl,
        });
      }
      
      toast({
        title: "Success",
        description: contractId ? "Contract updated successfully" : "Contract created successfully",
      });
      form.reset();
      setDocumentUrl("");
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getUploadParameters = async () => {
    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Failed to get upload URL');
    const { uploadURL } = await response.json();
    return {
      method: 'PUT' as const,
      url: uploadURL,
    };
  };

  // Temporarily disabled file upload functionality
  // const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
  //   if (result.successful.length > 0) {
  //     const uploadURL = result.successful[0].uploadURL as string;
  //     setDocumentUrl(uploadURL);
  //     toast({
  //       title: "Success",
  //       description: "Document uploaded successfully",
  //     });
  //   }
  // };

  const onSubmit = (data: FormData) => {
    createContractMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="ipName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IP Name *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter intellectual property name" 
                      data-testid="input-ip-name"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="licensor"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licensor *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter licensor name" 
                    data-testid="input-licensor"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="licensee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licensee *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter licensee name" 
                    data-testid="input-licensee"
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
                <FormLabel>Territory *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormLabel>Platform *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-platform">
                      <SelectValue placeholder="Select Platform" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Streaming">Streaming</SelectItem>
                    <SelectItem value="TV Broadcast">TV Broadcast</SelectItem>
                    <SelectItem value="Movie Theater">Movie Theater</SelectItem>
                    <SelectItem value="Digital Download">Digital Download</SelectItem>
                    <SelectItem value="Music Streaming">Music Streaming</SelectItem>
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

          <FormField
            control={form.control}
            name="royaltyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Royalty Rate (%)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    data-testid="input-royalty-rate"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="exclusivity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exclusivity</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-exclusivity">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Non-Exclusive">Non-Exclusive</SelectItem>
                    <SelectItem value="Exclusive">Exclusive</SelectItem>
                    <SelectItem value="Limited Exclusive">Limited Exclusive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="md:col-span-2">
            <FormLabel>Contract Document</FormLabel>
            <div className="mt-2">
              {/* Temporarily disabled file upload functionality */}
              <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted rounded-lg text-muted-foreground">
                <span>📁</span>
                <span>File upload temporarily disabled for testing</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => form.reset()}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={createContractMutation.isPending}
            data-testid="button-create"
          >
            {createContractMutation.isPending ? "Creating..." : "Create Contract"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
