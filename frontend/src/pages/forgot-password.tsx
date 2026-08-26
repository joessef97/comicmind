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
    <PageLayout>
      <main className="container mx-auto max-w-md px-4 py-20">
        <div className="border-[3px] border-[#12100c] bg-[#f8f5ec] hard-shadow">
          {isSent ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center border-[3px] border-[#12100c] bg-[#f2b32e] hard-shadow-sm">
                <CheckCircle className="h-8 w-8 text-[#12100c]" />
              </div>
              <h1 className="mt-6 font-display text-[30px] uppercase leading-none text-[#12100c]">
                Check Your Email
              </h1>
              <p className="mt-4 text-[15px] leading-relaxed text-[#4a4535]">
                If an account with that email exists, we've sent a password reset link.
                Please check your inbox and spam folder.
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[#6d675a]">
                The link will expire in 45 minutes.
              </p>
              <Link href="/login">
                <Button variant="outline" className="mt-6">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="border-b-4 border-[#12100c] px-8 py-6">
                <Mail className="mb-4 h-10 w-10 text-[#d8402f]" />
                <h1 className="font-display text-[34px] uppercase leading-none text-[#12100c]">
                  Forgot Password?
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-[#4a4535]">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 p-8">
                {error && (
                  <div className="border-[3px] border-[#12100c] bg-[#d8402f] p-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#f2ede1]">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="h-12"
                    required
                  />
                </div>

                <Button type="submit" disabled={isLoading || !email} size="lg" className="w-full">
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending...</>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>

              <p className="border-t-[3px] border-[#12100c] px-8 py-5 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[#d8402f] hover:underline"
                >
                  <ArrowLeft className="h-4 w-4" /> Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
}


