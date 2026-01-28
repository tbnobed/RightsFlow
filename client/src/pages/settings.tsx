import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, History, Bell, Plus, Loader2, Send, Trash2, Pencil } from "lucide-react";
import { format } from "date-fns";
import AuditLog from "@/components/audit/audit-log";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  inviteStatus: string | null;
  createdAt: string;
};


export default function Settings() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("");
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("Sales");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  const [expiringEmail, setExpiringEmail] = useState("");
  const [expiringDays, setExpiringDays] = useState("30");
  const [revenueEmail, setRevenueEmail] = useState("");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
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
    
    if (user && user.role !== "Admin" && user.role !== "Sales Manager") {
      toast({
        title: "Access Denied",
        description: "Only administrators and sales managers can access settings.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, authLoading, user, toast]);

  useEffect(() => {
    if (user?.email) {
      setExpiringEmail(user.email);
      setRevenueEmail(user.email);
    }
    if (user?.role && !activeTab) {
      if (user.role === "Admin" || user.role === "Sales Manager") {
        setActiveTab("users");
      } else {
        setActiveTab("notifications");
      }
    }
  }, [user]);

  const canManageUsers = user?.role === "Admin" || user?.role === "Sales Manager";
  
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/auth/users"],
    enabled: canManageUsers,
  });

  const canViewAudit = user?.role === "Admin" || user?.role === "Sales Manager";

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/invite", {
        email: inviteEmail,
        firstName: inviteFirstName,
        lastName: inviteLastName,
        role: user?.role === "Sales Manager" ? "Sales" : inviteRole,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite Sent", description: `Invitation sent to ${inviteEmail}` });
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send invite", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/auth/users/${userId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Deleted", description: "User has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await apiRequest("PUT", `/api/auth/users/${userId}`, { role });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "User Updated", description: "User role has been updated" });
      setEditDialogOpen(false);
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update user", variant: "destructive" });
    },
  });

  const expiringMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/expiring-contracts", {
        recipientEmail: expiringEmail,
        recipientName: user?.firstName || "Team",
        daysThreshold: expiringDays,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Notification Sent", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send notification", variant: "destructive" });
    },
  });

  const revenueMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/notifications/revenue-reports-due", {
        recipientEmail: revenueEmail,
        recipientName: user?.firstName || "Team",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Notification Sent", description: data.message });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to send notification", variant: "destructive" });
    },
  });

  if (user?.role !== "Admin") {
    return null;
  }

  return (
    <div className="p-6 space-y-6" data-testid="settings-view">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage users, view audit logs, and configure notifications</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${user?.role === "Admin" ? "grid-cols-3" : "grid-cols-2"}`}>
          {(user?.role === "Admin" || user?.role === "Sales Manager") && (
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
          )}
          {canViewAudit && (
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Trail
            </TabsTrigger>
          )}
          {user?.role === "Admin" && (
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Manage system users and their roles</CardDescription>
              </div>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-invite-user">
                    <Plus className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          placeholder="John"
                          data-testid="input-invite-firstname"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          placeholder="Doe"
                          data-testid="input-invite-lastname"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="user@example.com"
                        data-testid="input-invite-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      {user?.role === "Sales Manager" ? (
                        <Input value="Sales" disabled data-testid="input-invite-role-fixed" />
                      ) : (
                        <Select value={inviteRole} onValueChange={setInviteRole}>
                          <SelectTrigger data-testid="select-invite-role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <Button
                      onClick={() => inviteMutation.mutate()}
                      disabled={inviteMutation.isPending || !inviteEmail || !inviteFirstName || !inviteLastName}
                      className="w-full"
                      data-testid="button-send-invite"
                    >
                      {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Send Invitation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                        <TableCell className="font-medium">
                          {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : '-'}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{u.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={u.isActive ? "default" : "outline"}>
                            {u.inviteStatus === "pending" ? "Pending" : u.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {u.id !== user?.id && user?.role === "Admin" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(u);
                                    setEditRole(u.role);
                                    setEditDialogOpen(true);
                                  }}
                                  data-testid={`button-edit-user-${u.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteUserMutation.mutate(u.id)}
                                  disabled={deleteUserMutation.isPending}
                                  data-testid={`button-delete-user-${u.id}`}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Input value={editingUser?.email || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger data-testid="select-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="Legal">Legal</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                      <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                      <SelectItem value="Sales">Sales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => editingUser && updateUserMutation.mutate({ userId: editingUser.id, role: editRole })}
                  disabled={updateUserMutation.isPending || !editRole}
                  className="w-full"
                  data-testid="button-save-user"
                >
                  {updateUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditLog filters={{}} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contract Expiration Alerts</CardTitle>
                <CardDescription>Send email notifications about expiring contracts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    value={expiringEmail}
                    onChange={(e) => setExpiringEmail(e.target.value)}
                    placeholder="email@example.com"
                    data-testid="input-expiring-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiration Threshold</Label>
                  <Select value={expiringDays} onValueChange={setExpiringDays}>
                    <SelectTrigger data-testid="select-expiring-days">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Within 7 Days</SelectItem>
                      <SelectItem value="14">Within 14 Days</SelectItem>
                      <SelectItem value="30">Within 30 Days</SelectItem>
                      <SelectItem value="60">Within 60 Days</SelectItem>
                      <SelectItem value="90">Within 90 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => expiringMutation.mutate()}
                  disabled={expiringMutation.isPending || !expiringEmail}
                  className="w-full"
                  data-testid="button-send-expiring"
                >
                  {expiringMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Expiration Alert
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Report Reminders</CardTitle>
                <CardDescription>Send reminders about expected revenue reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Recipient Email</Label>
                  <Input
                    type="email"
                    value={revenueEmail}
                    onChange={(e) => setRevenueEmail(e.target.value)}
                    placeholder="email@example.com"
                    data-testid="input-revenue-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Report Types</Label>
                  <p className="text-sm text-muted-foreground">
                    Includes contracts with Monthly, Quarterly, and Annual reporting
                  </p>
                </div>
                <Button
                  onClick={() => revenueMutation.mutate()}
                  disabled={revenueMutation.isPending || !revenueEmail}
                  className="w-full"
                  data-testid="button-send-revenue"
                >
                  {revenueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Report Reminder
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
