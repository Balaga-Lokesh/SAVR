import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, TrendingDown, MapPin, Clock, CheckCircle, Sparkles } from "lucide-react";

interface CartItem {
  item: string;
  quantity: number;
  price: number;
  store: string;
  savings: number;
  quality: number;
}

interface OptimizedCartProps {
  items: CartItem[];
  onProceedToCheckout: () => void;
}

const mockOptimizedItems: CartItem[] = [
  { item: "Milk", quantity: 2, price: 3.49, store: "Mart A", savings: 1.50, quality: 4.5 },
  { item: "Bread", quantity: 1, price: 2.49, store: "Budget Store", savings: 1.00, quality: 3.5 },
  { item: "Apples", quantity: 3, price: 4.99, store: "Mart A", savings: 1.00, quality: 4.8 },
  { item: "Chicken", quantity: 1, price: 8.99, store: "Fresh Mart", savings: 2.00, quality: 4.2 },
  { item: "Rice", quantity: 1, price: 3.99, store: "Budget Store", savings: 1.50, quality: 4.0 }
];

const OptimizedCart: React.FC<OptimizedCartProps> = ({ onProceedToCheckout }) => {
  const totalPrice = mockOptimizedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalSavings = mockOptimizedItems.reduce((sum, item) => sum + (item.savings * item.quantity), 0);
  const originalTotal = totalPrice + totalSavings;

  const storeGroups = mockOptimizedItems.reduce((groups, item) => {
    if (!groups[item.store]) {
      groups[item.store] = [];
    }
    groups[item.store].push(item);
    return groups;
  }, {} as Record<string, CartItem[]>);

  const getQualityColor = (quality: number) => {
    if (quality >= 4.5) return 'text-success';
    if (quality >= 4.0) return 'text-warning';
    return 'text-muted-foreground';
  };

  const deliveryInfo = {
    "Mart A": { time: "25 mins", fee: 2.99 },
    "Fresh Mart": { time: "35 mins", fee: 3.49 },
    "Budget Store": { time: "45 mins", fee: 1.99 }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Optimized Shopping Cart
        </h2>
        <p className="text-muted-foreground">
          AI-powered cost and quality optimization across multiple stores
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Store Groups */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(storeGroups).map(([store, items]) => (
            <Card key={store} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-fresh" />
                    {store}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {deliveryInfo[store as keyof typeof deliveryInfo]?.time}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-card rounded-lg">
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="font-medium">{item.quantity}x {item.item}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Quality: <span className={getQualityColor(item.quality)}>{item.quality}</span>
                            </Badge>
                            {item.savings > 0 && (
                              <Badge className="bg-savings text-savings-foreground text-xs">
                                <TrendingDown className="h-3 w-3 mr-1" />
                                Save ${item.savings.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-fresh">${(item.price * item.quantity).toFixed(2)}</div>
                        {item.savings > 0 && (
                          <div className="text-xs text-muted-foreground line-through">
                            ${((item.price + item.savings) * item.quantity).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee:</span>
                    <span>${deliveryInfo[store as keyof typeof deliveryInfo]?.fee}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
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
                  <span>Original Total:</span>
                  <span className="line-through text-muted-foreground">${originalTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-success font-semibold">
                  <span>You Save:</span>
                  <span>-${totalSavings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fees:</span>
                  <span>$8.47</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-fresh">${(totalPrice + 8.47).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-success/10 p-3 rounded-lg border border-success/20">
                <div className="flex items-center gap-2 text-success font-semibold mb-1">
                  <CheckCircle className="h-4 w-4" />
                  Optimization Complete
                </div>
                <p className="text-xs text-success/80">
                  Saved ${totalSavings.toFixed(2)} with multi-store optimization
                </p>
              </div>

              <Button 
                onClick={onProceedToCheckout}
                className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Proceed to Checkout
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardContent className="p-4">
              <h4 className="font-semibold text-sm mb-2">Optimization Benefits</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Best prices across 3 stores</li>
                <li>• Quality-based selection</li>
                <li>• Minimized delivery costs</li>
                <li>• Fresh product guarantee</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OptimizedCart;