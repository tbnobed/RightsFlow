import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

const acceptInviteSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type AcceptInviteData = z.infer<typeof acceptInviteSchema>;

export default function AcceptInvite() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; firstName: string; lastName: string } | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AcceptInviteData>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("token");

    if (!inviteToken) {
      setError("Invalid invitation link");
      setIsVerifying(false);
      return;
    }

    setToken(inviteToken);

    // Verify the invite token
    fetch(`/api/auth/verify-invite/${inviteToken}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Invalid invitation");
        }
        return res.json();
      })
      .then((data) => {
        setUserInfo(data);
        setIsVerifying(false);
      })
      .catch((err) => {
        setError(err.message);
        setIsVerifying(false);
      });
  }, []);

  const onSubmit = async (data: AcceptInviteData) => {
    if (!token) return;

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to accept invitation");
      }

      toast({
        title: "Success",
        description: "Your account has been activated. Redirecting...",
      });

      // Redirect to dashboard after 1 second
      setTimeout(() => {
        setLocation("/");
      }, 1000);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
            <p className="text-center text-muted-foreground">Verifying invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Invalid Invitation</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => setLocation("/login")} data-testid="button-go-to-login">
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Promissio</CardTitle>
          <CardDescription>
            {userInfo && `${userInfo.firstName} ${userInfo.lastName}`} ({userInfo?.email})
            <br />
            Set your password to activate your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Enter your password" 
                        {...field} 
                        data-testid="input-password" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Confirm your password" 
                        {...field} 
                        data-testid="input-confirm-password" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full" 
                disabled={form.formState.isSubmitting}
                data-testid="button-activate-account"
              >
                {form.formState.isSubmitting ? "Activating..." : "Activate Account"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
