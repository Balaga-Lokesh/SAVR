import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, MapPin, Clock, CheckCircle, Truck, User } from "lucide-react";
import AddressPicker from './AddressPicker';

interface CheckoutFlowProps {
  onOrderComplete: () => void;
  cart?: { product_id: number; quantity: number }[];
  setCart?: React.Dispatch<React.SetStateAction<any[]>>;
}

const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ onOrderComplete, cart = [], setCart }) => {
  const [step, setStep] = useState<'details' | 'payment' | 'confirmation'>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    nameOnCard: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [optimizerPlan, setOptimizerPlan] = useState<any | null>(null);
  const [honorPlan, setHonorPlan] = useState<boolean>(false);
  const [selectedAddress, setSelectedAddress] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderResults, setOrderResults] = useState<any[] | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('selectedPlan');
      const parsed = stored ? JSON.parse(stored) : null;
      setOptimizerPlan(parsed);
      setHonorPlan(Boolean(parsed && Array.isArray(parsed.marts) && parsed.marts.length > 0));
    } catch (e) {
      setOptimizerPlan(null);
      setHonorPlan(false);
    }
  }, []);

  const handleNext = () => {
    if (step === 'details') {
      setStep('payment');
    } else if (step === 'payment') {
  // attempt to create order(s) against backend
      const createOrder = async () => {
        try {
          // ensure basic validation
          if (!formData.address && !selectedAddress) {
            alert('Please provide or select an address');
            return;
          }
          if (!formData.phone) {
            alert('Please provide phone');
            return;
          }

          const token = typeof window !== 'undefined' ? sessionStorage.getItem('authToken') : null;
          if (!token) {
            window.location.href = '/login';
            return;
          }

          // Map cart items to backend shape
          const items = (cart || []).map((it: any) => ({ product_id: it.product_id, quantity: it.quantity }));
          // create/fetch address: prefer selectedAddress (from picker). If none, create using formData.address
          let address_id = selectedAddress?.id || null;
          if (!address_id) {
            // Attempt client-side geocoding (Nominatim) to include lat/long for more reliable server behavior
            let location_lat: number | null = null;
            let location_long: number | null = null;
            try {
              const q = encodeURIComponent(formData.address);
              const nomUrl = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;
              const g = await fetch(nomUrl, { method: 'GET', headers: { 'Accept': 'application/json' } });
              if (g.ok) {
                const results = await g.json();
                if (Array.isArray(results) && results.length > 0) {
                  location_lat = parseFloat(results[0].lat);
                  location_long = parseFloat(results[0].lon);
                }
              }
            } catch (e) {
              console.warn('client geocode failed', e);
            }

            const addrPayload: any = { line1: formData.address, contact_phone: formData.phone };
            if (location_lat != null && location_long != null) {
              addrPayload.location_lat = location_lat;
              addrPayload.location_long = location_long;
            }

            const addrRes = await fetch('/api/v1/addresses/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
              body: JSON.stringify(addrPayload),
            });

          if (!addrRes.ok) {
            const aerr = await addrRes.json().catch(() => ({}));
            throw new Error(aerr?.error || 'Failed to create address');
          }
            const addrJson = await addrRes.json();
            address_id = addrJson?.id || addrJson?.address_id || null;
          }

          // If an optimizer plan exists in sessionStorage and user chose to honor it,
          // create one order per mart to reflect the optimizer plan. Otherwise create a single order.
          const stored = sessionStorage.getItem('selectedPlan');
          let plan = null;
          try {
            plan = stored ? JSON.parse(stored) : null;
          } catch (e) {
            plan = null;
          }

          // use local honorPlan state instead of global
          const honorPlanLocal = honorPlan && !!plan;

          let orderJson = null;

          if (honorPlanLocal && plan && Array.isArray(plan.marts)) {
            // submit plan atomically via backend endpoint
            const r = await fetch('/api/v1/orders/create-from-plan/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
              body: JSON.stringify({ plan, address_id, contact_number: formData.phone }),
            });
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              throw new Error(err?.error || 'Plan-based order creation failed');
            }
            const body = await r.json();
            setOrderResults(body.orders || null);
            orderJson = (body.orders && body.orders[0]) || null;
          } else {
            // single order fallback
            const res = await fetch('/api/v1/orders/create/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
              body: JSON.stringify({ items, address_id, contact_number: formData.phone }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err?.error || 'Order creation failed');
            }
            orderJson = await res.json();
          }

          // success — show confirmation and clear cart
          setStep('confirmation');
          setTimeout(() => {
            if (setCart) setCart([]);
            onOrderComplete();
            const orderId = orderJson?.order_id || orderJson?.id;
            if (orderId) window.location.href = `/orders/${orderId}`;
          }, 1500);
        } catch (e: any) {
          console.error(e);
          alert(e?.message || 'Order submission failed');
        }
      };

      createOrder();
    }
  };

  const deliverySlots = [
    { time: "Today, 3:00 PM - 4:00 PM", price: 4.99, available: true },
    { time: "Today, 6:00 PM - 7:00 PM", price: 3.99, available: true },
    { time: "Tomorrow, 10:00 AM - 11:00 AM", price: 2.99, available: true },
    { time: "Tomorrow, 2:00 PM - 3:00 PM", price: 2.99, available: false }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Complete Your Order
        </h2>
        <p className="text-muted-foreground">
          Secure checkout with multiple delivery options
        </p>
      </div>

      {step === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter your delivery address"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Delivery Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliverySlots.map((slot, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      slot.available 
                        ? 'hover:border-fresh hover:bg-fresh/5' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{slot.time}</div>
                        <div className="text-sm text-muted-foreground">
                          Delivery fee: ${slot.price}
                        </div>
                      </div>
                      {slot.available ? (
                        <Badge variant="outline" className="border-fresh text-fresh">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Full
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              onClick={handleNext}
              className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg"
              disabled={!formData.name || !formData.email || !formData.address}
            >
              Continue to Payment
            </Button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    placeholder="MM/YY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    value={formData.cvv}
                    onChange={(e) => handleInputChange('cvv', e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameOnCard">Name on Card</Label>
                <Input
                  id="nameOnCard"
                  value={formData.nameOnCard}
                  onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
                  placeholder="Enter name as on card"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-fresh">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>$24.99</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fees:</span>
                  <span>$8.47</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Savings:</span>
                  <span>-$7.00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-fresh">$33.46</span>
                </div>
              </div>

              <div className="bg-fresh/10 p-3 rounded-lg">
                <div className="text-sm font-medium text-fresh mb-1">Delivery Details</div>
                <div className="text-xs text-fresh/80">
                  Today, 3:00 PM - 4:00 PM<br />
                  {formData.address || "123 Main Street, City"}
                </div>
              </div>

              {/* Optimizer plan toggle + preview */}
              {optimizerPlan && (
                <div className="p-3 rounded-lg border mt-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={honorPlan}
                      onChange={(e) => setHonorPlan(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Honor optimizer plan (create one order per mart)</span>
                  </label>

                  <div className="mt-2 text-xs text-muted-foreground">
                    <div className="font-medium">Plan preview:</div>
                    <ul className="list-disc pl-5 mt-1">
                      {optimizerPlan.marts?.map((m: any) => (
                        <li key={m.mart_id} className="truncate">{m.mart_name} — {m.items?.length || 0} items</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <Button
                onClick={handleNext}
                className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg"
                disabled={!formData.cardNumber || !formData.nameOnCard}
              >
                Complete Order
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'confirmation' && (
        <Card className="shadow-card max-w-2xl mx-auto text-center">
          <CardContent className="p-6">
            {submitting ? (
              <div className="py-12">Submitting your order(s)...</div>
            ) : submitError ? (
              <div className="py-8 text-red-600">{submitError}</div>
            ) : (
              <>
                <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-10 w-10 text-success" />
                </div>
                <h3 className="text-2xl font-bold text-success mb-2">Order Confirmed!</h3>
                <p className="text-muted-foreground mb-4">
                  Your order(s) have been placed successfully.
                </p>

                {orderResults && (
                  <div className="space-y-3 mb-4">
                    {orderResults.map((o: any) => (
                      <div key={o.id || o.order_id} className="p-3 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">Order #{o.order_id || o.id}</div>
                            <div className="text-xs text-muted-foreground">Mart: {o.chosen_mart_name}</div>
                          </div>
                          <div className="text-sm font-bold">₹{o.total_cost}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={onOrderComplete}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  Track Your Order(s)
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CheckoutFlow;