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
  onSelect: (addr: Address | null) => void;
  onAddNew: () => void;
}

const AddressPicker: React.FC<Props> = ({ onSelect, onAddNew }) => {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const fetchAddrs = async () => {
      const token = sessionStorage.getItem("authToken");
      if (!token) return setAddresses([]);
      try {
        const r = await fetch("/api/v1/addresses/", {
          headers: { Authorization: `Token ${token}` },
        });
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
          setSelected(mapped[0].id);
          onSelect(mapped[0]);
        }
      } catch (e) {
        setAddresses([]);
      }
    };
    fetchAddrs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              className="h-14 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-lg"
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
                    ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
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
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          Add New Address
        </button>
      </div>
    </div>
  );
};

export default AddressPicker;
