import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Film, Tv, Radio, Search, FileVideo, Eye, File } from "lucide-react";
import type { ContentItem, Contract } from "@shared/schema";
import { Link } from "wouter";

interface ContentContractLink {
  id: string;
  contractId: string;
  contentId: string;
  notes: string | null;
  createdAt: Date | null;
  contract: Contract;
}

const CONTENT_TYPES = ["Film", "TV Series", "TBN FAST", "TBN Linear", "WoF FAST"] as const;

function getContentIcon(type: string) {
  switch (type) {
    case "Film":
      return <Film className="h-4 w-4" />;
    case "TV Series":
      return <Tv className="h-4 w-4" />;
    case "TBN FAST":
    case "WoF FAST":
      return <Radio className="h-4 w-4" />;
    case "TBN Linear":
      return <FileVideo className="h-4 w-4" />;
    default:
      return <Film className="h-4 w-4" />;
  }
}

function getContentBadgeVariant(type: string): "default" | "secondary" | "outline" {
  switch (type) {
    case "Film":
      return "default";
    case "TV Series":
      return "secondary";
    default:
      return "outline";
  }
}

interface ContentFormData {
  title: string;
  type: string;
  description: string;
  season: string;
  episodeCount: string;
  releaseYear: string;
  genre: string;
  duration: string;
}

const emptyFormData: ContentFormData = {
  title: "",
  type: "",
  description: "",
  season: "",
  episodeCount: "",
  releaseYear: "",
  genre: "",
  duration: "",
};

export default function Content() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ContentItem | null>(null);
  const [viewItem, setViewItem] = useState<ContentItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [formData, setFormData] = useState<ContentFormData>(emptyFormData);

  const { data: contentItems = [], isLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/content"],
  });

  const { data: contentContracts = [] } = useQuery<ContentContractLink[]>({
    queryKey: ["/api/content", viewItem?.id, "contracts"],
    queryFn: async () => {
      if (!viewItem) return [];
      const response = await fetch(`/api/content/${viewItem.id}/contracts`);
      if (!response.ok) throw new Error("Failed to fetch content contracts");
      return response.json();
    },
    enabled: !!viewItem,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContentFormData) => {
      const payload = {
        title: data.title,
        type: data.type,
        description: data.description || null,
        season: data.season ? parseInt(data.season) : null,
        episodeCount: data.episodeCount ? parseInt(data.episodeCount) : null,
        releaseYear: data.releaseYear ? parseInt(data.releaseYear) : null,
        genre: data.genre || null,
        duration: data.duration ? parseInt(data.duration) : null,
      };
      return await apiRequest("POST", "/api/content", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setShowForm(false);
      setFormData(emptyFormData);
      toast({ title: "Success", description: "Content item created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create content item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContentFormData }) => {
      const payload = {
        title: data.title,
        type: data.type,
        description: data.description || null,
        season: data.season ? parseInt(data.season) : null,
        episodeCount: data.episodeCount ? parseInt(data.episodeCount) : null,
        releaseYear: data.releaseYear ? parseInt(data.releaseYear) : null,
        genre: data.genre || null,
        duration: data.duration ? parseInt(data.duration) : null,
      };
      return await apiRequest("PUT", `/api/content/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setShowForm(false);
      setEditingItem(null);
      setFormData(emptyFormData);
      toast({ title: "Success", description: "Content item updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update content item", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/content/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/content"] });
      setDeleteItem(null);
      toast({ title: "Success", description: "Content item deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete content item", variant: "destructive" });
    },
  });

  const handleOpenForm = (item?: ContentItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        type: item.type,
        description: item.description || "",
        season: item.season?.toString() || "",
        episodeCount: item.episodeCount?.toString() || "",
        releaseYear: item.releaseYear?.toString() || "",
        genre: item.genre || "",
        duration: item.duration?.toString() || "",
      });
    } else {
      setEditingItem(null);
      setFormData(emptyFormData);
    }
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.type) {
      toast({ title: "Error", description: "Title and type are required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const filteredItems = contentItems.filter((item) => {
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-6 space-y-6" data-testid="content-catalog-view">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Content Catalog</h1>
          <p className="text-muted-foreground">Manage your content library</p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenForm()} data-testid="button-add-content">
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Content" : "Add New Content"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter title"
                    data-testid="input-content-title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger data-testid="select-content-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                  data-testid="input-content-description"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="releaseYear">Release Year</Label>
                  <Input
                    id="releaseYear"
                    type="number"
                    value={formData.releaseYear}
                    onChange={(e) => setFormData({ ...formData, releaseYear: e.target.value })}
                    placeholder="2024"
                    data-testid="input-content-year"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genre">Genre</Label>
                  <Input
                    id="genre"
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    placeholder="Drama, Action, etc."
                    data-testid="input-content-genre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="120"
                    data-testid="input-content-duration"
                  />
                </div>
              </div>

              {(formData.type === "TV Series") && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="season">Season</Label>
                    <Input
                      id="season"
                      type="number"
                      value={formData.season}
                      onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                      placeholder="1"
                      data-testid="input-content-season"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="episodeCount">Episode Count</Label>
                    <Input
                      id="episodeCount"
                      type="number"
                      value={formData.episodeCount}
                      onChange={(e) => setFormData({ ...formData, episodeCount: e.target.value })}
                      placeholder="10"
                      data-testid="input-content-episodes"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-content"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : editingItem ? "Update" : "Create"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-content"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {CONTENT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>{type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery || typeFilter !== "all" 
            ? "No content items match your search criteria" 
            : "No content items yet. Add your first content to get started."}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id} data-testid={`row-content-${item.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getContentIcon(item.type)}
                      <span>{item.title}</span>
                      {item.type === "TV Series" && item.season && (
                        <span className="text-muted-foreground text-sm">
                          S{item.season} ({item.episodeCount || "?"} eps)
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getContentBadgeVariant(item.type)}>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.genre || "-"}</TableCell>
                  <TableCell>{item.releaseYear || "-"}</TableCell>
                  <TableCell>{item.duration ? `${item.duration} min` : "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewItem(item)}
                        data-testid={`button-view-content-${item.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenForm(item)}
                        data-testid={`button-edit-content-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteItem(item)}
                        data-testid={`button-delete-content-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewItem && getContentIcon(viewItem.type)}
              {viewItem?.title}
            </DialogTitle>
          </DialogHeader>
          {viewItem && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="text-sm">
                    <Badge variant={getContentBadgeVariant(viewItem.type)}>{viewItem.type}</Badge>
                  </p>
                </div>
                {viewItem.genre && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Genre</label>
                    <p className="text-sm">{viewItem.genre}</p>
                  </div>
                )}
                {viewItem.releaseYear && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Release Year</label>
                    <p className="text-sm">{viewItem.releaseYear}</p>
                  </div>
                )}
                {viewItem.duration && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Duration</label>
                    <p className="text-sm">{viewItem.duration} minutes</p>
                  </div>
                )}
                {viewItem.type === "TV Series" && viewItem.season && (
                  <>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Season</label>
                      <p className="text-sm">{viewItem.season}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Episodes</label>
                      <p className="text-sm">{viewItem.episodeCount || "-"}</p>
                    </div>
                  </>
                )}
              </div>
              
              {viewItem.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <p className="text-sm">{viewItem.description}</p>
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <label className="text-sm font-medium text-muted-foreground">Linked Contracts</label>
                
                {contentContracts.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {contentContracts.map((link) => (
                      <div 
                        key={link.id} 
                        className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2"
                        data-testid={`linked-contract-${link.contractId}`}
                      >
                        <div className="flex items-center gap-2">
                          <File className="h-4 w-4" />
                          <span className="text-sm font-medium">{link.contract.partner}</span>
                          <Badge variant="outline" className="text-xs">{link.contract.licensee}</Badge>
                          <span className="text-xs text-muted-foreground">{link.contract.territory}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            className={
                              link.contract.status === "Active" ? "bg-green-100 text-green-800" :
                              link.contract.status === "Expired" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-800"
                            }
                          >
                            {link.contract.status}
                          </Badge>
                          <Link href="/contracts">
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid={`button-go-to-contract-${link.contractId}`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-2">This content is not linked to any contracts yet.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteItem?.title}"? This will also remove it from any linked contracts. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
