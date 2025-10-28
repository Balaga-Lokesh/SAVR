import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline spinner used to avoid missing component imports
  const InlineSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
  );

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Validate credentials and request OTP (backend will send OTP and verify_otp will set cookie)
      const res = await fetch(`/api/v1/admin/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || "Login failed");
        setLoading(false);
        return;
      }

      // Request OTP for admin
      const r2 = await fetch(`/api/v1/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email, purpose: "login" }),
      });
      if (!r2.ok) {
        setError("Failed to send OTP");
        setLoading(false);
        return;
      }

      sessionStorage.setItem("otp_dest", email);
      sessionStorage.setItem("auth_role", "admin");
      navigate("/verify-otp");
    } catch (err: any) {
      setError(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Admin Sign in</CardTitle>
            <div className="text-sm text-muted-foreground">Access the SAVR admin dashboard</div>
          </CardHeader>
          <CardContent>
            {error && <div className="mb-3 text-red-600">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                  {loading ? <InlineSpinner /> : "Sign in"}
                </Button>
              </div>
            </form>

            <div className="mt-4 text-sm text-muted-foreground">
              Forgot password? <a className="text-primary" href="/forgot-password">Reset</a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
