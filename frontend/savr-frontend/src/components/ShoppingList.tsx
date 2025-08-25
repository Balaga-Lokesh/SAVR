// src/components/ShoppingList.tsx
import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Search } from "lucide-react";

// --- Interfaces ---
interface Product {
  product_id: number;
  name: string;
  category: string;
  price: number;
  quality_score: number;
  mart_name: string;
  image_url?: string;
}

interface CartItem {
  product_id: number;
  quantity: number;
}

// --- Product Image Component ---
const ProductImage: React.FC<{ src?: string; alt: string; id: number }> = ({ src, alt, id }) => {
  const [error, setError] = useState(false);

  // Smaller image dimensions for faster loading + better fit
  const placeholderWidth = 160;
  const placeholderHeight = 120;

  const finalSrc =
    !src || error || src.includes("placehold")
      ? `https://picsum.photos/seed/${id}/${placeholderWidth}/${placeholderHeight}?random=${id}`
      : src.startsWith("http")
      ? src
      : `${import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}${src}`;

  return (
    <div className="w-full h-28 sm:h-32 md:h-36 lg:h-40 bg-gray-100 dark:bg-gray-700 rounded-md overflow-hidden">
      <img
        src={finalSrc}
        alt={alt}
        className="w-full h-full object-contain p-2 transition-transform hover:scale-105"
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  );
};

// --- ShoppingList Component ---
const ShoppingList: React.FC<{
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onNavigateToCart: () => void;
}> = ({ products, cart, setCart, onNavigateToCart }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    const initial: Record<number, number> = {};
    products.forEach((p) => (initial[p.product_id] = 1));
    setQuantities(initial);
  }, [products]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      grocery: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      dairy: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      clothing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      essential: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[category] || colors.other;
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (categoryFilter === "all" || p.category === categoryFilter)
  );

  const changeQuantity = (id: number, delta: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const addToCart = (id: number) => {
    const qty = quantities[id] || 1;
    setCart((prev) => {
      const exist = prev.find((i) => i.product_id === id);
      if (exist) return prev.map((i) => (i.product_id === id ? { ...i, quantity: i.quantity + qty } : i));
      return [...prev, { product_id: id, quantity: qty }];
    });
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <ShoppingCart className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Available Products</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 py-2 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 dark:text-white"
        >
          <option value="all">All Categories</option>
          <option value="grocery">Grocery</option>
          <option value="dairy">Dairy</option>
          <option value="clothing">Clothing</option>
          <option value="essential">Essential</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center text-gray-600 py-8">No products found</div>
        )}
        {filteredProducts.map((p) => (
          <Card key={p.product_id} className="p-3 lg:p-4 bg-white dark:bg-gray-800 border shadow-sm rounded-lg hover:shadow-md transition-shadow">
            <ProductImage src={p.image_url} alt={p.name} id={p.product_id} />
            <div className="mt-3 space-y-2">
              <h3 className="font-semibold text-sm lg:text-lg text-gray-900 dark:text-white line-clamp-2">{p.name}</h3>
              <p className="text-xs lg:text-sm text-gray-600 dark:text-gray-400 truncate">{p.mart_name}</p>
              <div className="flex items-center justify-between">
                <span className="text-base lg:text-lg font-bold text-blue-600">₹{p.price}</span>
                <span className="text-xs lg:text-sm text-gray-600">⭐ {p.quality_score}</span>
              </div>
              <Badge className={`${getCategoryColor(p.category)} text-xs`}>{p.category}</Badge>
              <div className="flex items-center justify-between mt-3 gap-2">
                <div className="flex items-center gap-1 lg:gap-2">
                  <button
                    onClick={() => changeQuantity(p.product_id, -1)}
                    className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <span className="text-sm lg:text-base min-w-[1.5rem] text-center">{quantities[p.product_id] || 1}</span>
                  <button
                    onClick={() => changeQuantity(p.product_id, 1)}
                    className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => addToCart(p.product_id)}
                  className="px-2 lg:px-3 py-1 bg-blue-600 text-white rounded-lg text-xs lg:text-sm hover:bg-blue-700 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && (
        <button
          onClick={onNavigateToCart}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-blue-600 text-white px-4 lg:px-5 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="text-sm lg:text-base">{totalItems} item{totalItems > 1 ? "s" : ""}</span>
        </button>
      )}
    </>
  );
};

export default ShoppingList;