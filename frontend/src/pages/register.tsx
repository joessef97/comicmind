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
    <PageLayout>
      <main className="container mx-auto max-w-md px-4 py-20">
        <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] hard-shadow">
          <div className="border-b-4 border-[#12100c] px-8 py-6">
            <h1 className="font-display text-[34px] uppercase leading-none text-[#12100c]">
              Create Account
            </h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
              Sign up to start creating AI comics
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-8">
            {error && (
              <div className="border-[3px] border-[#12100c] bg-[#d8402f] p-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f2ede1]">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                className="h-12"
                required
                minLength={3}
                maxLength={30}
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">3-30 characters, letters, numbers, and underscores only</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="h-12"
                required
              />
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">Used for password recovery</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="h-12 pr-12"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d675a] transition-colors hover:text-[#12100c]"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#6d675a]">Minimum 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="h-12 pr-12"
                  required
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6d675a] transition-colors hover:text-[#12100c]"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username || !email || !password || !confirmPassword}
              size="lg"
              className="w-full"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Creating account...</>
              ) : (
                <>Create Account <ArrowRight className="ml-2 w-5 h-5" /></>
              )}
            </Button>
          </form>

          <p className="border-t-[3px] border-[#12100c] px-8 py-5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
            Already have an account?{" "}
            <Link href={loginHref} className="text-[#d8402f] hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}


