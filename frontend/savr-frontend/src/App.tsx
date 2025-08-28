// src/App.tsx
import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import ShoppingList from "@/components/ShoppingList";
import AuthedHeader from "@/components/AuthedHeader";
import Addresses from "@/pages/Addresses";
import Profile from "@/pages/Profile"; // or "@/pages/UserProfile"
import { ThemeProvider } from "@/components/ThemeProvider";

type CartItem = { product_id: number; quantity: number };
type Product = {
  product_id: number;
  name: string;
  category: string;
  price: number;
  quality_score: number;
  mart_name: string;
  image_url?: string;
};

const App: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // fetch products
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingProducts(true);
        const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
        const res = await fetch(`${base}/api/v1/products/with-images/`);
        const json = await res.json();
        const list: Product[] = Array.isArray(json)
          ? json
          : Array.isArray(json?.results)
          ? json.results
          : [];
        if (alive) setProducts(list);
      } catch (e) {
        console.error("Failed to fetch products", e);
        if (alive) setProducts([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const navigate = useNavigate();
  const onNavigateToCart = useCallback(() => navigate("/cart"), [navigate]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <AuthedHeader
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
        onCartClick={onNavigateToCart}
      />

      <Routes>
        <Route
          path="/shopping-list"
          element={
            <ShoppingList
              products={products}
              cart={cart}
              setCart={setCart}
              onNavigateToCart={onNavigateToCart}
            />
          }
        />
        <Route path="/addresses" element={<Addresses />} />
        <Route path="/profile" element={<Profile />} />
        {/* temporary placeholder for cart until we build it */}
        <Route
          path="/cart"
          element={
            <div className="max-w-3xl mx-auto p-6">
              <h1 className="text-2xl font-bold mb-3">Cart (coming soon)</h1>
              {cart.length === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((c) => (
                    <li
                      key={c.product_id}
                      className="flex justify-between border p-2 rounded"
                    >
                      <span>Product #{c.product_id}</span>
                      <span>Qty: {c.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          }
        />
        {/* fallback */}
        <Route
          path="*"
          element={
            <div className="p-8 text-center">
              <h1 className="text-3xl font-bold mb-2">Welcome to Savr</h1>
              <p className="mb-6">Compare, choose, and save.</p>
              <button
                onClick={() => navigate("/shopping-list")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg"
              >
                Browse Products
              </button>
            </div>
          }
        />
      </Routes>

      {loadingProducts && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-3 py-1.5 text-sm bg-gray-900 text-white/90 shadow">
          Loading products…
        </div>
      )}
    </ThemeProvider>
  );
};

export default App;
