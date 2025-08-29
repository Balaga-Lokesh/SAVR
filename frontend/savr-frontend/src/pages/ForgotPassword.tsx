import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const apiBase = ((import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

  const submit = async (e: React.FormEvent) => {
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
      if (res.ok) setMsg("If an account exists, a reset link or code was sent.");
      else setErr("Could not send reset link");
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/90 grid place-items-center text-primary-foreground">
            <Mail className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold">Forgot Password</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Enter your email and we’ll send a reset link or code.
        </p>

        {err && <div className="text-destructive text-sm mb-3">{err}</div>}
        {msg && <div className="text-emerald-500 text-sm mb-3">{msg}</div>}

        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="you@example.com"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
          />
          <Button className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
        <button
          onClick={() => navigate("/login")}
          className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </button>
      </div>
    </div>
  );
};
export default ForgotPassword;
