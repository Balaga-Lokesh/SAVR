import React, { useState } from "react";
import { useCart } from "../contexts/CartContext";
import { useProducts } from "../contexts/ProductsContext";
import { Label } from "@/components/ui/label";

const CheckoutFlow: React.FC = () => {
  const { cart, setCart } = useCart();
  const { products } = useProducts();

  const [step, setStep] = useState<"address" | "payment" | "confirmation">("address");
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [formData, setFormData] = useState<any>({
    address: "",
    phone: "",
    name: "",
    email: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "cod">("razorpay");

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (step === "address") {
      if (!formData.address && !selectedAddress) {
        alert("Please provide or select an address");
        return;
      }
      if (!formData.phone) {
        alert("Please provide phone");
        return;
      }
      setStep("payment");
      return;
    }

    if (step === "payment") {
      try {
        // Ensure user is authenticated via cookie
        try {
          const me = await fetch('/api/v1/auth/me/', { credentials: 'include' });
          if (!me.ok) { window.location.href = '/login'; return; }
        } catch (e) { window.location.href = '/login'; return; }

        const items = (cart || []).map((it: any) => ({
          product_id: it.product_id,
          quantity: it.quantity,
        }));

        // ensure address exists
        let address_id = selectedAddress?.id || null;
        if (!address_id) {
          let location_lat: number | null = null;
          let location_long: number | null = null;
          try {
            const q = encodeURIComponent(formData.address);
            const nomUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
            const g = await fetch(nomUrl, {
              method: "GET",
              headers: { Accept: "application/json" },
            });
            if (g.ok) {
              const results = await g.json();
              if (Array.isArray(results) && results.length > 0) {
                location_lat = parseFloat(results[0].lat);
                location_long = parseFloat(results[0].lon);
              }
            }
          } catch (e) {
            console.warn("client geocode failed", e);
          }

          const addrPayload: any = { line1: formData.address, contact_phone: formData.phone };
          if (location_lat != null && location_long != null) {
            addrPayload.location_lat = location_lat;
            addrPayload.location_long = location_long;
          }

          const addrRes = await fetch("/api/v1/addresses/", {
            method: "POST",
            credentials: 'include',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(addrPayload),
          });
          if (!addrRes.ok) {
            const aerr = await addrRes.json().catch(() => ({}));
            throw new Error(aerr?.error || "Failed to create address");
          }
          const addrJson = await addrRes.json();
          address_id = addrJson?.id || addrJson?.address_id || null;
        }

        // compute amount from cart
        let amount = (cart || []).reduce((s: number, it: any) => {
          const prod = (products || []).find((p: any) => p.product_id === it.product_id);
          const price = prod?.price ?? 0;
          return s + price * it.quantity;
        }, 0);
        amount = Math.max(0.01, Number(amount));

        if (paymentMethod === "cod") {
          // COD flow
          const res = await fetch("/api/v1/orders/create/", {
            method: "POST",
            credentials: 'include',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items,
              address_id,
              contact_number: formData.phone,
              payment_method: "COD",
              amount,
            }),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || "Order creation failed");
          setStep("confirmation");
          if (setCart) setCart([]);
          window.location.href = `/orders/${json?.order_id || json?.id}`;
          return;
        }

        // Razorpay online flow
        // 1) ask backend to create a Razorpay order
        const createRes = await fetch("/api/v1/payments/razorpay/create-order/", {
          method: "POST",
          credentials: 'include',
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            currency: "INR",
            receipt: `savr-${Date.now()}`,
            notes: {},
          }),
        });
        const createJson = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error(createJson?.error || "Failed to create razorpay order on server");

        const { key_id, razorpay_order_id, payment_id } = createJson;
        if (!key_id || !razorpay_order_id || !payment_id)
          throw new Error("Invalid payment init response from server");

        // 2) load Razorpay script if not present
        await new Promise<void>((resolve, reject) => {
          if ((window as any).Razorpay) return resolve();
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
          document.head.appendChild(s);
        });

        // 3) open checkout
  const cs = getComputedStyle(document.documentElement);
  const rawRz = cs.getPropertyValue('--primary-foreground');
  const rzColor = rawRz && rawRz.trim() ? `hsl(${rawRz.trim()})` : 'hsl(174 74% 43%)';
  const options = {
          key: key_id,
          amount: Math.round(Number(amount) * 100),
          currency: "INR",
          name: "SAVR",
          description: "Order payment",
          order_id: razorpay_order_id,
          handler: async function (response: any) {
            try {
              // verify on server
              const verifyRes = await fetch("/api/v1/payments/razorpay/verify/", {
                method: "POST",
                credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  payment_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const verifyJson = await verifyRes.json().catch(() => ({}));
              if (!verifyRes.ok)
                throw new Error(verifyJson?.error || "Payment verification failed");

              // create actual order in system
              const orderRes = await fetch("/api/v1/orders/create/", {
                method: "POST",
                credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  items,
                  address_id,
                  contact_number: formData.phone,
                  payment_id,
                  amount,
                }),
              });
              const orderJson = await orderRes.json().catch(() => ({}));
              if (!orderRes.ok) throw new Error(orderJson?.error || "Order creation failed after payment");

              setStep("confirmation");
              if (setCart) setCart([]);
              window.location.href = `/orders/${orderJson?.order_id || orderJson?.id}`;
            } catch (err: any) {
              console.error("post-payment error", err);
              alert(err?.message || "Payment succeeded but order finalization failed. Contact support.");
            }
          },
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone,
          },
          notes: { address_id },
          theme: { color: rzColor },
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      } catch (e: any) {
        console.error("Payment flow failed:", e);
        alert(e?.message || "Checkout failed");
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      {step === "address" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Shipping Address</h2>
          <textarea
            className="w-full border rounded p-2"
            placeholder="Enter your address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
          <input
            className="w-full border rounded p-2"
            placeholder="Phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
          />
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
            onClick={handleNext}
          >
            Continue to Payment
          </button>
        </div>
      )}

      {step === "payment" && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Payment Method</h2>
          <div className="flex gap-3 items-center">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "razorpay"}
                onChange={() => setPaymentMethod("razorpay")}
              />
              <span>Online (UPI / Card / Wallet)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pm"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
              />
              <span>Cash on Delivery</span>
            </label>
          </div>
          <button
            className="bg-success text-success-foreground px-4 py-2 rounded"
            onClick={handleNext}
          >
            Place Order
          </button>
        </div>
      )}

      {step === "confirmation" && (
        <div className="text-center p-4">
          <h2 className="text-xl font-bold">Order Confirmed</h2>
          <p>Thank you for your order!</p>
        </div>
      )}
    </div>
  );
};

export default CheckoutFlow;
