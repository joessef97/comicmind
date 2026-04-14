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
      <PageLayout className="bg-background text-foreground font-sans">
        <main className="container max-w-md mx-auto px-4 py-20">
          <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl text-center space-y-4">
            <div className="flex justify-center">
              <AlertTriangle className="w-16 h-16 text-yellow-500" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Invalid Reset Link</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              This password reset link is invalid or incomplete. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button className="mt-4 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold rounded-xl shadow-lg shadow-primary/20">
                Request New Link
              </Button>
            </Link>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout className="bg-background text-foreground font-sans">
      <main className="container max-w-md mx-auto px-4 py-20">
        <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {isReset ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Password Reset!</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your password has been successfully reset. You can now log in with your new password.
              </p>
              <Link href="/login">
                <Button className="mt-4 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold rounded-xl shadow-lg shadow-primary/20">
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2 mb-8">
                <div className="flex justify-center mb-4">
                  <ShieldCheck className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-bold tracking-tight">Reset Password</h1>
                <p className="text-muted-foreground text-sm">
                  Enter your new password below.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-bold text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
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
                  <Label htmlFor="confirmPassword" className="text-sm font-bold text-muted-foreground">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
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
                  disabled={isLoading || !password || !confirmPassword}
                  className="w-full h-12 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Resetting...</>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                <Link href="/login" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
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


