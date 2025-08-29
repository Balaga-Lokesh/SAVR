import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import AuthedHeader from "@/components/AuthedHeader";

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import UserProfile from "./pages/UserProfile";
import Addresses from "@/pages/Addresses";
import ShoppingList from "@/components/ShoppingList";
import OptimizedCart from "@/components/OptimizedCart";
import CheckoutFlow from "@/components/CheckoutFlow";
import VerifyOTP from "@/pages/VerifyOTP";
import NotFound from "@/pages/NotFound";

const App: React.FC = () => {
  // Minimal local state to satisfy component prop requirements
  const [cart, setCart] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);

  // load products once (uses products/with-images to ensure image_url is present)
  React.useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/v1/products/with-images/');
        if (!res.ok) return;
        const data = await res.json();
        setProducts(data);
      } catch (e) {
        console.error('Failed to load products', e);
      }
    };
    load();
  }, []);

  const handleNavigateToCart = () => {
    // simple client-side navigation to /cart
    window.history.pushState({}, '', '/cart');
    // optional: dispatch a popstate so router notices
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleOrderComplete = () => {
    setCart([]);
  };

  return (
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <AuthedHeader cartCount={cart.length} onCartClick={handleNavigateToCart} />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
  <Route path="/profile" element={<UserProfile />} />
        <Route path="/addresses" element={<Addresses />} />
    <Route path="/shopping-list" element={<ShoppingList products={products} cart={cart} setCart={setCart} onNavigateToCart={handleNavigateToCart} />} />
    <Route path="/cart" element={<OptimizedCart cart={cart} setCart={setCart} />} />
  <Route path="/checkout" element={<CheckoutFlow onOrderComplete={handleOrderComplete} cart={cart} setCart={setCart} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ThemeProvider>
  );
};

export default App;