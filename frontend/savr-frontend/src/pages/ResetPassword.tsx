import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, ArrowLeft } from "lucide-react";

const ResetPassword: React.FC = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [loading, setLoading] = useState(false);
  const apiBase = ((import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setOk("");
    if (!pw1 || pw1.length < 8) return setErr("Password must be at least 8 characters");
    if (pw1 !== pw2) return setErr("Passwords do not match");
    if (!token) return setErr("Invalid reset link");

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/reset-password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: pw1 }),
      });
      if (res.ok) {
        setOk("Password updated. Please login.");
        setTimeout(()=>navigate("/login"), 900);
      } else {
        const j = await res.json().catch(()=>({}));
        setErr(j?.error || "Reset failed. The link may be invalid or expired.");
      }
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-card">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/90 grid place-items-center text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-bold">Reset Password</h2>
        </div>

        {err && <div className="text-destructive text-sm mb-3">{err}</div>}
        {ok && <div className="text-emerald-500 text-sm mb-3">{ok}</div>}

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="New password"
            value={pw1}
            onChange={(e)=>setPw1(e.target.value)}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e)=>setPw2(e.target.value)}
          />
          <Button className="w-full bg-primary text-primary-foreground" disabled={loading}>
            {loading ? "Updating…" : "Update password"}
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
export default ResetPassword;
