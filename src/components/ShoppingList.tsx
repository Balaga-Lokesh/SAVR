import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, X, ShoppingCart, Sparkles } from "lucide-react";
import axios from "axios";

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
}

const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [quantity, setQuantity] = useState(1);

  const categories = [
    "Groceries",
    "Dairy",
    "Meat",
    "Vegetables",
    "Fruits",
    "Beverages",
    "Household",
  ];

  const addItem = () => {
    if (newItem.trim()) {
      const item: ShoppingItem = {
        id: Date.now().toString(),
        name: newItem,
        quantity,
        category: categories[Math.floor(Math.random() * categories.length)],
      };
      setItems([...items, item]);
      setNewItem("");
      setQuantity(1);
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleOptimize = async () => {
    if (items.length > 0) {
      try {
        const response = await axios.post("http://127.0.0.1:8000/api/v1/optimize_basket/", {
          items,
        });
        console.log("Optimized Result:", response.data);
        alert("Cart optimized! Check console for details 🚀");
      } catch (error: any) {
        console.error("Optimization failed:", error.response?.data || error.message);
        alert("Optimization failed. Try again.");
      }
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      Groceries: "bg-fresh text-white",
      Dairy: "bg-blue-100 text-blue-800",
      Meat: "bg-red-100 text-red-800",
      Vegetables: "bg-green-100 text-green-800",
      Fruits: "bg-yellow-100 text-yellow-800",
      Beverages: "bg-purple-100 text-purple-800",
      Household: "bg-gray-100 text-gray-800",
    };
    return (
      colors[category as keyof typeof colors] ||
      "bg-gray-100 text-gray-800"
    );
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-card">
      <CardHeader className="bg-gradient-hero text-white rounded-t-lg">
        <CardTitle className="flex items-center gap-3 text-2xl">
          <ShoppingCart className="h-8 w-8" />
          Smart Shopping List
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {/* Add item input */}
        <div className="flex gap-3 mb-6">
          <Input
            placeholder="Add item to your list..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && addItem()}
            className="flex-1"
          />
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="w-20"
          />
          <Button
            onClick={addItem}
            variant="default"
            className="bg-fresh hover:bg-fresh/90 shadow-button"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Show items */}
        {items.length > 0 && (
          <div className="space-y-3 mb-6">
            <h3 className="font-semibold text-foreground">
              Your Items ({items.length})
            </h3>
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-gradient-card rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {item.quantity}x {item.name}
                  </span>
                  <Badge className={getCategoryColor(item.category)}>
                    {item.category}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Optimize Button */}
        {items.length > 0 && (
          <Button
            onClick={handleOptimize}
            className="w-full bg-gradient-primary hover:opacity-90 shadow-button text-lg py-6"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Find Best Deals & Optimize Cart
          </Button>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Start adding items to your shopping list</p>
            <p className="text-sm">
              We'll help you find the best deals across multiple stores!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShoppingList;
