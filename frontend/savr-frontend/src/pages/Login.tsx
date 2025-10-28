import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, Lock, Eye, EyeOff, User, Phone, ArrowRight } from "lucide-react";

const Login: React.FC = () => {
  const [isSignup, setIsSignup] = useState(false);

  // shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // signup-only
  const [username, setUsername] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) ?? "";
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "";

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validatePhone = (v: string) => /^[0-9]{7,15}$/.test(v.replace(/\D/g, ""));

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const passwordStrength = useMemo(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[a-z]/.test(password)) s++;
    if (/\d/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s; // 0-5
  }, [password]);

  // LOGIN flow
  const handleLogin = async () => {
    setError(""); setHint("");
    if (!email || !password) return setError("Email and password are required");
    if (!validateEmail(email)) return setError("Enter a valid email address");

    setLoading(true);
    try {
      // Standard user flow: validate credentials, then request OTP
      const res = await fetch(`${apiBase}/api/v1/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data?.error || "Login failed");

      // Request OTP
      const r2 = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: email, purpose: "login" }),
      });
      if (!r2.ok) return setError("Failed to send OTP");

      sessionStorage.setItem("otp_dest", email);
      sessionStorage.setItem("auth_role", "user");
      navigate("/verify-otp");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  // SIGNUP flow
  const handleRegister = async () => {
    setError("");
    setHint("");

    if (!username || !email || !password || !contactNumber) {
      return setError("All fields are required");
    }
    if (!validateEmail(email)) return setError("Invalid email format");
    if (!validatePhone(contactNumber)) return setError("Enter a valid contact number (digits only, 7–15)");

    setLoading(true);
    try {
      const payload = { username, email, password, contact_number: contactNumber };
      const res = await fetch(`${apiBase}/api/v1/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setUsername(""); setEmail(""); setPassword(""); setContactNumber("");
        setHint("Registration successful! Please sign in.");
        setIsSignup(false);
      } else {
        setError(data?.error || "Registration failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    isSignup ? handleRegister() : handleLogin();
  };

  return (
    <div className="min-h-screen grid place-items-center bg-[radial-gradient(60%_60%_at_50%_0%,rgba(99,102,241,0.12),transparent_60%),linear-gradient(180deg,transparent,rgba(0,0,0,0.02))] p-6">
      <div className="w-full max-w-xl">
        {/* Brand / welcome */}
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow">
              <Mail className="h-5 w-5" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
              {isSignup ? "Create your SAVR account" : "Welcome back to SAVR"}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {isSignup ? "Join and start smart shopping in minutes." : "Sign in to continue your smart shopping journey."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/90 border rounded-2xl shadow-card p-6 md:p-8 backdrop-blur">
          {/* Toggle */}
            <div className="mb-4">
              <div className="inline-flex overflow-hidden rounded-xl border">
                <button
                  className={`px-4 py-2 text-sm ${!isSignup ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  onClick={() => { setIsSignup(false); setError(""); setHint(""); }}
                >
                  Sign in
                </button>
                <button
                  className={`px-4 py-2 text-sm ${isSignup ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  onClick={() => { setIsSignup(true); setError(""); setHint(""); }}
                >
                  Sign up
                </button>
              </div>

              {/* Role selector removed: public signup/login only for users. Admins use separate AdminLogin. */}
            </div>

          {error && <div className="mb-4 text-sm text-destructive">{error}</div>}
          {hint && <div className="mb-4 text-sm text-emerald-600">{hint}</div>}

          <form onSubmit={submit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={emailRef}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                  inputMode="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* strength (signup only) */}
              {isSignup && (
                <div className="mt-2 h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      passwordStrength <= 2 ? "bg-red-500" : passwordStrength <= 3 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Signup-only fields */}
            {isSignup && (
              <>
                <div>
                  <label className="block text-sm mb-1">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="your_nickname"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-1">Contact number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="e.g., 9876543210"
                      className="pl-9"
                      inputMode="tel"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" className="flex-1 gap-2" disabled={loading}>
                {loading ? (isSignup ? "Creating…" : "Signing in…") : (
                  <>
                    {isSignup ? "Sign up" : "Sign in"} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setIsSignup((s) => !s);
                  setError("");
                  setHint("");
                }}
              >
                {isSignup ? "Have an account? Sign in" : "New? Sign up"}
              </Button>
            </div>

            {!isSignup && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </form>
        </div>

        {/* tiny legal / footer */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          By continuing you agree to our terms & privacy policy.
        </p>
      </div>
    </div>
  );
};

export default Login;
