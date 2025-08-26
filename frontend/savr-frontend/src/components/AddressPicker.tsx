import React, { useEffect, useState } from 'react';

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
      const token = sessionStorage.getItem('authToken');
      if (!token) return setAddresses([]);
      try {
        const r = await fetch('/api/v1/addresses/', { headers: { Authorization: `Token ${token}` } });
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
    const found = addresses?.find(a => a.id === id) || null;
    onSelect(found);
  };

  return (
    <div>
      <div className="mb-2 text-sm font-medium">Saved Addresses</div>
      {addresses === null ? (
        <div className="text-sm text-muted-foreground">Loading addresses...</div>
      ) : addresses.length === 0 ? (
        <div className="text-sm text-muted-foreground">No saved addresses.</div>
      ) : (
        <div className="space-y-2">
          {addresses.map(a => (
            <label key={a.id} className="flex items-start gap-3 p-2 rounded border">
              <input
                type="radio"
                name="selectedAddress"
                checked={selected === a.id}
                onChange={() => handleSelect(a.id)}
                className="mt-1"
              />
              <div className="text-sm">
                <div className="font-medium truncate">{a.line1}</div>
                <div className="text-xs text-muted-foreground">{a.city || ''} {a.pincode || ''}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="mt-3">
        <button type="button" onClick={onAddNew} className="text-sm text-fresh underline">Add new address</button>
      </div>
    </div>
  );
};

export default AddressPicker;
