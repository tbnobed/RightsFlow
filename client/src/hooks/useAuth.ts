import { useQuery } from "@tanstack/react-query";

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

  return {
    user: user as User | undefined,
    isAuthenticated: !!user && !error,
    isLoading,
  };
}
