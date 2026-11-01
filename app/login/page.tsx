"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession, useRequestOtp, useVerifyOtp } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Mail,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Info,
} from "lucide-react";

interface DemoAccount {
  name: string;
  role: string;
  scope: string;
  email: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: "Bamidele Johnson",
    role: "National Admin",
    scope: "National",
    email: "bamidele-johnson@demo.collate.test",
  },
  {
    name: "Chioma Habiba",
    role: "State Coordinator",
    scope: "Lagos State",
    email: "chioma-habiba@demo.collate.test",
  },
  {
    name: "Danjuma Rotimi",
    role: "State Coordinator",
    scope: "Kano State",
    email: "danjuma-rotimi@demo.collate.test",
  },
  {
    name: "Nneka Okon",
    role: "State Coordinator",
    scope: "Rivers State",
    email: "nneka-90@demo.collate.test",
  },
  {
    name: "Musa Aliyu",
    role: "LGA Coordinator",
    scope: "LGA Level",
    email: "musa-91@demo.collate.test",
  },
  {
    name: "Aisha Bello",
    role: "Ward Coordinator",
    scope: "Ward Level",
    email: "aisha-92@demo.collate.test",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isLoading: isCheckingSession } = useSession();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const requestOtpMutation = useRequestOtp();
  const verifyOtpMutation = useVerifyOtp();

  // If already logged in, redirect to /coverage
  useEffect(() => {
    if (session?.authenticated) {
      router.replace("/coverage");
    }
  }, [session, router]);

  // Handle email submit
  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    try {
      await requestOtpMutation.mutateAsync({ email: trimmed });
      setStep("otp");
      setInfoMessage(`A 6-digit code was sent to ${trimmed}`);
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      if (error.code === "not_found") {
        setErrorMessage(
          "This email is not registered or eligible for PU App access. Please select one of the demo accounts below."
        );
      } else if (error.code === "too_many_requests") {
        setErrorMessage("Too many login attempts. Please wait a few minutes before trying again.");
      } else {
        setErrorMessage(error.message || "Failed to send verification code. Please try again.");
      }
    }
  };

  // Quick fill demo account
  const handleSelectDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setErrorMessage(null);
  };

  // Handle OTP digit changes
  const handleOtpChange = (index: number, value: string) => {
    // Handle paste of full 6-digit code
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (i < 6) newOtp[i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(digits.length, 5);
      otpInputRefs.current[nextIndex]?.focus();
      return;
    }

    const digit = value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto advance
    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP submit
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const code = otp.join("");
    if (code.length !== 6) {
      setErrorMessage("Please enter all 6 digits of your verification code.");
      return;
    }

    try {
      await verifyOtpMutation.mutateAsync({
        email: email.trim().toLowerCase(),
        code,
      });
      router.replace("/coverage");
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      if (error.code === "invalid_code") {
        setErrorMessage("Incorrect or expired verification code. Please try again.");
      } else if (error.code === "too_many_attempts") {
        setErrorMessage("Too many incorrect attempts. Please request a new code.");
      } else {
        setErrorMessage(error.message || "Failed to verify code. Please try again.");
      }
    }
  };

  const handleResendOtp = async () => {
    setErrorMessage(null);
    try {
      await requestOtpMutation.mutateAsync({ email: email.trim().toLowerCase() });
      setInfoMessage("A fresh verification code has been generated.");
      setOtp(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } catch {
      setErrorMessage("Failed to resend code. Please try again in a moment.");
    }
  };

  if (isCheckingSession && !session) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center px-4 py-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="h-12 w-12 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center text-lg shadow-md mb-3 ring-4 ring-emerald-700/10">
          PU
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          Collate <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">PU App</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
          Polling Unit Coverage & Official Campaign Messaging Portal
        </p>
      </div>

      <Card className="w-full max-w-md shadow-lg border-border/80 bg-card">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-lg sm:text-xl font-semibold">
            {step === "email" ? "Sign in with Email" : "Enter Verification Code"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {step === "email"
              ? "We will send a 6-digit single-use OTP to your registered email."
              : `Enter the 6-digit code sent to ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Message */}
          {infoMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@demo.collate.test"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={requestOtpMutation.isPending}
                  className="h-10 text-sm"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={requestOtpMutation.isPending || !email.trim()}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
              >
                {requestOtpMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  <>
                    Send Verification Code
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                    6-Digit Code
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp(["", "", "", "", "", ""]);
                      setErrorMessage(null);
                    }}
                    className="text-xs text-emerald-600 hover:text-emerald-700 underline font-normal"
                  >
                    Change email
                  </button>
                </label>

                {/* 6 Digit Input Group */}
                <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputRefs.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      disabled={verifyOtpMutation.isPending}
                      className="w-11 h-12 text-center text-lg font-bold rounded-lg border border-input bg-background focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition-all"
                    />
                  ))}
                </div>
              </div>

              {/* Dev mode delivery note */}
              <div className="p-2.5 rounded-md bg-muted/60 border border-border text-[11px] text-muted-foreground flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  In local development, check your terminal server logs for <code className="bg-background px-1 py-0.5 rounded font-mono text-[10px]">[auth] OTP code</code> or check your inbox.
                </span>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={verifyOtpMutation.isPending || otp.join("").length !== 6}
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-sm"
                >
                  {verifyOtpMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying code...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Verify & Sign In
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResendOtp}
                  disabled={requestOtpMutation.isPending || verifyOtpMutation.isPending}
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Didn&apos;t receive code? Resend
                </Button>
              </div>
            </form>
          )}
        </CardContent>

        {/* Demo Accounts Quick-Select Drawer/Footer */}
        {step === "email" && (
          <CardFooter className="flex flex-col items-start border-t border-border/80 pt-4 bg-muted/20">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Demo Accounts (Click to Fill)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectDemoAccount(acc.email)}
                  className={`text-left p-2 rounded-lg border transition-all text-xs flex flex-col gap-0.5 ${
                    email === acc.email
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-border/70 hover:border-emerald-600/50 hover:bg-accent"
                  }`}
                >
                  <div className="font-medium text-foreground truncate flex items-center justify-between">
                    <span>{acc.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                      {acc.scope}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">{acc.email}</div>
                </button>
              ))}
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
