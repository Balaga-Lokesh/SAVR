// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";
import NotFound from "./pages/NotFound";
import ShoppingList from "./components/ShoppingList";
import OptimizedCart from "./components/OptimizedCart";
import CheckoutFlow from "./components/CheckoutFlow";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "./components/ui/ThemeToggle";

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

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch products from backend
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/v1/products/with-images/");
        if (!res.ok) throw new Error("Failed to fetch products");
        const data = await res.json();
        setProducts(data);
      } catch {
        console.warn("Backend down, showing empty list");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Persist cart to local storage
  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <div className="min-h-screen text-foreground bg-background dark:bg-slate-900 dark:text-white transition-colors duration-300">
        <ThemeToggle />
        {loading ? (
          <p className="text-center mt-10">Loading products...</p>
        ) : (
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route
              path="/shopping-list"
              element={
                <ShoppingList
                  products={products}
                  cart={cart}
                  setCart={setCart}
                  onNavigateToCart={() => navigate("/cart")}
                />
              }
            />
            <Route path="/cart" element={<OptimizedCart cart={cart} setCart={setCart} />} />
            <Route
              path="/checkout"
              element={<CheckoutFlow onOrderComplete={() => setCart([])} />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        )}
      </div>
    </ThemeProvider>
  );
};

export default App;
