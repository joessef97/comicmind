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
    <PageLayout>
      <main className="container mx-auto max-w-md px-4 py-20">
        <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] hard-shadow">
          <div className="border-b-4 border-[#12100c] px-8 py-6">
            <h1 className="font-display text-[34px] uppercase leading-none text-[#12100c]">
              Welcome Back
            </h1>
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
              Log in to continue creating comics
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
                placeholder="Enter username"
                className="h-12"
                required
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
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
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              size="lg"
              className="w-full"
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging in...</>
              ) : (
                <>Log In <ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>

            <div className="text-center">
              <Link
                href="/forgot-password"
                className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#d8402f] hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="border-t-[3px] border-[#12100c] px-8 py-5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-[#6d675a]">
            Don't have an account?{" "}
            <Link href={registerHref} className="text-[#d8402f] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </PageLayout>
  );
}


