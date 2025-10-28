// src/components/ShoppingList.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Search, SlidersHorizontal, Star, Store } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
  count: number;
};

// ---------- helpers ----------
const INR = (n: number) => `₹${(n ?? 0).toFixed(2)}`;

  const categoryClass = (category: string) => {
  const m: Record<string, string> = {
    grocery: "bg-success/10 text-success dark:bg-success/20 dark:text-success-foreground",
    dairy: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground",
    clothing: "bg-premium/10 text-premium dark:bg-premium/20 dark:text-premium-foreground",
    essential: "bg-savings/10 text-savings dark:bg-savings/20 dark:text-savings-foreground",
    other: "bg-muted/5 text-muted-foreground dark:bg-card/5 dark:text-muted-foreground",
  };
  return m[category] || m.other;
};

// deterministic hue from string
const hueFromString = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
};

// ---------- product image ----------
const ProductImage: React.FC<{ src?: string; alt: string; seed: string | number }> = ({
  src,
  alt,
  seed,
}) => {
  const [error, setError] = useState(false);
  const w = 320,
    h = 240;

  const rawApiBase = (import.meta as any).env?.VITE_API_BASE || "";
  const base = rawApiBase ? rawApiBase : "";
  const finalSrc =
    !src || error || src.includes("placehold")
      ? `https://picsum.photos/seed/${encodeURIComponent(String(seed))}/${w}/${h}`
      : src.startsWith("http")
      ? src
      : `${base}${src}`;

  return (
    <div className="w-full aspect-[4/3] bg-card rounded-lg overflow-hidden">
      <img
        src={finalSrc}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
};

// ---------- component ----------
const ShoppingList: React.FC<{
  products?: Product[];
  cart?: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onNavigateToCart: () => void;
}> = ({ products, cart, setCart, onNavigateToCart }) => {
  const navigate = useNavigate(); // <- hook is inside component (fixed)
  const source = Array.isArray(products) ? products : [];

  // UI state
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"relevance" | "price_asc" | "price_desc" | "quality_desc">(
    "relevance"
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // group by normalized name
  const groups = useMemo<GroupedProduct[]>(() => {
    const byName = new Map<string, Product[]>();
    (source ?? []).forEach((p) => {
      if (!p?.name) return;
      const key = p.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(p);
    });

    const out: GroupedProduct[] = [];
    byName.forEach((items, key) => {
      if (!items.length) return;
      const name = items[0].name;
      const prices = items.map((i) => Number(i.price) || 0);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const maxPrice = prices.length ? Math.max(...prices) : 0;
      const avgQuality =
        items.reduce((s, i) => s + (Number(i.quality_score) || 0), 0) / (items.length || 1);
      const martNames = Array.from(new Set(items.map((i) => i.mart_name).filter(Boolean))).sort();
      const repImage = items.find((i) => !!i.image_url)?.image_url;
      const cheapest =
        items.reduce((best, cur) => ((cur.price || 0) < (best.price || 0) ? cur : best), items[0]) ||
        items[0];
      const categories = new Set(items.map((i) => i.category || "other"));
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
        count: items.length,
      });
    });

    return out;
  }, [source]);

  // initialize qty per group
  useEffect(() => {
    const q: Record<string, number> = {};
    (groups ?? []).forEach((g) => (q[g.key] = q[g.key] ?? 1));
    setQuantities((prev) => ({ ...q, ...prev }));
  }, [groups.length]);

  // filtering + sorting
  const visible = useMemo(() => {
    let arr = (groups ?? []).filter((g) => {
      const matchesName = g.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = category === "all" ? true : g.categories.has(category);
      return matchesName && matchesCategory;
    });

    switch (sortBy) {
      case "price_asc":
        arr = arr.sort((a, b) => a.minPrice - b.minPrice);
        break;
      case "price_desc":
        arr = arr.sort((a, b) => b.minPrice - a.minPrice);
        break;
      case "quality_desc":
        arr = arr.sort((a, b) => b.avgQuality - a.avgQuality);
        break;
      default:
        arr = arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [groups, search, category, sortBy]);

  const changeQty = (k: string, d: number) =>
    setQuantities((prev) => ({ ...prev, [k]: Math.max(1, (prev[k] || 1) + d) }));

  const addToCart = (g: GroupedProduct) => {
    const qty = quantities[g.key] || 1;
    const id = g.cheapestProductId;
    setCart((prev) => {
      const exist = prev.find((i) => i.product_id === id);
      if (exist) return prev.map((i) => (i.product_id === id ? { ...i, quantity: i.quantity + qty } : i));
      return [...prev, { product_id: id, quantity: qty }];
    });
  };

  const totalItems = (cart ?? []).reduce((s, i) => s + (i?.quantity || 0), 0);

  const handleFloatingCartClick = () => {
    // prefer passed-in navigation handler to avoid racing issues; fallback to router navigate
    if (typeof onNavigateToCart === "function") {
      onNavigateToCart();
      return;
    }
    navigate("/cart");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Heading */}
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Discover Products</h1>
        <p className="text-muted-foreground">
          Compare variants across marts. {visible.length} match{visible.length !== 1 ? "es" : ""}.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-6 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <div className="lg:col-span-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search products, e.g. milk, bread, rice..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 py-2 rounded-lg border border-border bg-muted dark:bg-card dark:text-foreground"
          />
        </div>

        <div className="lg:col-span-4">
          <div className="flex flex-wrap gap-2">
            {["all", "grocery", "dairy", "clothing", "essential", "other"].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-full border text-sm transition ${
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:border-border"
                }`}
              >
                {c[0].toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 justify-self-end">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
        className="px-3 py-2 rounded-lg border border-border bg-card dark:bg-card text-foreground"
            >
              <option value="relevance">Sort: A → Z</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="quality_desc">Quality: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {visible.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-10">
            No products found. Try a different search or category.
          </div>
        )}

        {visible.map((g) => {
          const hue = hueFromString(g.key);
          const strip = `bg-[conic-gradient(from_90deg_at_50%_50%,hsl(${hue}_92%_92%),hsl(${(hue + 40) % 360}_90%_96%),white)]`;
          return (
            <Card
              key={g.key}
              className="group p-3 lg:p-4 bg-card border border-border shadow-sm rounded-2xl hover:shadow-md transition"
            >
              {/* Accent strip */}
              <div className={`h-2 rounded-full mb-3 ${strip}`} />

              <ProductImage src={g.repImage} alt={g.name} seed={g.key} />

              <div className="mt-3 space-y-2">
                <h3 className="font-semibold text-base lg:text-lg text-foreground line-clamp-2">
                  {g.name}
                </h3>

                {/* Price + Quality */}
                <div className="flex items-center justify-between">
                  <span className="text-base lg:text-lg font-bold text-primary">
                    {g.minPrice === g.maxPrice ? INR(g.minPrice) : `${INR(g.minPrice)} – ${INR(g.maxPrice)}`}
                  </span>
                  <div className="flex items-center gap-1 text-xs lg:text-sm text-muted-foreground">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-4 w-4 ${n <= Math.round(g.avgQuality) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      ))}
                    <span className="ml-1">{g.avgQuality.toFixed(1)}</span>
                  </div>
                </div>

                {/* Categories */}
                <div className="flex flex-wrap gap-1">
                  {Array.from(g.categories).map((cat) => (
                    <Badge key={cat} className={`${categoryClass(cat)} text-xs`}>{cat}</Badge>
                  ))}
                  <Badge className="bg-card/5 text-muted-foreground text-xs">
                    {g.count} variant{g.count > 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Marts */}
                <div className="text-xs lg:text-sm text-muted-foreground flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {g.martNames.slice(0, 3).join(", ")}
                    {g.martNames.length > 3 && ` +${g.martNames.length - 3} more`}
                  </span>
                </div>

                {/* Qty + Add */}
                <div className="flex items-center justify-between mt-3 gap-2">
                  <div className="flex items-center gap-1 lg:gap-2">
                    <button
                      onClick={() => changeQty(g.key, -1)}
                      className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center bg-destructive text-destructive-foreground rounded-full text-sm hover:bg-destructive/90"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="text-sm lg:text-base min-w-[1.5rem] text-center">
                      {quantities[g.key] || 1}
                    </span>
                    <button
                      onClick={() => changeQty(g.key, 1)}
                      className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center bg-success text-success-foreground rounded-full text-sm hover:bg-success/90"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => addToCart(g)}
                    className="px-3 lg:px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs lg:text-sm hover:bg-special/90 transition-colors"
                    title="Adds the cheapest variant to cart"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Floating Cart */}
      {totalItems > 0 && (
        <button
          onClick={handleFloatingCartClick}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-primary text-primary-foreground px-4 lg:px-5 py-3 rounded-full shadow-lg hover:bg-special/90 transition-colors z-10"
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
