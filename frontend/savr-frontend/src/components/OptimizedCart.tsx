// src/components/OptimizedCart.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart, MapPin, Clock, Sparkles, Trash2, Plus, Minus, ArrowLeft,
  PhoneCall, Home, Ticket, Info, X, CheckCircle
} from "lucide-react";
import AddressPicker from "@/components/AddressPicker";

/** TYPES **/
interface Product { product_id: number; image_url?: string; name: string; }
interface CartItem { product_id: number; quantity: number; weight_kg?: number; }
interface BackendItem { product_id: number; name: string; qty: number; unit_price: number; line_price: number; }
interface BackendMart {
  mart_id: number; mart_name: string; distance_km: number; eta_min: number;
  weight_kg: number; delivery_charge: number; items: BackendItem[];
}
interface OptimizeResult { items_price: number; delivery_total: number; grand_total: number; eta_total_min: number; marts: BackendMart[]; }
interface OptimizeResponse {
  result: OptimizeResult; items_count: number; notes: string;
  address?: { id: number; summary: string; lat: number; long: number };
}
interface MeResponse {
  user_id: number; username: string; email: string; contact_number: string;
  default_address?: { id: number; label: string; line1: string; city: string; state: string; pincode: string; is_default: boolean; } | null;
}
interface OptimizedCartProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  products: Product[]; // from products page
}

/** UI helpers **/
const hueFromId = (id: number) => (id * 37) % 360;
const ringFromId = (id: number) => `ring-[hsl(${hueFromId(id)}_100%_42%)]`;
const headerFromId = (id: number) =>
  `bg-[conic-gradient(from_90deg_at_50%_50%,hsl(${hueFromId(id)}_95%_92%),hsl(${(hueFromId(id)+40)%360}_95%_96%),white)]`;
const money = (n: number) => `₹${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
const isLikelyGeocodable = (summary: string) => /,/.test(summary) && /\b\d{6}\b/.test(summary);

/** build image src like Products page; if relative, prefix API base */
const buildImageSrc = (raw?: string) => {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000";
  const trimmedBase = String(base).replace(/\/+$/, "");
  const needsSlash = raw.startsWith("/") ? "" : "/";
  return `${trimmedBase}${needsSlash}${raw}`;
};

const OptimizedCart: React.FC<OptimizedCartProps> = ({ cart, setCart, products }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [contactNumber, setContactNumber] = useState<string>("");

  // address selection
  const [addressModal, setAddressModal] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [selectedAddressSummary, setSelectedAddressSummary] = useState<string>("");
  const [addressIssue, setAddressIssue] = useState<string>("");

  // promo (UI only)
  const [promo, setPromo] = useState("");

  // images: overrides fetched straight from DB if product list didn't have it or image fails
  const [imageOverrides, setImageOverrides] = useState<Record<number, string | undefined>>({});

  // plan toggle
  const [useBestPricePlan, setUseBestPricePlan] = useState(false);

  const token = typeof window !== "undefined" ? sessionStorage.getItem("authToken") : null;

  /** map product_id -> image_url from products list (base) + overrides from DB fetch */
  const productImageMap = useMemo(() => {
    const map = new Map<number, string | undefined>();
    (products || []).forEach(p => map.set(p.product_id, p.image_url));
    Object.entries(imageOverrides).forEach(([pid, url]) => map.set(Number(pid), url));
    return map;
  }, [products, imageOverrides]);

  /** If an image is missing/broken, fetch product from DB and cache image_url */
  const fetchImageFromDB = async (product_id: number) => {
    try {
      const res = await fetch(`/api/v1/products/${product_id}/`);
      if (!res.ok) return;
      const j = await res.json();
      if (j?.image_url) {
        setImageOverrides(prev => ({ ...prev, [product_id]: j.image_url as string }));
      }
    } catch {}
  };

  /** Ensure we have images for cart items (prefetch) */
  useEffect(() => {
    const need = new Set<number>();
    cart.forEach(ci => {
      const url = productImageMap.get(ci.product_id);
      if (!url) need.add(ci.product_id);
    });
    if (need.size) Array.from(need).slice(0, 12).forEach(id => fetchImageFromDB(id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, products]);

  /** Profile */
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) { navigate("/login"); return; }
      try {
        const res = await fetch("/api/v1/auth/me/", { headers: { Authorization: `Token ${token}` } });
        if (res.ok) {
          const j = await res.json();
          setProfile(j);
          if (j?.contact_number) setContactNumber(j.contact_number);
          if (j?.default_address?.id) {
            setSelectedAddressId(j.default_address.id);
            setSelectedAddressSummary(`${j.default_address.line1}, ${j.default_address.city} ${j.default_address.pincode}`);
          }
        }
      } catch {}
    };
    fetchMe();
  }, [token, navigate]);

  /** Optimize request on changes */
  useEffect(() => {
    if (!profile || !selectedAddressId) return;
    fetchOptimized(selectedAddressId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, cart, selectedAddressId]);

  const fetchOptimized = async (addressId: number) => {
    if (!token) { navigate("/login"); return; }
    if (!cart.length) return;

    setLoading(true);
    setOptError(null);
    setAddressIssue("");
    try {
      if (!profile) { setOptError("Loading profile, please wait..."); return; }
      const payload = {
        items: cart.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
        address_id: addressId,
      };

      const res = await fetch("/api/v1/basket/optimize/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        let msg = errBody;
        try { msg = JSON.parse(errBody)?.error || msg; } catch {}
        setOptError(String(msg));
        if (String(msg).toLowerCase().includes("geocod")) {
          setAddressIssue("We couldn’t find this location. Please include City, State, and a 6-digit PIN code.");
          setAddressModal(true);
        }
        throw new Error(String(msg));
      }

      const json = (await res.json()) as OptimizeResponse;
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /** cart controls */
  const increaseQty = (product_id: number) =>
    setCart((prev) => prev.map((it) => (it.product_id === product_id ? { ...it, quantity: it.quantity + 1 } : it)));
  const decreaseQty = (product_id: number) =>
    setCart((prev) =>
      prev
        .map((it) => (it.product_id === product_id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))
        .filter((it) => it.quantity > 0)
    );
  const removeItem = (product_id: number) => setCart((prev) => prev.filter((it) => it.product_id !== product_id));
  const emptyCart = () => { if (confirm("Remove all items from your cart?")) setCart([]); };

  /** ---------- BEST PRICE ENGINE ---------- **/
  type BestPick = { product_id: number; name: string; qty: number; best_unit: number; best_mart_id: number; best_mart_name: string; };
  const optimizerMarts = data?.result?.marts || [];

  // build quick lookups
  const martById: Record<number, BackendMart> = useMemo(() => {
    const m: Record<number, BackendMart> = {};
    optimizerMarts.forEach(mt => m[mt.mart_id] = mt);
    return m;
  }, [optimizerMarts]);

  // for each product in the *optimizer plan*, find the cheapest mart/unit price
  const bestByProduct: Record<number, BestPick> = useMemo(() => {
    const best: Record<number, BestPick> = {};
    optimizerMarts.forEach(m => {
      m.items.forEach(it => {
        const current = best[it.product_id];
        if (!current || it.unit_price < current.best_unit) {
          best[it.product_id] = {
            product_id: it.product_id,
            name: it.name,
            qty: it.qty,
            best_unit: it.unit_price,
            best_mart_id: m.mart_id,
            best_mart_name: m.mart_name,
          };
        }
      });
    });
    return best;
  }, [optimizerMarts]);

  // group best picks by mart to form a "Best-Price Plan"
  const bestPricePlanMarts: BackendMart[] = useMemo(() => {
    const byMart: Record<number, BackendItem[]> = {};
    Object.values(bestByProduct).forEach(p => {
      const list = byMart[p.best_mart_id] || (byMart[p.best_mart_id] = []);
      list.push({
        product_id: p.product_id,
        name: p.name,
        qty: p.qty,
        unit_price: p.best_unit,
        line_price: p.best_unit * p.qty,
      });
    });
    return Object.entries(byMart).map(([martId, items]) => {
      const src = martById[Number(martId)];
      return {
        mart_id: Number(martId),
        mart_name: src?.mart_name || `Mart ${martId}`,
        distance_km: src?.distance_km ?? 0,
        eta_min: src?.eta_min ?? 0,
        weight_kg: src?.weight_kg ?? 0,
        delivery_charge: src?.delivery_charge ?? 0,
        items,
      };
    });
  }, [bestByProduct, martById]);

  // totals for best-price plan
  const bestItemsTotal = useMemo(
    () => bestPricePlanMarts.reduce((s, m) => s + m.items.reduce((ss, it) => ss + it.line_price, 0), 0),
    [bestPricePlanMarts]
  );
  const bestDeliveryTotal = useMemo(
    () => bestPricePlanMarts.reduce((s, m) => s + (m.delivery_charge || 0), 0),
    [bestPricePlanMarts]
  );
  const bestGrand = bestItemsTotal + bestDeliveryTotal;

  const currentItemsTotal = data?.result?.items_price ?? 0;
  const currentDeliveryTotal = data?.result?.delivery_total ?? 0;
  const currentGrand = data?.result?.grand_total ?? 0;

  /** Place orders: respect chosen plan */
  const placeOrders = async () => {
    if (!token) { navigate("/login"); return; }
    if (!selectedAddressId) { setAddressIssue("Please select a delivery address."); setAddressModal(true); return; }
    if (!contactNumber?.trim()) { alert("Please add a contact number to proceed."); return; }

    const martsToUse = useBestPricePlan ? bestPricePlanMarts : optimizerMarts;
    if (!martsToUse.length) { alert("No plan available."); return; }

    try {
      const res = await fetch("/api/v1/orders/from-plan/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Token ${token}` },
        body: JSON.stringify({
          plan: {
            marts: martsToUse.map(m => ({
              mart_id: m.mart_id,
              items: m.items.map(it => ({ product_id: it.product_id, qty: it.qty }))
            }))
          },
          address_id: selectedAddressId,
          contact_number: contactNumber,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Order placement failed");
      setCart([]);
      alert("Orders created successfully!");
      // navigate("/orders");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Could not place orders");
    }
  };

  /** derived */
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.quantity, 0), [cart]);

  /** Empty / Loading states */
  if (!cart.length) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold mb-3">Your cart is empty</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Add items from the products page to see the optimized plan.</p>
        <Button onClick={() => navigate("/shopping-list")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Products
        </Button>
      </div>
    );
  }
  if (loading && !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 animate-pulse rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map((k) => <div key={k} className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />)}
          </div>
          <div className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  const result = data?.result;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 px-4 py-8">
      {optError && (
        <div className="max-w-3xl mx-auto p-3 bg-red-100 text-red-800 rounded">
          <strong>Optimizer error:</strong> {optError}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
            Smart Cart
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            {totalItems} item{totalItems > 1 ? "s" : ""} • ETA ~ {result?.eta_total_min ?? 0} mins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/shopping-list")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Continue Shopping
          </Button>
          <Button variant="destructive" onClick={emptyCart} className="gap-2">
            <Trash2 className="h-4 w-4" /> Empty Cart
          </Button>
        </div>
      </div>

      {/* Plan chooser + comparison */}
      <Card className="border-blue-600/50">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" /> Choose your plan
            </CardTitle>
            <div className="inline-flex rounded-xl overflow-hidden border">
              <button
                onClick={() => setUseBestPricePlan(false)}
                className={`px-3 py-1.5 text-sm ${!useBestPricePlan ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-900"}`}
              >
                Optimizer Plan
              </button>
              <button
                onClick={() => setUseBestPricePlan(true)}
                className={`px-3 py-1.5 text-sm ${useBestPricePlan ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-900"}`}
              >
                Best-Price Plan
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`rounded-lg p-3 border ${!useBestPricePlan ? "border-blue-600" : ""}`}>
              <div className="text-sm text-gray-500">Optimizer Plan</div>
              <div className="mt-1 text-xs">Items: <strong>{money(currentItemsTotal)}</strong></div>
              <div className="text-xs">Delivery: <strong>{money(currentDeliveryTotal)}</strong></div>
              <div className="text-base font-semibold">Total: {money(currentGrand)}</div>
            </div>
            <div className={`rounded-lg p-3 border ${useBestPricePlan ? "border-blue-600" : ""}`}>
              <div className="text-sm text-gray-500">Best-Price Plan</div>
              <div className="mt-1 text-xs">Items: <strong>{money(bestItemsTotal)}</strong></div>
              <div className="text-xs">Delivery: <strong>{money(bestDeliveryTotal)}</strong></div>
              <div className="text-base font-semibold">Total: {money(bestGrand)}</div>
            </div>
            <div className="rounded-lg p-3 border">
              <div className="text-sm text-gray-500">Potential Savings</div>
              <div className="mt-1 text-emerald-600 font-semibold text-lg">
                {bestGrand < currentGrand ? `Save ${money(currentGrand - bestGrand)}` : "—"}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Best-Price picks the cheapest store for each product. Delivery may increase if more stores are involved.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marts & items */}
        <div className="lg:col-span-2 space-y-6">
          {(useBestPricePlan ? bestPricePlanMarts : result?.marts || []).map((mart) => (
            <Card key={mart.mart_id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" /> {mart.mart_name}
                  </CardTitle>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <Badge variant="secondary">{(mart.distance_km ?? 0).toFixed(1)} km</Badge>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" /> {mart.eta_min ?? 0} mins
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* 4-up product grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                  {mart.items.map((item) => {
                    const ring = ringFromId(item.product_id);
                    const header = headerFromId(item.product_id);
                    const currentQty = cart.find(c => c.product_id === item.product_id)?.quantity ?? item.qty;

                    // image: products map -> overrides -> DB fetch on error
                    const rawImg = productImageMap.get(item.product_id);
                    const src = buildImageSrc(rawImg);

                    // best price tag for original optimizer view
                    const best = bestByProduct[item.product_id];
                    const isCheapestHere = best && best.best_mart_id === mart.mart_id;

                    return (
                      <div
                        key={`${item.product_id}-${mart.mart_id}`}
                        className={`group rounded-xl border bg-white dark:bg-gray-800 overflow-hidden shadow-sm hover:shadow-md transition ring-1 ring-transparent ${ring}`}
                      >
                        <div className={`h-2 ${header}`} />
                        <div className="p-3 flex flex-col gap-2">
                          <div className="w-full aspect-[4/3] bg-gray-50 dark:bg-gray-800 rounded-md overflow-hidden">
                            {src ? (
                              <img
                                src={src}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  // lazy fetch from DB if not already
                                  fetchImageFromDB(item.product_id);
                                  (e.currentTarget as HTMLImageElement).src =
                                    "data:image/svg+xml;utf8," +
                                    encodeURIComponent(
                                      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
                                        <rect width='100%' height='100%' fill='#f3f4f6'/>
                                        <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='#9ca3af'>Loading…</text>
                                      </svg>`
                                    );
                                }}
                              />
                            ) : (
                              <div className="w-full h-full grid place-items-center text-xs text-gray-400">
                                <button onClick={() => fetchImageFromDB(item.product_id)} className="underline">Load image</button>
                              </div>
                            )}
                          </div>

                          <div className="min-h-[3rem]">
                            <div className="font-medium line-clamp-2">{item.name}</div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Qty: <span className="font-medium">{currentQty}</span>
                            </div>
                            <div className="font-semibold text-blue-600 dark:text-blue-400">
                              {money(item.unit_price)} <span className="text-xs text-gray-500">/unit</span>
                            </div>
                          </div>

                          {/* Best-price suggestion badge (only show on Optimizer Plan if a cheaper mart exists) */}
                          {!useBestPricePlan && best && !isCheapestHere && (
                            <div className="text-xs rounded-md px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Best ₹{best.best_unit.toFixed(2)} at <strong>{best.best_mart_name}</strong>
                            </div>
                          )}

                          {/* Quantity + Remove */}
                          <div className="flex items-center justify-between mt-1">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => decreaseQty(item.product_id)}
                                className="h-8 w-8 rounded-md grid place-items-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                                title="Decrease"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <div className="w-8 text-center text-sm">{currentQty}</div>
                              <button
                                onClick={() => increaseQty(item.product_id)}
                                className="h-8 w-8 rounded-md grid place-items-center bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
                                title="Increase"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.product_id)}
                              className="h-8 px-3 rounded-md inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700"
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Separator className="my-4" />
                <div className="flex justify-between text-sm">
                  <span>Delivery Fee:</span>
                  <span>{money(mart.delivery_charge)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary (sticky) */}
        <div className="space-y-4 lg:sticky lg:top-20 h-max">
          <Card className="shadow-card border-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" /> Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-1" />
                  <div className="text-sm flex-1">
                    <div className="font-semibold">Deliver to</div>
                    <div className="text-gray-600 dark:text-gray-300">
                      {selectedAddressSummary || "Select a delivery address"}
                    </div>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setAddressModal(true)}>Change</Button>
                </div>

                <div className="flex items-center gap-2">
                  <PhoneCall className="h-4 w-4" />
                  <input
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="Contact number"
                    className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between"><span>Items</span><span>{money(useBestPricePlan ? bestItemsTotal : currentItemsTotal)}</span></div>
                <div className="flex justify-between"><span>Delivery</span><span>{money(useBestPricePlan ? bestDeliveryTotal : currentDeliveryTotal)}</span></div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-blue-600 dark:text-blue-400">{money(useBestPricePlan ? bestGrand : currentGrand)}</span>
                </div>
              </div>

              <Button
                onClick={placeOrders}
                disabled={!selectedAddressId || !isLikelyGeocodable(selectedAddressSummary)}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-4 font-semibold gap-2 disabled:opacity-60"
              >
                <Sparkles className="h-5 w-5" /> {useBestPricePlan ? "Place Best-Price Orders" : "Place Optimizer Orders"}
              </Button>
              {useBestPricePlan && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> We’ll create one order per store in the best-price plan.
                </div>
              )}
            </CardContent>
          </Card>

          {data?.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Info className="h-4 w-4" /> Plan Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{data.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Address Modal */}
      {addressModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddressModal(false)} />
          <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-900 rounded-xl shadow-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Choose Delivery Address</h3>
              <button onClick={() => setAddressModal(false)} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              {addressIssue && (
                <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  {addressIssue}
                </div>
              )}
              <AddressPicker
                onSelect={(addr) => {
                  if (addr) {
                    setSelectedAddressId(addr.id);
                    const sum = `${addr.line1}${addr.city ? ", " + addr.city : ""}${addr.state ? ", " + addr.state : ""}${addr.pincode ? " " + addr.pincode : ""}`;
                    setSelectedAddressSummary(sum);
                    setAddressIssue("");
                  }
                }}
                onAddNew={() => { setAddressModal(false); navigate("/addresses"); }}
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={() => setAddressModal(false)}>Done</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedCart;
