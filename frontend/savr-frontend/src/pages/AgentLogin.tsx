import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AgentLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  // OTP-only flow: agents request an OTP to their email to sign in. No password required.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Request OTP directly for the agent email
      const r2 = await fetch(`/api/v1/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email, purpose: "login" }),
      });
      const j = await r2.json().catch(() => ({}));
      if (!r2.ok) { setError(j?.error || "Failed to send OTP"); setLoading(false); return; }

      sessionStorage.setItem("otp_dest", email);
      sessionStorage.setItem("auth_role", "agent");
      navigate("/verify-otp");
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally { setLoading(false); }
  };

  return (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Delivery Partner Sign in</CardTitle>
            <div className="text-sm text-muted-foreground">Access orders assigned to you</div>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-3 text-red-600">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div className="text-sm text-muted-foreground">An OTP will be emailed to you to complete sign in.</div>
              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>{loading ? 'Signing...' : 'Sign in'}</Button>
              </div>
              <div className="pt-2 text-center">
                <button type="button" className="text-sm text-muted-foreground hover:underline" onClick={() => navigate('/agent/register')}>New? Register as a delivery partner</button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AgentLogin;
