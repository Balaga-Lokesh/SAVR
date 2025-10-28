import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";

interface Address {
  id: number;
  line1: string;
  city?: string;
  state?: string;
  pincode?: string;
  lat?: number | null;
  long?: number | null;
}

interface Props {
  selectedId?: number | null;
  onSelect: (addr: Address | null) => void;
  onAddNew: () => void;
}

const AddressPicker: React.FC<Props> = ({ selectedId, onSelect, onAddNew }) => {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selected, setSelected] = useState<number | null>(selectedId ?? null);

  useEffect(() => {
    const fetchAddrs = async () => {
      try {
        const r = await fetch("/api/v1/addresses/", { credentials: "include" });
        if (!r.ok) return setAddresses([]);
        const data = await r.json();
        const mapped = data.map((a: any) => ({
          id: a.address_id || a.id,
          line1: a.line1,
          city: a.city,
          state: a.state,
          pincode: a.pincode,
          lat: a.lat,
          long: a.long,
        }));
        setAddresses(mapped);
        if (mapped.length > 0) {
          // prefer controlled selectedId if provided and found
          const preferred = selectedId && mapped.find((m) => m.id === selectedId) ? selectedId : mapped[0].id;
          setSelected(preferred);
          const found = mapped.find((m) => m.id === preferred) || mapped[0];
          onSelect(found);
        }
      } catch (e) {
        setAddresses([]);
      }
    };
    fetchAddrs();
  }, []);

  // if parent controls selectedId, sync it when it changes or when addresses load
  useEffect(() => {
    if (!addresses || selectedId == null) return;
    const found = addresses.find((a) => a.id === selectedId) || null;
    if (found) {
      setSelected(selectedId);
      onSelect(found);
    }
  }, [selectedId, addresses]);

  const handleSelect = (id: number) => {
    setSelected(id);
    const found = addresses?.find((a) => a.id === id) || null;
    onSelect(found);
  };

  return (
    <div className="space-y-3">
      <div className="font-medium">Saved Addresses</div>

      {addresses === null ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 bg-card animate-pulse rounded-lg"
            />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-sm text-muted-foreground">No saved addresses.</div>
      ) : (
        <div className="grid gap-2">
          {addresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleSelect(a.id)}
              className={`p-3 rounded-lg border text-left transition
                ${
                  selected === a.id
                    ? "border-border bg-card/5"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-400"
                }`}
            >
              <div className="font-medium truncate">{a.line1}</div>
              <div className="text-xs text-muted-foreground">
                {a.city || ""} {a.pincode || ""}
              </div>
            </button>
          ))}
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={onAddNew}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-muted/10"
        >
          <Plus className="h-4 w-4" />
          Add New Address
        </button>
      </div>
    </div>
  );
};

export default AddressPicker;
