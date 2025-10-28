import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AgentRegister: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement | null>(null);

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) ?? "";
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, "") : "";

  useEffect(() => { emailRef.current?.focus(); }, []);

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validatePhone = (v: string) => /^[0-9]{6,15}$/.test(v.replace(/\D/g, ""));

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(""); setInfo("");
    if (!name || !email || !contact) return setError("All fields are required");
    if (!validateEmail(email)) return setError("Enter a valid email address");
    if (!validatePhone(contact)) return setError("Enter a valid contact number (digits only)");

    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/partners/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, contact_number: contact }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || data?.detail || `Register failed: ${res.status}`);
      } else {
        setName(""); setEmail(""); setContact("");
        setInfo("Registration submitted. An administrator will review and approve your account. You'll receive an OTP by email once approved.");
        // Optionally navigate to agent login page after a short delay
  setTimeout(() => navigate('/partner/login'), 2500);
      }
    } catch (err) {
      console.error(err);
      setError("Network error while registering. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card p-8 rounded-2xl shadow-lg border border-border">
  <h2 className="text-2xl font-bold mb-3 text-center">Delivery Partner Registration</h2>
  <p className="text-sm mb-5 text-center text-muted-foreground">Create your delivery partner account. An admin will approve your registration.</p>

        {error && <div className="text-destructive bg-destructive/10 border-destructive/20 rounded px-3 py-2 mb-4 text-center text-sm">{error}</div>}
        {info && <div className="text-success bg-success/10 border-success/20 rounded px-3 py-2 mb-4 text-center text-sm">{info}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Full name</label>
            <Input ref={emailRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
          </div>

          <div>
            <label className="block text-sm mb-1">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" inputMode="email" />
          </div>

          <div>
            <label className="block text-sm mb-1">Contact number</label>
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="e.g., 9876543210" inputMode="tel" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Submitting…" : "Submit registration"}</Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/partner/login')}>Back to login</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AgentRegister;
