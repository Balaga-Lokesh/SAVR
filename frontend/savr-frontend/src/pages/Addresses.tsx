// src/pages/Addresses.tsx
import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Building2, Plus, X, Trash2, Star } from "lucide-react";

type Address = {
  address_id: number;
  label?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode?: string | null;
  location_lat?: number | null;
  location_long?: number | null;
  is_default: boolean;
};

const apiBase = ((import.meta as any).env?.VITE_API_BASE as string) || "http://127.0.0.1:8000";

const Addresses: React.FC = () => {
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState<Partial<Address>>({
    label: "",
    contact_name: "",
    contact_phone: "",
    line1: "",
    line2: "",
    city: "Visakhapatnam",
    state: "Andhra Pradesh",
    pincode: "",
    is_default: false,
  });

  const token = sessionStorage.getItem("authToken") || "";

  const authFetch = (url: string, init?: RequestInit) =>
    fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
        ...(init?.headers || {}),
      },
    });

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await authFetch(`${apiBase.replace(/\/+$/, "")}/api/v1/addresses/`);
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      setList(data);
    } catch (e: any) {
      setErr(e.message || "Failed to load addresses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validate = () => {
    if (!form.line1 || form.line1.trim().length < 8) {
      return "Please enter a more complete Address Line 1.";
    }
    if (!form.city || !form.state) {
      return "City and State are required.";
    }
    if (!form.pincode || !/^\d{6}$/.test(form.pincode)) {
      return "Please enter a valid 6-digit PIN code.";
    }
    return "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }
    setErr("");
    try {
      const res = await authFetch(`${apiBase.replace(/\/+$/, "")}/api/v1/addresses/`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to add address");
      setForm({
        label: "",
        contact_name: "",
        contact_phone: "",
        line1: "",
        line2: "",
        city: "Visakhapatnam",
        state: "Andhra Pradesh",
        pincode: "",
        is_default: false,
      });
      setAdding(false);
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to add address");
    }
  };

  const makeDefault = async (id: number) => {
    try {
      const res = await authFetch(
        `${apiBase.replace(/\/+$/, "")}/api/v1/addresses/${id}/set-default/`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to set default");
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to set default");
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this address?")) return;
    try {
      const res = await authFetch(`${apiBase.replace(/\/+$/, "")}/api/v1/addresses/${id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to delete");
    }
  };

  const iconForLabel = (label?: string | null) => {
    const l = (label || "").toLowerCase();
    if (l.includes("home")) return <Home className="h-4 w-4" />;
    if (l.includes("work") || l.includes("office")) return <Building2 className="h-4 w-4" />;
    return <MapPin className="h-4 w-4" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Addresses</h1>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Address
        </Button>
      </div>

      {err && <div className="text-destructive">{err}</div>}
      {loading && <div>Loading...</div>}

      {/* List */}
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((a) => (
          <Card
            key={a.address_id}
            className={`p-4 space-y-2 rounded-xl border shadow-sm hover:shadow-md transition relative ${
              a.is_default ? "ring-1 ring-blue-500" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-md bg-blue-50 dark:bg-gray-800 p-2">{iconForLabel(a.label)}</div>
                <div>
                  <div className="font-semibold">{a.label || "Address"}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.contact_name}
                    {a.contact_phone ? ` · ${a.contact_phone}` : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {a.is_default && (
                  <Badge className="bg-blue-600">
                    <Star className="h-3 w-3 mr-1" />
                    Default
                  </Badge>
                )}
              </div>
            </div>

            <div className="text-sm">
              <div>{a.line1}</div>
              {a.line2 && <div>{a.line2}</div>}
              <div>
                {a.city}, {a.state} {a.pincode || ""}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {!a.is_default && (
                <Button variant="secondary" onClick={() => makeDefault(a.address_id)}>
                  Set Default
                </Button>
              )}
              <Button variant="destructive" onClick={() => remove(a.address_id)}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {list.length === 0 && !loading && (
          <div className="text-muted-foreground">No addresses yet.</div>
        )}
      </div>

      {/* Add Address Modal */}
      {adding && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAdding(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Add New Address</h3>
              <button
                onClick={() => setAdding(false)}
                className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="p-4 grid gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="Label (Home/Work)"
                  value={form.label || ""}
                  onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
                />
                <input
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="Contact Name"
                  value={form.contact_name || ""}
                  onChange={(e) => setForm((s) => ({ ...s, contact_name: e.target.value }))}
                />
                <input
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="Contact Phone"
                  value={form.contact_phone || ""}
                  onChange={(e) => setForm((s) => ({ ...s, contact_phone: e.target.value }))}
                />
                <input
                  required
                  className="rounded-lg border px-3 py-2 bg-background sm:col-span-2"
                  placeholder="Address Line 1"
                  value={form.line1 || ""}
                  onChange={(e) => setForm((s) => ({ ...s, line1: e.target.value }))}
                />
                <input
                  className="rounded-lg border px-3 py-2 bg-background sm:col-span-2"
                  placeholder="Address Line 2"
                  value={form.line2 || ""}
                  onChange={(e) => setForm((s) => ({ ...s, line2: e.target.value }))}
                />
                <input
                  required
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="City"
                  value={form.city || ""}
                  onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
                />
                <input
                  required
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="State"
                  value={form.state || ""}
                  onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
                />
                <input
                  required
                  className="rounded-lg border px-3 py-2 bg-background"
                  placeholder="PIN Code (6 digits)"
                  value={form.pincode || ""}
                  onChange={(e) => setForm((s) => ({ ...s, pincode: e.target.value }))}
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form.is_default}
                  onChange={(e) => setForm((s) => ({ ...s, is_default: e.target.checked }))}
                />
                Set as default
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Address</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Addresses;
