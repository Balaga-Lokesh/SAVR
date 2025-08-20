import React from "react";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import VerifyOTP from "./pages/VerifyOTP";
import ShoppingList from "./components/ShoppingList";
import OptimizedCart from "./components/OptimizedCart";
import CheckoutFlow from "./components/CheckoutFlow";
import NotFound from "./pages/NotFound";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "./components/ui/ThemeToggle";

const App = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="savr-theme">
      <div className="min-h-screen text-foreground bg-background dark:bg-slate-900 dark:text-white transition-colors duration-300">
        <ThemeToggle />
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="/shopping-list" element={<ShoppingList onOptimize={() => {}} />} />
          <Route path="/cart" element={<OptimizedCart items={[]} onProceedToCheckout={() => {}} />} />
          <Route path="/checkout" element={<CheckoutFlow onOrderComplete={function (): void {
            throw new Error("Function not implemented.");
          } } />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
};

export default App;