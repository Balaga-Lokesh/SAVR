import React from 'react';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, TrendingDown, MapPin, Clock, CheckCircle, Sparkles } from "lucide-react";
import ExplainSwapsDialog from './ExplainSwapsDialog';

interface IncomingItem {
  id?: string; // product id when available
  product_id?: string | number;
  name?: string;
  quantity: number;
}

interface OptimizedCartProps {
  items: IncomingItem[];
  onProceedToCheckout?: (plan?: any) => void;
}

type PlanMartItem = {
  product_id: number | string;
  name: string;
  qty: number;
  unit_price: number;
  line_price: number;
};

type PlanMart = {
  mart_id: number | string;
  mart_name: string;
  distance_km: number;
  eta_min: number;
  weight_kg: number;
  delivery_charge: number;
  items: PlanMartItem[];
};

type OptimizeResult = {
  items_price: number;
  delivery_total: number;
  grand_total: number;
  eta_total_min: number;
  marts: PlanMart[];
};

const OptimizedCart: React.FC<OptimizedCartProps> = ({ items, onProceedToCheckout }) => {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<OptimizeResult | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [originalItemsForDialog, setOriginalItemsForDialog] = React.useState<any[] | null>(null);
  const confirmTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    // Build payload expected by backend: list of { product_id, quantity }
    const payloadItems = (items || []).map((it) => {
      return {
        product_id: it.product_id ?? it.id,
        quantity: it.quantity ?? 1,
      };
    }).filter(i => i.product_id != null);

    if (payloadItems.length === 0) {
      setResult(null);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch('/api/v1/basket/optimize/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // request optimizer to allow swapping products across marts
      body: JSON.stringify({ items: payloadItems, allow_swaps: true }),
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Status ${res.status}`);
      }
      return res.json();
    }).then((data) => {
      // backend returns { result: { ... } }
      const plan = data?.result ?? null;
      setResult(plan);
      // fetch original product details (prices) so dialog can show deltas
      (async () => {
        try {
          const originalIds = Array.from(new Set(payloadItems.map((p) => p.product_id).filter(Boolean)));
          if (originalIds.length > 0) {
            const proms = originalIds.map((id) => fetch(`/api/v1/products/${id}/`).then((r) => r.ok ? r.json() : null).catch(() => null));
            const results = await Promise.all(proms);
            const map = new Map<string, any>();
            for (const r of results) {
              if (r && r.product_id != null) map.set(String(r.product_id), r);
            }
            const enriched = (payloadItems || []).map((it) => {
              const prod = map.get(String(it.product_id));
              return {
                product_id: it.product_id,
                name: prod?.name || undefined,
                quantity: it.quantity || 1,
                unit_price: prod && prod.price ? parseFloat(String(prod.price)) : undefined,
              };
            });
            setOriginalItemsForDialog(enriched);
          }
        } catch (e) {
          // ignore fetch failures
          setOriginalItemsForDialog(null);
        }
      })();
      if (plan && onProceedToCheckout) {
        // show a premium toast with confirm/cancel actions
  const t = toast({
          title: 'Optimized plan ready',
          description: `Total: ₹${plan.grand_total.toFixed(2)} — click Proceed to confirm`,
          action: (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="px-3 py-1 bg-fresh text-white rounded"
                  onClick={() => {
                  t.dismiss();
                  // show explanation dialog before proceeding
                  setDialogOpen(true);
                }}
              >
                Proceed
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="px-3 py-1 border rounded"
                onClick={() => t.dismiss()}
              >
                Cancel
              </Button>
            </div>
          ),
        });
        // auto-dismiss after 6s
        setTimeout(() => t.dismiss(), 6000);
      }
    }).catch((err) => {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Failed to fetch optimization');
    }).finally(() => setLoading(false));

    return () => controller.abort();
  }, [items]);

  const handleProceed = () => {
    if (onProceedToCheckout) onProceedToCheckout(result ?? undefined);
    // lightweight success feedback: summarise the plan and show confirmation
    if (result) {
      const summary = `Proceeding to checkout — Total: ₹${result.grand_total.toFixed(2)}, Marts: ${result.marts.length}`;
      setSuccessMsg(summary);
      // auto-clear after 4s
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleConfirmProceed = () => {
    if (confirmTimerRef.current) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setShowConfirm(false);
    if (onProceedToCheckout && result) onProceedToCheckout(result);
    // also show transient success
    if (result) {
      const summary = `Proceeding to checkout — Total: ₹${result.grand_total.toFixed(2)}`;
      setSuccessMsg(summary);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleCancelAutoProceed = () => {
    if (confirmTimerRef.current) {
      window.clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
    setShowConfirm(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Optimized Shopping Cart
        </h2>
        <p className="text-muted-foreground">AI-powered cost and quality optimization across multiple stores</p>
      </div>

      {loading && (
        <div className="text-center text-muted-foreground">Calculating best plan…</div>
      )}

      {error && (
        <div className="text-center text-destructive">Error: {error}</div>
      )}

      {!loading && !result && !error && (
        <div className="text-center text-muted-foreground">No items to optimize.</div>
      )}

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {result.marts.map((mart) => (
              <Card key={String(mart.mart_id)} className="shadow-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-fresh" />
                      {mart.mart_name}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {mart.eta_min} min
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {mart.distance_km} km
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mart.items.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gradient-card rounded-lg">
                        <div>
                          <ExplainSwapsDialog
                            open={dialogOpen}
                            onClose={() => setDialogOpen(false)}
                            onProceed={() => { if (onProceedToCheckout && result) onProceedToCheckout(result); }}
                            plan={result}
                            originalItems={originalItemsForDialog ?? items}
                          />
                          <span className="font-medium">{it.qty}x {it.name}</span>
                          <div className="text-xs text-muted-foreground">Unit: ₹{it.unit_price.toFixed(2)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-fresh">₹{it.line_price.toFixed(2)}</div>
                        </div>
                      </div>
                    ))}

                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span>Delivery Fee:</span>
                      <span>₹{mart.delivery_charge}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Weight:</span>
                      <span>{mart.weight_kg} kg</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card className="shadow-card border-fresh">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Items Total:</span>
                    <span className="text-muted-foreground">₹{result.items_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery Total:</span>
                    <span>₹{result.delivery_total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated ETA:</span>
                    <span>{result.eta_total_min} mins</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span className="text-fresh">₹{result.grand_total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-success/10 p-3 rounded-lg border border-success/20">
                  <div className="flex items-center gap-2 text-success font-semibold mb-1">
                    <CheckCircle className="h-4 w-4" />
                    Optimization Complete
                  </div>
                  <p className="text-xs text-success/80">Optimized across available marts. ETA is rough estimate from distance.</p>
                </div>

                <Button onClick={handleProceed} className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Proceed to Checkout
                </Button>
                {successMsg && (
                  <div className="mt-3 p-3 bg-fresh/10 rounded text-sm text-fresh">{successMsg}</div>
                )}
                {showConfirm && result && (
                  <div className="mt-3 p-3 bg-gradient-card rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Optimized plan ready</div>
                      <div className="text-xs text-muted-foreground">Total: ₹{result.grand_total.toFixed(2)} — Auto-proceeding in 4s</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleConfirmProceed} className="bg-fresh">Proceed</Button>
                      <Button size="sm" variant="ghost" onClick={handleCancelAutoProceed}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-2">Optimization Benefits</h4>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Best prices across nearby marts</li>
                  <li>• Minimized delivery costs per mart</li>
                  <li>• ETA estimate based on straight-line distance</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizedCart;