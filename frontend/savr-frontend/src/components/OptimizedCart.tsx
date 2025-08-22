import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingDown, MapPin, Clock, CheckCircle, Sparkles, Trash2, Plus, Minus } from "lucide-react";

interface Product {
  product_id: number;
  name: string;
  category: string;
  price: number;
  quality_score: number;
  mart_name: string;
}

interface CartItem {
  product_id: number;
  quantity: number;
}

interface OptimizedCartItem {
  item: string;
  quantity: number;
  price: number;
  store: string;
  savings: number;
  quality: number;
}

const OptimizedCart: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, products } = location.state as { cart: CartItem[]; products: Product[] };

  const [optimizedItems, setOptimizedItems] = useState<OptimizedCartItem[]>([]);

  // Dummy AI optimization function (replace with your real AI logic)
  const computeOptimizedCart = (): OptimizedCartItem[] => {
    return cart.map((c) => {
      const product = products.find((p) => p.product_id === c.product_id)!;
      // Example logic: savings = 10% if quality > 4
      const savings = product.quality_score > 4 ? product.price * 0.1 : 0;
      return {
        item: product.name,
        quantity: c.quantity,
        price: product.price - savings,
        store: product.mart_name,
        savings: savings,
        quality: product.quality_score
      };
    });
  };

  useEffect(() => {
    setOptimizedItems(computeOptimizedCart());
  }, [cart, products]);

  const storeGroups = optimizedItems.reduce((groups, item) => {
    if (!groups[item.store]) groups[item.store] = [];
    groups[item.store].push(item);
    return groups;
  }, {} as Record<string, OptimizedCartItem[]>);

  const deliveryInfo = Object.keys(storeGroups).reduce((info, store) => {
    info[store] = { time: `${25 + Math.floor(Math.random() * 20)} mins`, fee: 2.5 + Math.random() * 2 };
    return info;
  }, {} as Record<string, { time: string; fee: number }>);

  const getQualityColor = (quality: number) => {
    if (quality >= 4.5) return "text-green-600 dark:text-green-400";
    if (quality >= 4.0) return "text-yellow-600 dark:text-yellow-400";
    return "text-gray-500 dark:text-gray-400";
  };

  const handleQuantityChange = (index: number, delta: number) => {
    setOptimizedItems((prev) => {
      const newItems = [...prev];
      newItems[index].quantity = Math.max(1, newItems[index].quantity + delta);
      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    setOptimizedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSavings = optimizedItems.reduce((sum, i) => sum + i.savings * i.quantity, 0);
  const totalPrice = optimizedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const originalTotal = totalPrice + totalSavings;
  const totalDelivery = Object.values(deliveryInfo).reduce((sum, i) => sum + i.fee, 0);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 px-4 py-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Optimized Shopping Cart
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
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
                    <MapPin className="h-5 w-5 text-blue-600" />
                    {store}
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Clock className="h-4 w-4" />
                    {deliveryInfo[store].time}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {items.map((item, index) => {
                    const globalIndex = optimizedItems.findIndex((i) => i === item);
                    return (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div>
                          <span className="font-medium">{item.quantity}x {item.item}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              Quality: <span className={getQualityColor(item.quality)}>{item.quality}</span>
                            </Badge>
                            {item.savings > 0 && (
                              <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                                <TrendingDown className="h-3 w-3" />
                                Save ${item.savings.toFixed(2)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="font-semibold text-blue-600 dark:text-blue-400">${(item.price * item.quantity).toFixed(2)}</div>
                          <div className="flex gap-1">
                            <button onClick={() => handleQuantityChange(globalIndex, -1)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded"><Minus className="h-3 w-3" /></button>
                            <button onClick={() => handleQuantityChange(globalIndex, 1)} className="px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded"><Plus className="h-3 w-3" /></button>
                            <button onClick={() => handleRemoveItem(globalIndex)} className="px-2 py-1 bg-red-500 text-white rounded"><Trash2 className="h-3 w-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee:</span>
                    <span>${deliveryInfo[store].fee.toFixed(2)}</span>
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
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Original Total:</span>
                  <span className="line-through text-gray-500 dark:text-gray-400">${originalTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600 font-semibold">
                  <span>You Save:</span>
                  <span>-${totalSavings.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fees:</span>
                  <span>${totalDelivery.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-blue-600 dark:text-blue-400">${(totalPrice + totalDelivery).toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-green-100 p-3 rounded-lg border border-green-200 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-semibold">Optimization Complete</span>
              </div>

              <Button
                onClick={() => alert("Proceeding to checkout")}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white py-4 font-semibold"
              >
                <Sparkles className="mr-2 h-5 w-5" /> Proceed to Checkout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OptimizedCart;
