// src/pages/VerifyOTP.tsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const VerifyOTP: React.FC = () => {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh, user } = useAuth();

  // Use relative paths by default so Vite dev proxy keeps calls same-origin for cookies
  const rawApiBase = (import.meta.env.VITE_API_BASE as string) ?? "";
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "";
  const dest = sessionStorage.getItem("otp_dest") || "";
  const role = sessionStorage.getItem("auth_role") || "user";

  const handleVerify = async () => {
    setErr("");
    setInfo("");
    if (!code || code.trim().length < 3) {
      setErr("Enter the OTP.");
      return;
    }
    // If agent/partner supplies a password, validate it client-side
    if ((role === "agent" || role === "partner") && (newPassword || confirmPassword)) {
      if (newPassword.length < 8) { setErr("Password must be at least 8 characters"); return; }
      if (newPassword !== confirmPassword) { setErr("Passwords do not match"); return; }
    }
    setLoading(true);
    try {
  const body: any = { destination: dest, code: code.trim(), purpose: "login", role };
  // allow partners to set password during OTP verify as well
  if ((role === "agent" || role === "partner") && newPassword) body.new_password = newPassword;
      const res = await fetch(`${apiBase}/api/v1/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error || data?.detail || `Verify failed: ${res.status}`);
        return;
      }

      // token is set as an httpOnly cookie by the backend; no need to store it in sessionStorage.

      // Wait for global auth refresh so RequireAuth doesn't prematurely redirect
      try {
        await refresh();
      } catch (e) {
        console.warn("refresh after verify failed:", e);
      }

      sessionStorage.removeItem("otp_dest");
      setInfo("Verified — redirecting...");

      // Wait until user is set in AuthContext before redirecting
      const waitForUser = async () => {
        for (let i = 0; i < 20; ++i) {
          if (user) break;
          await new Promise(res => setTimeout(res, 100));
        }
        if (role === "admin") navigate("/admin");
        else if (role === "agent" || role === "partner") navigate("/agent");
        else navigate("/shopping-list");
      };
      waitForUser();
    } catch (e) {
      console.error("verify network error:", e);
      setErr("Network error. Check backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setErr("");
    setInfo("");
    if (!dest) {
      setErr("Missing destination. Try login again.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ destination: dest, purpose: "login", role }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setErr(d?.error || d?.detail || `Resend failed: ${res.status}`);
      else setInfo("OTP resent. Check email or backend console (dev).");
    } catch (e) {
      setErr("Network error while resending.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-lg border border-border">
        <h2 className="text-2xl font-bold mb-3 text-center">Verify OTP</h2>
        <p className="text-sm mb-5 text-center text-muted-foreground">Code sent to: <strong>{dest || "your account"}</strong></p>

        {err && <div className="text-destructive bg-destructive/10 border-destructive/20 rounded px-3 py-2 mb-4 text-center text-sm">{err}</div>}
        {info && <div className="text-success bg-success/10 border-success/20 rounded px-3 py-2 mb-4 text-center text-sm">{info}</div>}

        <div className="mb-5">
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter OTP code" className="text-lg py-3 px-4" />
        </div>

        {role === 'agent' && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Set a password (optional)</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min 8 chars)" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm password</label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleVerify} disabled={loading} className="flex-1 text-base py-3">
            {loading ? "Verifying…" : "Verify & Continue"}
          </Button>
          <Button variant="ghost" onClick={handleResend} className="flex-1 text-base py-3">Resend</Button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
