// src/pages/ForgotPassword.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ForgotPassword: React.FC = () => {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const rawApiBase = (import.meta as any).env?.VITE_API_BASE || "";
  const apiBase = rawApiBase ? String(rawApiBase).replace(/\/+$/, "") : "";

  // Step 1: request reset code
  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(""); setErr("");
    if (!email) return setErr("Enter your email");
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/forgot-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // server may return { sent_via: "smtp" } or { sent_via: "console" } in dev
        const sentVia = d?.sent_via || (d?.detail ? "unknown" : "smtp");
        setMsg(`A reset code has been sent (${sentVia}). Please check your inbox. If you're in dev, check backend console for the code.`);
        setStep("reset");
      } else {
        setErr(d?.error || d?.detail || "Could not send reset code");
      }
    } catch (e) {
      console.error("requestCode error:", e);
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify code + reset password
  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(""); setErr("");
    if (!code) return setErr("Enter the reset code sent to your email");
    if (!pw1 || pw1.length < 8) return setErr("Password must be at least 8 characters");
    if (pw1 !== pw2) return setErr("Passwords do not match");

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code, new_password: pw1 }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Password updated successfully. Redirecting to login…");
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setErr(j?.error || j?.detail || "Reset failed. Code may be invalid or expired.");
      }
    } catch (e) {
      console.error("resetPassword error:", e);
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/90 grid place-items-center text-primary-foreground">
            {step === "request" ? <Mail className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <h2 className="text-2xl font-bold">{step === "request" ? "Forgot Password" : "Reset Password"}</h2>
        </div>

        {err && <div className="text-destructive text-sm mb-3">{err}</div>}
        {msg && <div className="text-emerald-500 text-sm mb-3">{msg}</div>}

        {step === "request" && (
          <form onSubmit={requestCode} className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Enter your email and we’ll send you a reset code.</p>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
              placeholder="you@example.com"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
            />
            <Button className="w-full bg-primary text-primary-foreground" disabled={loading}>{loading ? "Sending…" : "Send reset code"}</Button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={resetPassword} className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Enter the reset code you received and set your new password.</p>
            <input disabled className="w-full rounded-lg border border-border bg-background px-3 py-2 opacity-70" value={email} />
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="6-digit code" value={code} onChange={(e)=>setCode(e.target.value)} />
            <input type="password" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="New password" value={pw1} onChange={(e)=>setPw1(e.target.value)} />
            <input type="password" className="w-full rounded-lg border border-border bg-background px-3 py-2" placeholder="Confirm new password" value={pw2} onChange={(e)=>setPw2(e.target.value)} />
            <Button className="w-full bg-primary text-primary-foreground" disabled={loading}>{loading ? "Updating…" : "Update password"}</Button>
          </form>
        )}

        <button onClick={() => navigate("/login")} className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;
