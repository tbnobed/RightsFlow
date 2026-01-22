import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, clearAuthToken, getAuthToken } from "@/lib/queryClient";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "Admin" | "Legal" | "Finance" | "Sales";
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers,
      });
      if (!response.ok) {
        throw new Error("Logout failed");
      }
      return response.json();
    },
    onSuccess: () => {
      clearAuthToken();
      queryClient.clear();
      window.location.reload();
    },
  });

  return {
    user: user as User | undefined,
    isAuthenticated: !!user && !error,
    isLoading,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
  };
}
