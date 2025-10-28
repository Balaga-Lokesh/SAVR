// src/pages/Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MapPin, LogOut, Settings, Edit3, X, Copy, ShieldCheck, User, Mail, Phone, CheckCircle2
} from "lucide-react";

interface Address {
  id: number;
  label: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
}
interface UserProfile {
  user_id: number;
  username: string;
  email: string;
  contact_number: string;
  default_address?: Address | null;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  // use cookie-based auth
  const token = null;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<UserProfile>>({});
  const [saveOK, setSaveOK] = useState(false);

  const initial = useMemo(
    () => profile?.username?.trim()?.[0]?.toUpperCase() || "U",
    [profile?.username]
  );

  const logout = () => {
    sessionStorage.removeItem("mfaVerified");
    sessionStorage.removeItem("otp_dest");
    navigate("/login");
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/v1/auth/me/", { credentials: 'include' });
      if (res.status === 401) {
        logout();
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data);
      setForm({
        username: data.username,
        email: data.email,
        contact_number: data.contact_number,
      });
    } catch (e: any) {
      setErr(e?.message || "Could not load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    loadProfile();
  }, []);

  const onCopy = (txt: string) => {
    navigator.clipboard?.writeText(txt).catch(() => {});
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username?.trim()) return alert("Username is required");
    if (!form.email?.trim()) return alert("Email is required");
    if (!/^\+?\d[\d\s-]{5,}$/.test(form.contact_number || "")) {
      return alert("Please enter a valid contact number");
    }

    try {
      setSaving(true);
      setSaveOK(false);
      const res = await fetch("/api/v1/auth/me/", {
        method: "PATCH",
        credentials: 'include',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username?.trim(),
          email: form.email?.trim(),
          contact_number: (form.contact_number || "").replace(/\s+/g, ""),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update profile");
      setSaveOK(true);
      setEditOpen(false);
      await loadProfile();
    } catch (e: any) {
      alert(e?.message || "Failed to update profile");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveOK(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="rounded-2xl overflow-hidden shadow-sm animate-pulse">
          <div className="h-32 bg-muted/10" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4 h-32 animate-pulse bg-card" />
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-3xl text-center">
        <p className="mb-4 text-red-600 font-medium">{err}</p>
        <Button onClick={loadProfile}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Hero */}
      <div className="rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted/10 grid place-items-center text-2xl font-semibold">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold truncate">{profile?.username}</h1>
                {saveOK && (
                  <span className="inline-flex items-center gap-1 text-xs bg-muted/10 px-2 py-0.5 rounded">
                    <CheckCircle2 className="h-3 w-3" /> Saved
                  </span>
                )}
              </div>
              <div className="opacity-90 text-sm truncate flex items-center gap-2">
                <Mail className="h-4 w-4" /> {profile?.email}
                <button
                  className="text-xs underline opacity-90"
                  onClick={() => onCopy(profile?.email || "")}
                >
                  copy
                </button>
              </div>
              <div className="opacity-90 text-sm flex items-center gap-2">
                <Phone className="h-4 w-4" /> +91 {profile?.contact_number}
              </div>
            </div>
            <Button
              className="ml-auto bg-card text-primary hover:bg-card/90"
              onClick={() => setEditOpen(true)}
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          </div>

          {/* quick stats */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-card/5 rounded-lg p-3">
              <div className="opacity-80">User ID</div>
              <div className="font-semibold flex items-center gap-2">
                {profile?.user_id}
                <button className="text-xs underline opacity-90" onClick={() => onCopy(String(profile?.user_id || ""))}>
                  copy
                </button>
              </div>
            </div>
            <div className="bg-card/5 rounded-lg p-3">
              <div className="opacity-80">Default Address</div>
              <div className="font-semibold truncate">
                {profile?.default_address
                  ? `${profile.default_address.line1}, ${profile.default_address.city} ${profile.default_address.pincode}`
                  : "Not set"}
              </div>
            </div>
            <div className="bg-card/5 rounded-lg p-3">
              <div className="opacity-80">Security</div>
              <div className="font-semibold flex items-center gap-1">
                <ShieldCheck className="h-4 w-4" /> Good
              </div>
            </div>
            <div className="bg-card/5 rounded-lg p-3">
              <div className="opacity-80">Status</div>
              <div className="font-semibold">Active</div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-muted-foreground mt-4">
        Manage your account, addresses, and preferences.
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card className="p-4 flex flex-col gap-3">
          <div className="font-semibold">Addresses</div>
          <p className="text-sm text-muted-foreground">
            Add or update delivery addresses used at checkout.
          </p>
          <Button onClick={() => navigate("/addresses")} className="w-fit" variant="secondary">
            <MapPin className="h-4 w-4 mr-2" />
            Manage Addresses
          </Button>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="font-semibold">Security</div>
          <p className="text-sm text-muted-foreground">
            Update your password and security settings.
          </p>
          <Button
            className="w-fit"
            variant="secondary"
            onClick={() => navigate("/change-password")} // wire this route when ready
          >
            <ShieldCheck className="h-4 w-4 mr-2" />
            Change Password
          </Button>
        </Card>

        <Card className="p-4 flex flex-col gap-3">
          <div className="font-semibold">Preferences</div>
          <p className="text-sm text-muted-foreground">
            Coming soon: notifications, payment methods, and more.
          </p>
          <Button disabled className="w-fit">
            <Settings className="h-4 w-4 mr-2" />
            Edit Preferences
          </Button>
        </Card>

        <Card className="p-4 flex items-center justify-between md:col-span-2">
          <div>
            <div className="font-semibold">Sign out</div>
            <p className="text-sm text-muted-foreground">
              You’ll need to log in again next time.
            </p>
          </div>
          <Button variant="destructive" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </Card>
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !saving && setEditOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 bg-card rounded-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Edit Profile</h3>
              <button
                onClick={() => !saving && setEditOpen(false)}
                className="p-2 rounded hover:bg-muted/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveProfile} className="p-4 space-y-3">
              <label className="block">
                <span className="text-sm">Username</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-background"
                  value={form.username || ""}
                  onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-sm">Email</span>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-background"
                  value={form.email || ""}
                  onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                />
              </label>
              <label className="block">
                <span className="text-sm">Contact Number</span>
                <input
                  inputMode="tel"
                  className="mt-1 w-full rounded-lg border px-3 py-2 bg-background"
                  placeholder="+91 9XXXXXXXXX"
                  value={form.contact_number || ""}
                  onChange={(e) => setForm((s) => ({ ...s, contact_number: e.target.value }))}
                />
              </label>
              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
