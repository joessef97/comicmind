import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const [location, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
  const loginHref = safeReturnTo === "/"
    ? "/login"
    : `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username can only contain letters, numbers, and underscores");
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    try {
      await register(username, email, password);
      setLocation(safeReturnTo);
    } catch (err: any) {
      setError(err.message?.includes("400") ? "Username already exists or invalid data" : "Registration failed. Please try again.");
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
            <h1 className="text-3xl font-display font-bold tracking-tight">Create Account</h1>
            <p className="text-muted-foreground text-sm">Sign up to start creating AI comics</p>
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
                placeholder="Choose a username"
                className="h-12 bg-muted/50 border-border/80 focus:border-primary/50"
                required
                minLength={3}
                maxLength={30}
              />
              <p className="text-[10px] text-muted-foreground">3-30 characters, letters, numbers, and underscores only</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-muted-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="h-12 bg-muted/50 border-border/80 focus:border-primary/50"
                required
              />
              <p className="text-[10px] text-muted-foreground">Used for password recovery</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
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
              <p className="text-[10px] text-muted-foreground">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-bold text-muted-foreground">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="h-12 bg-muted/50 border-border/80 focus:border-primary/50 pr-12"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username || !email || !password || !confirmPassword}
              className="w-full h-12 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight className="ml-2 w-5 h-5" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href={loginHref} className="text-primary hover:underline font-medium">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}


