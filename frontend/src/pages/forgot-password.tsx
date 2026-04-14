import { useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { Loader2, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setIsSent(true);
    } catch (err: any) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout className="bg-background text-foreground font-sans">
      <main className="container max-w-md mx-auto px-4 py-20">
        <div className="bg-card border border-border/70 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {isSent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Check Your Email</h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                If an account with that email exists, we've sent a password reset link. 
                Please check your inbox and spam folder.
              </p>
              <p className="text-muted-foreground text-xs">
                The link will expire in 45 minutes.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-4 border-border/80 hover:bg-muted/70">
                  <ArrowLeft className="mr-2 w-4 h-4" /> Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2 mb-8">
                <div className="flex justify-center mb-4">
                  <Mail className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-3xl font-display font-bold tracking-tight">Forgot Password?</h1>
                <p className="text-muted-foreground text-sm">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg p-3">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-bold text-muted-foreground">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="h-12 bg-muted/50 border-border/80 focus:border-primary/50"
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !email}
                  className="w-full h-12 bg-gradient-to-r from-primary to-[#d946ef] hover:opacity-90 font-bold text-lg rounded-xl shadow-lg shadow-primary/20"
                >
                  {isLoading ? (
                    <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Sending...</>
                  ) : (
                    "Send Reset Link"
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


