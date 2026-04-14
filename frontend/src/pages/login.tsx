import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const search = location.includes("?") ? location.slice(location.indexOf("?")) : "";
  const params = new URLSearchParams(search);
  const rawReturnTo = params.get("returnTo") || "/";
  const decodedReturnTo = (() => {
    try {
      return decodeURIComponent(rawReturnTo);
    } catch {
      return "/";
    }
  })();
  const safeReturnTo = decodedReturnTo.startsWith("/") ? decodedReturnTo : "/";
  const registerHref = safeReturnTo === "/"
    ? "/register"
    : `/register?returnTo=${encodeURIComponent(safeReturnTo)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(username, password);
      setLocation(safeReturnTo);
    } catch (err: any) {
      setError(err.message?.includes("401") ? "Invalid username or password" : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout className="bg-background text-foreground font-sans">
      <main className="container max-w-md mx-auto px-4 py-20">
        <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center space-y-2 mb-8">
            <h1 className="text-3xl font-display font-bold tracking-tight">Welcome Back</h1>
            <p className="text-muted-foreground text-sm">Log in to continue creating comics</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-bold text-muted-foreground">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="h-12 bg-muted/50 border-border/80 focus:border-primary/50"
                required
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="h-12 bg-muted/50 border-border/80 focus:border-primary/50 pr-12"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              className="w-full h-12 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Logging in...</>
              ) : (
                <>Log In <ArrowRight className="ml-2 w-5 h-5" /></>
              )}
            </Button>

            <div className="text-center">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline font-medium">
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href={registerHref} className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}


