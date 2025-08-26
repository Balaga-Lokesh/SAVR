import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  is_default: boolean;
};

const apiBase = ((import.meta as any).env?.VITE_API_BASE as string) || "http://127.0.0.1:8000";

const Addresses: React.FC = () => {
  const [list, setList] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      const res = await authFetch(`${apiBase.replace(/\/+$/, "")}/api/v1/addresses/`, {
        method: "POST",
        body: JSON.stringify(form),
      });
      const data = await res.json();
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
      await load();
    } catch (e: any) {
      setErr(e.message || "Failed to add address");
    }
  };

  const makeDefault = async (id: number) => {
    try {
      const res = await authFetch(`${apiBase.replace(/\/+$/, "")}/api/v1/addresses/${id}/set-default/`, {
        method: "POST",
      });
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Your Addresses</h1>

      {err && <div className="text-destructive">{err}</div>}
      {loading && <div>Loading...</div>}

      {/* List */}
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((a) => (
          <Card key={a.address_id} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{a.label || "Address"}</div>
              {a.is_default && <Badge className="bg-green-600">Default</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">
              {a.contact_name} {a.contact_phone ? `· ${a.contact_phone}` : ""}
            </div>
            <div className="text-sm">{a.line1}</div>
            {a.line2 && <div className="text-sm">{a.line2}</div>}
            <div className="text-sm">
              {a.city}, {a.state} {a.pincode || ""}
            </div>

            <div className="flex gap-2 pt-2">
              {!a.is_default && (
                <Button variant="secondary" onClick={() => makeDefault(a.address_id)}>
                  Set default
                </Button>
              )}
              <Button variant="destructive" onClick={() => remove(a.address_id)}>
                Delete
              </Button>
            </div>
          </Card>
        ))}
        {list.length === 0 && !loading && <div className="text-muted-foreground">No addresses yet.</div>}
      </div>

      {/* Add form */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Add New Address</h2>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Label (Home/Work)"
            value={form.label || ""}
            onChange={(e) => setForm((s) => ({ ...s, label: e.target.value }))}
          />
          <Input
            placeholder="Contact Name"
            value={form.contact_name || ""}
            onChange={(e) => setForm((s) => ({ ...s, contact_name: e.target.value }))}
          />
          <Input
            placeholder="Contact Phone"
            value={form.contact_phone || ""}
            onChange={(e) => setForm((s) => ({ ...s, contact_phone: e.target.value }))}
          />
          <Input
            required
            placeholder="Address Line 1"
            value={form.line1 || ""}
            onChange={(e) => setForm((s) => ({ ...s, line1: e.target.value }))}
          />
          <Input
            placeholder="Address Line 2"
            value={form.line2 || ""}
            onChange={(e) => setForm((s) => ({ ...s, line2: e.target.value }))}
          />
          <Input
            placeholder="City"
            value={form.city || ""}
            onChange={(e) => setForm((s) => ({ ...s, city: e.target.value }))}
          />
          <Input
            placeholder="State"
            value={form.state || ""}
            onChange={(e) => setForm((s) => ({ ...s, state: e.target.value }))}
          />
          <Input
            placeholder="Pincode"
            value={form.pincode || ""}
            onChange={(e) => setForm((s) => ({ ...s, pincode: e.target.value }))}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!form.is_default}
              onChange={(e) => setForm((s) => ({ ...s, is_default: e.target.checked }))}
            />
            Set as default
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto">
              Add Address
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default Addresses;
