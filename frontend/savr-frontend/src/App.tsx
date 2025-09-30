// src/App.tsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthedHeader from "@/components/AuthedHeader";
import { CartProvider } from "./contexts/CartContext";
import { ProductsProvider } from "./contexts/ProductsContext";

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import UserProfile from "@/pages/UserProfile";
import Addresses from "@/pages/Addresses";
import ShoppingList from "@/components/ShoppingList";
import OptimizedCart from "@/components/OptimizedCart";
import CheckoutFlow from "@/components/CheckoutFlow";
import VerifyOTP from "@/pages/VerifyOTP";
import NotFound from "@/pages/NotFound";
import ForgotPassword from "@/pages/ForgotPassword";

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const authed = Boolean(sessionStorage.getItem("authToken"));
  return authed ? children : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const [cart, setCart] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);

  // preload products (with images)
  React.useEffect(() => {
    const load = async () => {
      try {
        const apiBase = ((import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:8000").replace(/\/+$/, "");
        const res = await fetch(`${apiBase}/api/v1/products/with-images/`);
        if (!res.ok) return;
        const data = await res.json();
        Array.isArray(data) && setProducts(data);
      } catch (e) {
        console.error("Failed to load products", e);
      }
    };
    load();
  }, []);

  const handleNavigateToCart = () => {
    window.history.pushState({}, "", "/cart");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handleOrderComplete = () => setCart([]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <CartProvider>
        <ProductsProvider>
          <AuthedHeader cartCount={cart.length} onCartClick={handleNavigateToCart} />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Protected routes */}
            <Route path="/profile" element={<RequireAuth><UserProfile /></RequireAuth>} />
            <Route path="/addresses" element={<RequireAuth><Addresses /></RequireAuth>} />
            <Route
              path="/shopping-list"
              element={
                <RequireAuth>
                  <ShoppingList
                    products={products}
                    cart={cart}
                    setCart={setCart}
                    onNavigateToCart={handleNavigateToCart}
                  />
                </RequireAuth>
              }
            />
            <Route path="/cart" element={<RequireAuth><OptimizedCart cart={cart} setCart={setCart} /></RequireAuth>} />
            <Route
              path="/checkout"
              element={
                <RequireAuth>
                  <CheckoutFlow onOrderComplete={handleOrderComplete} cart={cart} setCart={setCart} />
                </RequireAuth>
              }
            />

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ProductsProvider>
      </CartProvider>
    </ThemeProvider>
  );
};

export default App;
