import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

const VerifyOTP = () => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "http://127.0.0.1:8000";
  const apiBase = rawApiBase.replace(/\/+$/, "");

  const dest = sessionStorage.getItem("otp_dest") || "";

  const handleVerify = async () => {
    if (!code) return setError("Please enter the OTP code");
    if (code.length < 4) return setError("Enter the full OTP");

    setLoading(true); setError(""); setInfo("");
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/verify-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: dest,
          code,
          purpose: "login",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.token) {
        sessionStorage.setItem("authToken", data.token);
        sessionStorage.setItem("mfaVerified", "true");
        sessionStorage.removeItem("otp_dest");

        setInfo("OTP verified! Redirecting…");
        setTimeout(() => navigate("/shopping-list"), 800);
      } else {
        setError(data?.error || "Invalid or expired code");
      }
    } catch {
      setError("Network error. Check backend server or CORS.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(""); setInfo("");
    if (!dest) {
      setError("Missing email session. Please login again.");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: dest, purpose: "login" }),
      });
      if (res.ok) setInfo("OTP resent. Please check your inbox/device.");
      else setError("Failed to resend OTP");
    } catch {
      setError("Network error while resending OTP.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-2">Verify OTP</h2>
        <p className="mb-4 text-sm">
          Code sent to: <strong>{dest || "your account"}</strong>
        </p>

        {error && <p className="text-destructive mb-4">{error}</p>}
        {info && <p className="text-primary mb-4">{info}</p>}

        <label className="block mb-6">
          <div className="text-sm mb-1">OTP Code</div>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter code"
            maxLength={6}
          />
        </label>

        <div className="flex gap-2">
          <Button onClick={handleVerify} className="flex-1" disabled={loading}>
            {loading ? "Verifying..." : "Verify & Continue"}
          </Button>
          <Button type="button" variant="ghost" onClick={handleResend}>
            Resend
          </Button>
        </div>

        <div className="text-sm flex items-center justify-between mt-4">
          <button className="underline" onClick={() => navigate("/login")}>Back to login</button>
          <button className="underline" onClick={() => navigate("/forgot-password")}>Forgot password?</button>
        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
