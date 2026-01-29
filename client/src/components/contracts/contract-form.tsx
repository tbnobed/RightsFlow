import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractSchema, type ContentItem } from "@shared/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, X, Film, Tv, Radio, FileVideo, Upload, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRef, type ChangeEvent } from "react";

function getContentIcon(type: string) {
  switch (type) {
    case "Film":
      return <Film className="h-3 w-3" />;
    case "TV Series":
      return <Tv className="h-3 w-3" />;
    case "TBN FAST":
    case "WoF FAST":
      return <Radio className="h-3 w-3" />;
    case "TBN Linear":
      return <FileVideo className="h-3 w-3" />;
    default:
      return <Film className="h-3 w-3" />;
  }
}

const formSchema = insertContractSchema.extend({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  autoRenew: z.boolean().optional().default(false),
}).refine(
  (data) => data.autoRenew || (data.endDate && data.endDate.length > 0),
  {
    message: "End date is required when auto-renew is not enabled",
    path: ["endDate"],
  }
);

type FormData = z.infer<typeof formSchema>;

interface ContractFormProps {
  contractId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PREDEFINED_PLATFORMS = ["FAST", "VOD", "TVOD", "SVOD", "AVOD", "Linear"];

type ContractStatus = "Active" | "Expired" | "In Perpetuity" | "Terminated";

function getComputedStatus(contract: { status?: string | null; endDate?: string | null; autoRenew?: boolean | null }): ContractStatus {
  if (contract.status === 'Terminated') return 'Terminated';
  if (contract.status === 'In Perpetuity') return 'In Perpetuity';
  if (contract.autoRenew) {
    return (contract.status as ContractStatus) || 'Active';
  }
  if (contract.endDate) {
    const endDate = new Date(contract.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    if (endDate < today) {
      return 'Expired';
    }
  }
  return (contract.status as ContractStatus) || 'Active';
}

export default function ContractForm({ contractId, onSuccess, onCancel }: ContractFormProps) {
  const { toast } = useToast();
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [isAmendment, setIsAmendment] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [autoRenew, setAutoRenew] = useState<boolean>(false);
  const [royaltyType, setRoyaltyType] = useState<"Revenue Share" | "Flat Fee">("Revenue Share");
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [otherTerritory, setOtherTerritory] = useState<string>("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [otherPlatform, setOtherPlatform] = useState<string>("");
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);

  const TERRITORY_OPTIONS = ["Global", "US", "Canada", "UK"];

  const { data: allContentItems = [] } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const { data: existingLinkedContent = [] } = useQuery<{ contentId: string }[]>({
    queryKey: ["/api/contracts", contractId, "content"],
    queryFn: async () => {
      if (!contractId) return [];
      const response = await fetch(`/api/contracts/${contractId}/content`);
      if (!response.ok) throw new Error("Failed to fetch linked content");
      return response.json();
    },
    enabled: !!contractId,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      partner: "",
      licensor: "",
      licensee: "",
      territory: "",
      platform: "",
      startDate: "",
      endDate: "",
      royaltyType: "Revenue Share",
      royaltyRate: "0",
      flatFeeAmount: "",
      exclusivity: "Non-Exclusive",
      status: "Active",
      reportingFrequency: "None",
      paymentTerms: "Net 30",
      minimumPayment: "",
      parentContractId: null,
      autoRenew: false,
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
        startDate: existingContract.startDate || "",
        endDate: existingContract.endDate || "",
        royaltyType: existingContract.royaltyType || "Revenue Share",
        royaltyRate: existingContract.royaltyRate || "0",
        flatFeeAmount: existingContract.flatFeeAmount || "",
        exclusivity: existingContract.exclusivity || "Non-Exclusive",
        status: existingContract.status || "Active",
        reportingFrequency: existingContract.reportingFrequency || "None",
        paymentTerms: existingContract.paymentTerms || "Net 30",
        minimumPayment: existingContract.minimumPayment || "",
        parentContractId: existingContract.parentContractId || null,
        autoRenew: existingContract.autoRenew || false,
      });
      setRoyaltyType(existingContract.royaltyType || "Revenue Share");
      
      setDocumentUrl(existingContract.contractDocumentUrl || "");
      setIsAmendment(!!existingContract.parentContractId);
      setAutoRenew(existingContract.autoRenew || false);
      
      // Parse existing territory for multi-select
      if (existingContract.territory) {
        const territories = existingContract.territory.split(",").map((t: string) => t.trim());
        const predefined = territories.filter((t: string) => TERRITORY_OPTIONS.includes(t));
        const other = territories.filter((t: string) => !TERRITORY_OPTIONS.includes(t)).join(", ");
        setSelectedTerritories(predefined);
        setOtherTerritory(other);
      }
      
      // Parse existing platforms for multi-select
      if (existingContract.platform) {
        const platforms = existingContract.platform.split(",").map((p: string) => p.trim());
        const predefined = platforms.filter((p: string) => PREDEFINED_PLATFORMS.includes(p));
        const other = platforms.filter((p: string) => !PREDEFINED_PLATFORMS.includes(p)).join(", ");
        setSelectedPlatforms(predefined);
        setOtherPlatform(other);
      }
    }
  }, [existingContract, contractId, form]);

  // Load existing linked content when editing
  useEffect(() => {
    if (existingLinkedContent.length > 0) {
      setSelectedContentIds(existingLinkedContent.map(c => c.contentId));
    }
  }, [existingLinkedContent]);

  // Sync selected territories with form field
  useEffect(() => {
    const allTerritories = [...selectedTerritories];
    if (otherTerritory.trim()) {
      allTerritories.push(otherTerritory.trim());
    }
    form.setValue("territory", allTerritories.join(", "));
  }, [selectedTerritories, otherTerritory, form]);

  // Sync selected platforms with form field
  useEffect(() => {
    const allPlatforms = [...selectedPlatforms];
    if (otherPlatform.trim()) {
      allPlatforms.push(otherPlatform.trim());
    }
    form.setValue("platform", allPlatforms.join(", "));
  }, [selectedPlatforms, otherPlatform, form]);

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
      const targetContractId = contractId || contract.id;
      
      // Upload document if a file was selected
      if (selectedFile) {
        setIsUploading(true);
        try {
          const formData = new window.FormData();
          formData.append('file', selectedFile);
          
          const uploadResponse = await fetch(`/api/contracts/${targetContractId}/upload`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          
          if (!uploadResponse.ok) {
            throw new Error('Failed to upload document');
          }
          
          const uploadResult = await uploadResponse.json();
          setDocumentUrl(uploadResult.filePath);
          
          toast({
            title: "Document Uploaded",
            description: "Contract document uploaded successfully",
          });
        } catch (error) {
          toast({
            title: "Upload Error",
            description: "Failed to upload document, but contract was saved",
            variant: "destructive",
          });
        } finally {
          setIsUploading(false);
        }
      }
      
      // Handle content linking
      const existingIds = existingLinkedContent.map(c => c.contentId);
      const toLink = selectedContentIds.filter(id => !existingIds.includes(id));
      const toUnlink = existingIds.filter(id => !selectedContentIds.includes(id));
      
      // Link new content
      for (const contentId of toLink) {
        await apiRequest("POST", `/api/contracts/${targetContractId}/content`, { contentId });
      }
      
      // Unlink removed content
      for (const contentId of toUnlink) {
        await apiRequest("DELETE", `/api/contracts/${targetContractId}/content/${contentId}`);
      }
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", targetContractId, "content"] });
      
      toast({
        title: "Success",
        description: contractId ? "Contract updated successfully" : "Contract created successfully",
      });
      form.reset();
      setDocumentUrl("");
      setSelectedFile(null);
      setAutoRenew(false);
      setRoyaltyType("Revenue Share");
      setSelectedTerritories([]);
      setOtherTerritory("");
      setSelectedPlatforms([]);
      setOtherPlatform("");
      setSelectedContentIds([]);
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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: "Maximum file size is 50MB",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const onSubmit = (data: FormData) => {
    const finalData = {
      ...data,
      autoRenew: autoRenew,
      endDate: autoRenew ? undefined : data.endDate,
      royaltyRate: data.royaltyRate && data.royaltyRate !== "" ? data.royaltyRate : null,
      flatFeeAmount: data.flatFeeAmount && data.flatFeeAmount !== "" ? data.flatFeeAmount : null,
      minimumPayment: data.minimumPayment && data.minimumPayment !== "" ? data.minimumPayment : null,
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
            render={() => (
              <FormItem>
                <FormLabel>Territory *</FormLabel>
                <div className="space-y-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        data-testid="select-territory"
                      >
                        {selectedTerritories.length > 0
                          ? selectedTerritories.join(", ")
                          : "Select territories..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-3">
                      <div className="space-y-2">
                        {TERRITORY_OPTIONS.map((territory) => (
                          <div key={territory} className="flex items-center space-x-2">
                            <Checkbox
                              id={`territory-${territory}`}
                              checked={selectedTerritories.includes(territory)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTerritories([...selectedTerritories, territory]);
                                } else {
                                  setSelectedTerritories(selectedTerritories.filter(t => t !== territory));
                                }
                              }}
                              data-testid={`checkbox-territory-${territory.toLowerCase()}`}
                            />
                            <Label htmlFor={`territory-${territory}`} className="text-sm cursor-pointer">
                              {territory}
                            </Label>
                          </div>
                        ))}
                        <div className="border-t pt-2 mt-2">
                          <Label className="text-xs text-muted-foreground">Other territories</Label>
                          <Input
                            placeholder="e.g., Australia, Germany"
                            value={otherTerritory}
                            onChange={(e) => setOtherTerritory(e.target.value)}
                            className="mt-1"
                            data-testid="input-other-territory"
                          />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="platform"
            render={() => (
              <FormItem>
                <FormLabel>Platform</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                      data-testid="select-platform"
                    >
                      {selectedPlatforms.length > 0 || otherPlatform
                        ? [...selectedPlatforms, otherPlatform].filter(Boolean).join(", ")
                        : "Select platforms..."}
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-3">
                    <div className="space-y-2">
                      {PREDEFINED_PLATFORMS.map((platform) => (
                        <div key={platform} className="flex items-center space-x-2">
                          <Checkbox
                            id={`platform-${platform}`}
                            checked={selectedPlatforms.includes(platform)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedPlatforms([...selectedPlatforms, platform]);
                              } else {
                                setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
                              }
                            }}
                            data-testid={`checkbox-platform-${platform.toLowerCase()}`}
                          />
                          <Label htmlFor={`platform-${platform}`} className="text-sm cursor-pointer">
                            {platform}
                          </Label>
                        </div>
                      ))}
                      <div className="border-t pt-2 mt-2">
                        <Label className="text-xs text-muted-foreground">Other platform</Label>
                        <Input
                          placeholder="e.g., Cable, Satellite"
                          value={otherPlatform}
                          onChange={(e) => setOtherPlatform(e.target.value)}
                          className="mt-1"
                          data-testid="input-other-platform"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
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

          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="autoRenew"
                checked={autoRenew}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setAutoRenew(isChecked);
                  form.setValue("autoRenew", isChecked);
                  if (isChecked) {
                    form.setValue("endDate", "");
                    form.clearErrors("endDate");
                    form.setValue("status", "In Perpetuity");
                  }
                }}
                data-testid="checkbox-auto-renew"
              />
              <Label htmlFor="autoRenew" className="text-sm font-medium cursor-pointer">
                Auto-renew (no fixed end date)
              </Label>
            </div>
            
            {!autoRenew && (
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
            )}
          </div>

          <div className="space-y-3">
            <FormField
              control={form.control}
              name="royaltyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Royalty Type</FormLabel>
                  <Select 
                    onValueChange={(value: "Revenue Share" | "Flat Fee") => {
                      field.onChange(value);
                      setRoyaltyType(value);
                    }} 
                    value={field.value ?? "Revenue Share"}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-royalty-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Revenue Share">Revenue Share</SelectItem>
                      <SelectItem value="Flat Fee">Flat Fee</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {royaltyType === "Revenue Share" ? (
              <FormField
                control={form.control}
                name="royaltyRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Revenue Share (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g., 50 for 50/50 split" 
                        data-testid="input-royalty-rate"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Partner's share of revenue (e.g., 50 = 50/50, 70 = 70/30)</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="flatFeeAmount"
                render={() => (
                  <FormItem>
                    <FormLabel>Flat Fee Amount ($)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        data-testid="input-flat-fee"
                        value={form.getValues("flatFeeAmount") || ""}
                        onChange={(e) => {
                          form.setValue("flatFeeAmount", e.target.value, { shouldValidate: true });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="exclusivity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exclusivity</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "Non-Exclusive"}>
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
                <Select onValueChange={field.onChange} value={field.value || "Active"}>
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
                <Select onValueChange={field.onChange} value={field.value || "None"}>
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

          <FormField
            control={form.control}
            name="paymentTerms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Terms</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "Net 30"}>
                  <FormControl>
                    <SelectTrigger data-testid="select-payment-terms">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Net 30">Net 30</SelectItem>
                    <SelectItem value="Net 60">Net 60</SelectItem>
                    <SelectItem value="Net 90">Net 90</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="minimumPayment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Minimum Payment Threshold ($)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    step="0.01" 
                    placeholder="Leave empty if none" 
                    data-testid="input-minimum-payment"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Partner can withhold payment until this threshold is met</p>
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
            <Label>Linked Content (Optional)</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Select content items to associate with this contract
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  type="button"
                  data-testid="button-select-content"
                >
                  <span>
                    {selectedContentIds.length === 0 
                      ? "Select content..." 
                      : `${selectedContentIds.length} content item${selectedContentIds.length > 1 ? 's' : ''} selected`}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-2" align="start">
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {allContentItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">No content items available</p>
                  ) : (
                    allContentItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                        onClick={() => {
                          if (selectedContentIds.includes(item.id)) {
                            setSelectedContentIds(prev => prev.filter(id => id !== item.id));
                          } else {
                            setSelectedContentIds(prev => [...prev, item.id]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedContentIds.includes(item.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContentIds(prev => [...prev, item.id]);
                            } else {
                              setSelectedContentIds(prev => prev.filter(id => id !== item.id));
                            }
                          }}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          {getContentIcon(item.type)}
                          <span className="text-sm">{item.title}</span>
                          <Badge variant="outline" className="text-xs">{item.type}</Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            {selectedContentIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedContentIds.map(id => {
                  const item = allContentItems.find(c => c.id === id);
                  if (!item) return null;
                  return (
                    <Badge 
                      key={id} 
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {getContentIcon(item.type)}
                      {item.title}
                      <X 
                        className="h-3 w-3 cursor-pointer ml-1" 
                        onClick={() => setSelectedContentIds(prev => prev.filter(cid => cid !== id))}
                      />
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <FormLabel>Contract Document</FormLabel>
            <div className="mt-2">
              <input
                type="file"
                ref={fileInputRef}
                accept=".pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-contract-file"
              />
              
              {documentUrl && !selectedFile ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Current Document</p>
                    <a 
                      href={documentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      View Document
                    </a>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-replace-document"
                  >
                    Replace
                  </Button>
                </div>
              ) : selectedFile ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    data-testid="button-remove-file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-24 border-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-document"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload PDF or Word document
                    </span>
                  </div>
                </Button>
              )}
              
              {isUploading && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Uploading document...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              form.reset();
              setSelectedPlatforms([]);
              setOtherPlatform("");
              setSelectedTerritories([]);
              setOtherTerritory("");
              setSelectedContentIds([]);
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
