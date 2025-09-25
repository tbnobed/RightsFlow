import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2">Rights & Royalties System</h1>
            <p className="text-muted-foreground">Manage contracts, track royalties, and monitor rights availability</p>
          </div>
          
          <div className="space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full"
              data-testid="button-login"
            >
              Sign In to Continue
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <p>Secure access for Legal, Finance, Sales, and Admin teams</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
