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
  onCancel?: () => void;
}

const PREDEFINED_PLATFORMS = ["Streaming", "TV Broadcast", "Movie Theater", "Digital Download", "Music Streaming"];

export default function ContractForm({ contractId, onSuccess, onCancel }: ContractFormProps) {
  const { toast } = useToast();
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [platformType, setPlatformType] = useState<"predefined" | "custom">("predefined");
  const [customPlatform, setCustomPlatform] = useState<string>("");
  const [isAmendment, setIsAmendment] = useState<boolean>(false);

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

  // Fetch all contracts for parent contract selector (amendments)
  const { data: allContracts } = useQuery<{ id: string; partner: string; content: string }[]>({
    queryKey: ["/api/contracts"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partner: "",
      licensor: "",
      licensee: "",
      territory: "",
      platform: "",
      content: "",
      startDate: "",
      endDate: "",
      royaltyRate: "0",
      exclusivity: "Non-Exclusive",
      status: "Active",
      reportingFrequency: "None",
      parentContractId: null,
    },
  });

  // Update form when existing contract data loads
  useEffect(() => {
    if (existingContract && contractId) {
      const existingPlatform = existingContract.platform || "";
      const isPredefined = PREDEFINED_PLATFORMS.includes(existingPlatform);
      
      form.reset({
        partner: existingContract.partner || "",
        licensor: existingContract.licensor || "",
        licensee: existingContract.licensee || "",
        territory: existingContract.territory || "",
        platform: isPredefined ? existingPlatform : "",
        content: existingContract.content || "",
        startDate: existingContract.startDate || "",
        endDate: existingContract.endDate || "",
        royaltyRate: existingContract.royaltyRate || "0",
        exclusivity: existingContract.exclusivity || "Non-Exclusive",
        status: existingContract.status || "Active",
        reportingFrequency: existingContract.reportingFrequency || "None",
        parentContractId: existingContract.parentContractId || null,
      });
      
      if (!isPredefined && existingPlatform) {
        setPlatformType("custom");
        setCustomPlatform(existingPlatform);
      } else {
        setPlatformType("predefined");
        setCustomPlatform("");
      }
      
      setDocumentUrl(existingContract.contractDocumentUrl || "");
      setIsAmendment(!!existingContract.parentContractId);
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
      setPlatformType("predefined");
      setCustomPlatform("");
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
    // Use custom platform if that's what the user selected
    const finalData = {
      ...data,
      platform: platformType === "custom" ? customPlatform : data.platform,
    };
    createContractMutation.mutate(finalData);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="partner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter partner name" 
                      data-testid="input-partner"
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
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Enter content details (optional)" 
                    data-testid="input-content"
                    {...field}
                    value={field.value ?? ""}
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
                    value={field.value ?? ""}
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
                <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
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

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? "Active"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Expired">Expired</SelectItem>
                    <SelectItem value="In Perpetuity">In Perpetuity</SelectItem>
                    <SelectItem value="Terminated">Terminated</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reportingFrequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Revenue Reporting Frequency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value ?? "None"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-reporting-frequency">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isAmendment"
                checked={isAmendment}
                onChange={(e) => {
                  setIsAmendment(e.target.checked);
                  if (!e.target.checked) {
                    form.setValue("parentContractId", null);
                  }
                }}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="checkbox-is-amendment"
              />
              <label htmlFor="isAmendment" className="text-sm font-medium">
                This is an amendment to an existing contract
              </label>
            </div>

            {isAmendment && (
              <FormField
                control={form.control}
                name="parentContractId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parent Contract</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value ?? undefined}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-parent-contract">
                          <SelectValue placeholder="Select parent contract" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allContracts
                          ?.filter(c => c.id !== contractId)
                          .map((contract) => (
                            <SelectItem key={contract.id} value={contract.id}>
                              {contract.partner} - {contract.content || "No content specified"}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

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
            onClick={() => {
              form.reset();
              setPlatformType("predefined");
              setCustomPlatform("");
              setIsAmendment(false);
              if (onCancel) {
                onCancel();
              }
            }}
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
