// src/components/OptimizedCart.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  MapPin,
  Clock,
  CheckCircle,
  Sparkles,
  Trash2,
  Plus,
  Minus,
  ArrowLeft,
  PhoneCall,
  Home,
} from "lucide-react";

interface CartItem {
  product_id: number;
  quantity: number;
  weight_kg?: number;
}

interface BackendMart {
  mart_id: number;
  mart_name: string;
  distance_km: number;
  eta_min: number;
  weight_kg: number;
  delivery_charge: number;
  items: {
    product_id: number;
    name: string;
    qty: number;
    unit_price: number;
    line_price: number;
  }[];
}

interface OptimizeResult {
  items_price: number;
  delivery_total: number;
  grand_total: number;
  eta_total_min: number;
  marts: BackendMart[];
}

interface OptimizeResponse {
  result: OptimizeResult;
  items_count: number;
  notes: string;
  address?: { id: number; summary: string; lat: number; long: number };
}

interface MeResponse {
  user_id: number;
  username: string;
  email: string;
  contact_number: string;
  default_address?: {
    id: number;
    label: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    is_default: boolean;
  } | null;
}

interface OptimizedCartProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

const OptimizedCart: React.FC<OptimizedCartProps> = ({ cart, setCart }) => {
  const navigate = useNavigate();
  const [data, setData] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [optError, setOptError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [contactNumber, setContactNumber] = useState<string>("");

  const token = typeof window !== "undefined" ? sessionStorage.getItem("authToken") : null;

  // Fetch profile (for default address + phone)
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        navigate("/login");
        return;
      }
      try {
        const res = await fetch("/api/v1/auth/me/", { headers: { Authorization: `Token ${token}` } });
        if (res.ok) {
          const j = await res.json();
          setProfile(j);
          if (j?.contact_number) setContactNumber(j.contact_number);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMe();
  }, [token, navigate]);

  // call optimizer when profile is ready or cart changes
  useEffect(() => {
    if (!profile) return;
    fetchOptimized();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, cart]);

  // Call optimizer when cart changes
  const fetchOptimized = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    if (!cart.length) return;

    setLoading(true);
    setOptError(null);
    try {
      // Ensure we have a delivery address (backend requires an address on file)
      if (profile === null) {
        // profile still loading — wait for it via effect dependency
        setOptError('Loading profile, please wait...');
        return;
      }

      if (!profile?.default_address) {
        setOptError('No default address found. Please add a delivery address in Profile > Addresses before optimizing.');
        return;
      }

      // Normalize payload shape to what backend expects and include address_id
      const payload = {
        items: cart.map((it) => ({ product_id: it.product_id, quantity: it.quantity })),
        address_id: profile.default_address.id,
      };
      console.debug("Optimize payload:", payload);

      const res = await fetch("/api/v1/basket/optimize/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Token ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // try to parse backend error for better debugging
        const errBody = await res.text().catch(() => "");
        let parsed = errBody;
        try {
          parsed = JSON.parse(errBody);
        } catch (e) {
          // keep raw text
        }
        console.error("Optimizer error response:", parsed);
        setOptError(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
        throw new Error("Failed to optimize basket: " + (typeof parsed === "string" ? parsed : JSON.stringify(parsed)));
      }

      const json = (await res.json()) as OptimizeResponse;
      console.debug("Optimize response:", json);
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // optimizer is triggered when profile is ready and when cart changes via the other effect

  const increaseQty = (product_id: number) => {
    setCart((prev) =>
      prev.map((it) => (it.product_id === product_id ? { ...it, quantity: it.quantity + 1 } : it))
    );
  };

  const decreaseQty = (product_id: number) => {
    setCart((prev) =>
      prev
        .map((it) =>
          it.product_id === product_id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const removeItem = (product_id: number) => {
    setCart((prev) => prev.filter((it) => it.product_id !== product_id));
  };

  // helper: find whether a given plan product_id maps to an item currently present in cart
  const findCartMatch = (planProductId: number) => {
    return cart.find((c) => c.product_id === planProductId) || null;
  };

  const proceedToCheckout = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    // Prefer address from optimizer response, else profile default
    const addressId =
      data?.address?.id ??
      (profile?.default_address?.id ?? null);

    if (!addressId) {
      alert("Please set a default address in Profile > Addresses before checkout.");
      navigate("/profile");
      return;
    }
    if (!contactNumber?.trim()) {
      alert("Please add a contact number to proceed.");
      return;
    }

    try {
      // store the optimizer plan for the checkout page to consume
      try {
        sessionStorage.setItem("selectedPlan", JSON.stringify(data.result));
      } catch (e) {
        console.warn("Could not persist selectedPlan", e);
      }
      // navigate to checkout where we will create the order(s)
      navigate("/checkout");
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Something went wrong while creating the order.");
    }
  };

  if (!cart.length) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold mb-3">Your cart is empty</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Add some items from the products page to see the optimized plan.
        </p>
        <Button onClick={() => navigate("/shopping-list")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>
      </div>
    );
  }

  if (loading || !data) {
  return <p className="p-6 text-center">Optimizing your basket...</p>;
  }

  const { result } = data;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 px-4 py-8">
      {optError && (
        <div className="max-w-3xl mx-auto p-3 bg-red-100 text-red-800 rounded">
          <strong>Optimizer error:</strong> {optError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
            Optimized Shopping Cart
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Cheapest combination of marts with real delivery costs
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/shopping-list")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Continue Shopping
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Groups */}
        <div className="lg:col-span-2 space-y-4">
          {result.marts.map((mart) => (
            <Card key={mart.mart_id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    {mart.mart_name}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    {mart.eta_min} mins
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mart.items.map((item) => (
                    <div
                      key={`${item.product_id}-${mart.mart_id}`}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="min-w-0">
                        <span className="font-medium line-clamp-1">
                          {item.qty}x {item.name}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="font-semibold text-blue-600 dark:text-blue-400">
                          ₹{item.line_price.toFixed(2)}
                        </div>
                        <div className="flex gap-1">
                          {/* disable controls if the plan item doesn't correspond to a cart entry */}
                          {(() => {
                            const match = findCartMatch(item.product_id);
                            const disabled = !match;
                            return (
                              <>
                                <button
                                  onClick={() => !disabled && decreaseQty(item.product_id)}
                                  className={`px-2 py-1 ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 dark:bg-gray-600'} rounded`}
                                  title="Decrease"
                                  disabled={disabled}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => !disabled && increaseQty(item.product_id)}
                                  className={`px-2 py-1 ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-gray-200 dark:bg-gray-600'} rounded`}
                                  title="Increase"
                                  disabled={disabled}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => !disabled && removeItem(item.product_id)}
                                  className={`px-2 py-1 ${disabled ? 'bg-gray-200 text-gray-400' : 'bg-red-500 text-white'} rounded`}
                                  title="Remove"
                                  disabled={disabled}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee:</span>
                    <span>₹{mart.delivery_charge.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <div className="space-y-4">
          <Card className="shadow-card border-blue-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Address + Contact quick glance */}
              <div className="space-y-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-start gap-2">
                  <Home className="h-4 w-4 mt-1" />
                  <div className="text-sm">
                    <div className="font-semibold">Deliver to</div>
                    <div className="text-gray-600 dark:text-gray-300">
                      {data.address?.summary ||
                        (profile?.default_address
                          ? `${profile.default_address.line1}, ${profile.default_address.city} ${profile.default_address.pincode}`
                          : "No default address set")}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => navigate("/addresses")}
                    >
                      Change address
                    </Button>
                  </div>
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
                <div className="flex justify-between">
                  <span>Items:</span>
                  <span>₹{result.items_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fees:</span>
                  <span>₹{result.delivery_total.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600 dark:text-blue-400">
                    ₹{result.grand_total.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-green-100 p-3 rounded-lg border border-green-200 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-semibold">Optimization Complete</span>
              </div>

              <Button
                onClick={proceedToCheckout}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-4 font-semibold gap-2"
              >
                <Sparkles className="h-5 w-5" /> Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OptimizedCart;
