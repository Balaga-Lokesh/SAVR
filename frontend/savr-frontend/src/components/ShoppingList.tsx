// src/components/ShoppingList.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search } from "lucide-react";

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

type GroupedProduct = {
  key: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  avgQuality: number;
  martNames: string[];
  repImage?: string;
  cheapestProductId: number;
  categories: Set<string>;
};

const ProductImage: React.FC<{ src?: string; alt: string; seed: string | number }> = ({
  src,
  alt,
  seed,
}) => {
  const [error, setError] = useState(false);
  const w = 160,
    h = 120;

  const finalSrc =
    !src || error || src.includes("placehold")
      ? `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/${w}/${h}`
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

// helper for category colors
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

const ShoppingList: React.FC<{
  products: Product[];
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onNavigateToCart: () => void;
}> = ({ products, cart, setCart, onNavigateToCart }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // group products by normalized name
  const groups = useMemo<GroupedProduct[]>(() => {
    const byName = new Map<string, Product[]>();
    products.forEach((p) => {
      const key = p.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(p);
    });

    const out: GroupedProduct[] = [];
    byName.forEach((items, key) => {
      const name = items[0].name;
      const prices = items.map((i) => i.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgQuality =
        items.reduce((sum, i) => sum + (Number(i.quality_score) || 0), 0) / (items.length || 1);

      const martNames = Array.from(new Set(items.map((i) => i.mart_name))).sort();
      const repImage = items.find((i) => i.image_url)?.image_url;
      const cheapest = items.reduce((best, cur) => (cur.price < best.price ? cur : best), items[0]);
      const categories = new Set(items.map((i) => i.category));

      out.push({
        key,
        name,
        minPrice,
        maxPrice,
        avgQuality: Number(avgQuality.toFixed(1)),
        martNames,
        repImage,
        cheapestProductId: cheapest.product_id,
        categories,
      });
    });

    out.sort((a, b) => a.name.localeCompare(b.name));
    return out;
  }, [products]);

  // initialize quantities
  useEffect(() => {
    const q: Record<string, number> = {};
    groups.forEach((g) => (q[g.key] = q[g.key] ?? 1));
    setQuantities((prev) => ({ ...q, ...prev }));
  }, [groups]);

  // filtering
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesName = g.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        categoryFilter === "all" ? true : g.categories.has(categoryFilter);
      return matchesName && matchesCategory;
    });
  }, [groups, searchTerm, categoryFilter]);

  const changeQuantity = (groupKey: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [groupKey]: Math.max(1, (prev[groupKey] || 1) + delta),
    }));
  };

  const addToCart = (group: GroupedProduct) => {
    const qty = quantities[group.key] || 1;
    const id = group.cheapestProductId;
    setCart((prev) => {
      const exist = prev.find((i) => i.product_id === id);
      if (exist) {
        return prev.map((i) =>
          i.product_id === id ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product_id: id, quantity: qty }];
    });
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Products</h1>
        <p className="text-muted-foreground">Grouped by product name across marts</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="relative flex-1 w-full">
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

      {/* Grouped Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
        {filteredGroups.length === 0 && (
          <div className="col-span-full text-center text-gray-600 dark:text-gray-300 py-8">
            No products found
          </div>
        )}

        {filteredGroups.map((g) => (
          <Card
            key={g.key}
            className="p-3 lg:p-4 bg-white dark:bg-gray-800 border shadow-sm rounded-lg hover:shadow-md transition-shadow"
          >
            <ProductImage src={g.repImage} alt={g.name} seed={g.key} />

            <div className="mt-3 space-y-2">
              <h3 className="font-semibold text-sm lg:text-lg text-gray-900 dark:text-white line-clamp-2">
                {g.name}
              </h3>

              {/* Price + Quality */}
              <div className="flex items-center justify-between">
                <span className="text-base lg:text-lg font-bold text-blue-600">
                  {g.minPrice === g.maxPrice
                    ? `₹${g.minPrice.toFixed(2)}`
                    : `₹${g.minPrice.toFixed(2)} – ₹${g.maxPrice.toFixed(2)}`}
                </span>
                <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">
                  ⭐ {g.avgQuality.toFixed(1)}
                </span>
              </div>

              {/* Categories as badges */}
              <div className="flex flex-wrap gap-1">
                {Array.from(g.categories).map((cat) => (
                  <Badge key={cat} className={`${getCategoryColor(cat)} text-xs`}>
                    {cat}
                  </Badge>
                ))}
              </div>

              {/* Available marts */}
              <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-300">
                {g.martNames.slice(0, 3).join(", ")}
                {g.martNames.length > 3 && ` +${g.martNames.length - 3} more`}
              </div>

              {/* Qty + Add */}
              <div className="flex items-center justify-between mt-3 gap-2">
                <div className="flex items-center gap-1 lg:gap-2">
                  <button
                    onClick={() => changeQuantity(g.key, -1)}
                    className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <span className="text-sm lg:text-base min-w-[1.5rem] text-center">
                    {quantities[g.key] || 1}
                  </span>
                  <button
                    onClick={() => changeQuantity(g.key, 1)}
                    className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-full text-sm hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={() => addToCart(g)}
                  className="px-2 lg:px-3 py-1 bg-blue-600 text-white rounded-lg text-xs lg:text-sm hover:bg-blue-700 transition-colors"
                  title="Adds the cheapest variant to cart"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Floating Cart */}
      {totalItems > 0 && (
        <button
          onClick={onNavigateToCart}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-blue-600 text-white px-4 lg:px-5 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="text-sm lg:text-base">
            {totalItems} item{totalItems > 1 ? "s" : ""}
          </span>
        </button>
      )}
    </div>
  );
};

export default ShoppingList;
