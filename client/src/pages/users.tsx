import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit2, Shield, ShieldOff, Mail, Trash2, Key, MoreVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const createUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["Admin", "Legal", "Finance", "Sales"]),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const inviteUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["Admin", "Legal", "Finance", "Sales"]),
});

const editUserSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  role: z.enum(["Admin", "Legal", "Finance", "Sales"]),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type CreateUserData = z.infer<typeof createUserSchema>;
type InviteUserData = z.infer<typeof inviteUserSchema>;
type EditUserData = z.infer<typeof editUserSchema>;
type ResetPasswordData = z.infer<typeof resetPasswordSchema>;

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  inviteStatus?: string;
}

export default function Users() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const createUserForm = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "Sales",
      password: "",
    },
  });

  const inviteUserForm = useForm<InviteUserData>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "Sales",
    },
  });

  const editUserForm = useForm<EditUserData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      role: "Sales",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
    },
  });

  // Fetch users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/auth/users"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: CreateUserData) => {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsCreateDialogOpen(false);
      createUserForm.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Invite user mutation
  const inviteUserMutation = useMutation({
    mutationFn: async (userData: InviteUserData) => {
      const response = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send invitation");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsInviteDialogOpen(false);
      inviteUserForm.reset();
      toast({
        title: "Success",
        description: data.resent 
          ? "Invitation resent successfully" 
          : "Invitation sent successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle user active status
  const toggleUserMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await fetch(`/api/auth/users/${userId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        throw new Error("Failed to update user status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({
        title: "Success",
        description: "User status updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    },
  });

  // Edit user mutation
  const editUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: EditUserData }) => {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsEditDialogOpen(false);
      editUserForm.reset();
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: string; password: string }) => {
      const response = await fetch(`/api/auth/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to reset password");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsResetPasswordDialogOpen(false);
      resetPasswordForm.reset();
      toast({
        title: "Success",
        description: "Password reset successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Send password reset link mutation
  const sendResetLinkMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/auth/users/${userId}/send-reset-link`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to send reset link");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password reset link sent to user's email",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onCreateUser = (data: CreateUserData) => {
    createUserMutation.mutate(data);
  };

  const onInviteUser = (data: InviteUserData) => {
    inviteUserMutation.mutate(data);
  };

  const handleToggleUser = (userId: string, currentStatus: boolean) => {
    toggleUserMutation.mutate({
      userId,
      isActive: !currentStatus,
    });
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as "Admin" | "Legal" | "Finance" | "Sales",
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleResetPassword = (user: User) => {
    setSelectedUser(user);
    resetPasswordForm.reset();
    setIsResetPasswordDialogOpen(true);
  };

  const onEditUser = (data: EditUserData) => {
    if (selectedUser) {
      editUserMutation.mutate({ userId: selectedUser.id, data });
    }
  };

  const onResetPassword = (data: ResetPasswordData) => {
    if (selectedUser) {
      resetPasswordMutation.mutate({ userId: selectedUser.id, password: data.password });
    }
  };

  const confirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Only allow admin access
  if (currentUser?.role !== "Admin") {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground">
                You need Admin privileges to access user management.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">
            Manage user accounts and permissions
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-invite-user">
                <Mail className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
                <DialogDescription>
                  Send an email invitation to a new user. They will set their own password.
                </DialogDescription>
              </DialogHeader>
              <Form {...inviteUserForm}>
                <form onSubmit={inviteUserForm.handleSubmit(onInviteUser)} className="space-y-4">
                  <FormField
                    control={inviteUserForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="user@company.com" {...field} data-testid="input-invite-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={inviteUserForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} data-testid="input-invite-first-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteUserForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} data-testid="input-invite-last-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={inviteUserForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-invite-role">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Legal">Legal</SelectItem>
                            <SelectItem value="Finance">Finance</SelectItem>
                            <SelectItem value="Sales">Sales</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsInviteDialogOpen(false)}
                      data-testid="button-invite-cancel"
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={inviteUserMutation.isPending}
                      data-testid="button-invite-submit"
                    >
                      {inviteUserMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system. They will receive their login credentials.
              </DialogDescription>
            </DialogHeader>
            <Form {...createUserForm}>
              <form onSubmit={createUserForm.handleSubmit(onCreateUser)} className="space-y-4">
                <FormField
                  control={createUserForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="user@company.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createUserForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} data-testid="input-first-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createUserForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={createUserForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Admin">Admin</SelectItem>
                          <SelectItem value="Legal">Legal</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Sales">Sales</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createUserForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Enter password" 
                          {...field} 
                          data-testid="input-password" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createUserMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createUserMutation.isPending ? "Creating..." : "Create User"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            Manage user accounts and their access levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell className="font-medium">
                      {user.firstName} {user.lastName}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.inviteStatus === "pending" ? (
                        <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          Pending Invite
                        </Badge>
                      ) : (
                        <Badge variant={user.isActive ? "default" : "destructive"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.inviteStatus === "pending" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              inviteUserMutation.mutate({
                                email: user.email,
                                firstName: user.firstName || "",
                                lastName: user.lastName || "",
                                role: user.role as "Admin" | "Legal" | "Finance" | "Sales",
                              });
                            }}
                            disabled={inviteUserMutation.isPending}
                            data-testid={`button-resend-${user.id}`}
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Resend Invite
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${user.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditUser(user)} data-testid={`action-edit-${user.id}`}>
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {user.id !== currentUser?.id && (
                              <>
                                <DropdownMenuItem onClick={() => handleResetPassword(user)} data-testid={`action-reset-${user.id}`}>
                                  <Key className="h-4 w-4 mr-2" />
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => sendResetLinkMutation.mutate(user.id)} 
                                  disabled={sendResetLinkMutation.isPending}
                                  data-testid={`action-send-reset-link-${user.id}`}
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Reset Link
                                </DropdownMenuItem>
                              </>
                            )}
                            {user.inviteStatus !== "pending" && (
                              <DropdownMenuItem 
                                onClick={() => handleToggleUser(user.id, user.isActive)}
                                disabled={user.id === currentUser?.id}
                                data-testid={`action-toggle-${user.id}`}
                              >
                                {user.isActive ? (
                                  <>
                                    <ShieldOff className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <Shield className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                            {user.id !== currentUser?.id && (
                              <DropdownMenuItem 
                                onClick={() => handleDeleteUser(user)}
                                className="text-destructive"
                                data-testid={`action-delete-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and role
            </DialogDescription>
          </DialogHeader>
          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(onEditUser)} className="space-y-4">
              <FormField
                control={editUserForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editUserForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-first-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editUserForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-last-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-role">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="Legal">Legal</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="Sales">Sales</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-edit-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editUserMutation.isPending}
                  data-testid="button-edit-submit"
                >
                  {editUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPassword)} className="space-y-4">
              <FormField
                control={resetPasswordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Enter new password (min 6 characters)"
                        {...field} 
                        data-testid="input-new-password" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResetPasswordDialogOpen(false)}
                  data-testid="button-reset-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-reset-submit"
                >
                  {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedUser?.firstName} {selectedUser?.lastName}?
              This action cannot be undone and will permanently remove the user account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-delete-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteUserMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}