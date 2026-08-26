import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, Link } from "wouter";
import { Loader2, ArrowLeft, Eye, EyeOff, CheckCircle, ShieldCheck, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ResetPassword() {
  const [, setLocation] = useLocation();

  // Read token and email from URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/reset-password", {
        token,
        email,
        newPassword: password,
      });
      setIsReset(true);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("400")) {
        setError("Invalid or expired reset link. Please request a new one.");
      } else {
        setError("Failed to reset password. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // If no token or email in URL, show an error
  if (!token || !email) {
    return (
      <PageLayout>
        <main className="container mx-auto max-w-md px-4 py-20">
          <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] p-8 text-center hard-shadow">
            <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#12100c] bg-[#f2b32e] hard-shadow-sm">
              <AlertTriangle className="h-8 w-8 text-[#12100c]" />
            </div>
            <h1 className="mt-6 font-display text-[30px] uppercase leading-none text-[#12100c]">
              Invalid Reset Link
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-[#4a4535]">
              This password reset link is invalid or incomplete. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button className="mt-6">Request New Link</Button>
            </Link>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <main className="container mx-auto max-w-md px-4 py-20">
        <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] hard-shadow">
          {isReset ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#12100c] bg-[#f2b32e] hard-shadow-sm">
                <CheckCircle className="h-8 w-8 text-[#12100c]" />
              </div>
              <h1 className="mt-6 font-display text-[30px] uppercase leading-none text-[#12100c]">
                Password Reset!
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4a4535]">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
              <Link href="/login">
                <Button className="mt-6">Go to Login</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="border-b-4 border-[#12100c] px-8 py-6">
                <ShieldCheck className="mb-4 h-10 w-10 text-[#d8402f]" />
                <h1 className="font-display text-[34px] uppercase leading-none text-[#12100c]">
                  Reset Password
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a4535]">
                  Enter your new password below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 p-8">
                {error && (
                  <div className="border-[3px] border-[#12100c] bg-[#d8402f] p-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f2ede1]">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
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
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
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
                  disabled={isLoading || !password || !confirmPassword}
                  size="lg"
                  className="w-full"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Resetting...</>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>

              <p className="border-t-[3px] border-[#12100c] px-8 py-5 text-center">
                <Link href="/login" className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#d8402f] hover:underline">
                  <ArrowLeft className="w-4 h-4" /> Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
}


