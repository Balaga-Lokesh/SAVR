// src/App.tsx
import React from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { ThemeProvider, useTheme } from "./components/ThemeProvider";
import AuthedHeader from "@/components/AuthedHeader";
import RequireAuth from "@/components/RequireAuth";

import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProductsProvider } from "@/contexts/ProductsContext";

import Index from "@/pages/Index";
import Login from "@/pages/Login";
import VerifyOTP from "@/pages/VerifyOTP";
import ForgotPassword from "@/pages/ForgotPassword";
import ShoppingList from "@/components/ShoppingList";
import OptimizedCart from "@/components/OptimizedCart";
import CheckoutFlow from "@/components/CheckoutFlow";
import UserProfile from "@/pages/UserProfile";
import Addresses from "@/pages/Addresses";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AgentDashboard from "@/pages/AgentDashboard";
import AgentLogin from "@/pages/AgentLogin";
import AgentRegister from "@/pages/AgentRegister";
import RoleSelect from "@/pages/RoleSelect";
import CookieDebug from "@/pages/CookieDebug";
import NotFound from "@/pages/NotFound";

/**
 * Use relative API paths in dev so Vite proxy can forward requests to backend.
 * In production your reverse proxy or environment should set absolute URLs.
 */
function apiUrl(path: string) {
  // keep trailing slashes consistent
  if (!path.startsWith("/")) path = `/${path}`;
  return `${path.replace(/\/+$/, "")}/`;
}

const App: React.FC = () => {
  // If the ThemeProvider is present higher up, we can read its value and
  // apply a runtime override for the dark palette here. This ensures the
  // exact palette (from colorhunt) is applied programmatically across the app.
  const themeContext = (() => {
    try {
      return useTheme();
    } catch {
      return undefined;
    }
  })();

  React.useEffect(() => {
    // exact HSL numeric tokens matching the dark palette requested
    // #35374B, #344955, #50727B, #78A083
    const darkPalette: Record<string, string> = {
      '--background': '234.5 17.2% 25.1%',   // #35374B
      '--card': '201.8 24.1% 26.9%',         // #344955
      '--primary': '192.5 21.2% 39.8%',      // #50727B
      '--secondary': '136.5 17.4% 54.9%',    // #78A083
    };

    const root = document.documentElement;

    const apply = () => {
      Object.entries(darkPalette).forEach(([k, v]) => root.style.setProperty(k, v));
    };

    const remove = () => {
      Object.keys(darkPalette).forEach((k) => root.style.removeProperty(k));
    };

    // If we have a ThemeProvider, react to its theme changes.
    if (themeContext) {
      if (themeContext.theme === 'dark') apply();
      else remove();

      // Clean up when unmounting
      return () => remove();
    }

    // Defensive: no ThemeProvider present. Apply once based on system preference.
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) apply();
    return () => remove();
  }, [themeContext]);

  const navigate = useNavigate(); // main.tsx wraps App with BrowserRouter
  const [products, setProducts] = React.useState<any[]>([]);
  const [cart, setCart] = React.useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("savr_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // load products once (relative path -> works with vite proxy)
  React.useEffect(() => {
    const load = async () => {
      try {
        const path = apiUrl("/api/v1/products/with-images/");
        // Use relative fetch so Vite dev proxy (vite.config.ts) can handle it.
        const res = await fetch(path, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            // Add other headers here if your backend expects them
          },
          // include credentials if your backend uses cookie-based sessions.
          // If using JWT in Authorization header, set that header instead.
          credentials: "include",
        });

        console.log("Product fetch url:", path, "status:", res.status, "ok:", res.ok);

        // Try to parse response body as JSON, but fallback to text for diagnostics
        let body: any = null;
        const text = await res.text();
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }

        if (!res.ok) {
          console.warn("Failed to load products:", {
            status: res.status,
            body,
            url: res.url,
          });
          return;
        }

        if (Array.isArray(body)) {
          setProducts(body);
        } else if (body && Array.isArray(body.results)) {
          // common pattern when results are paginated
          setProducts(body.results);
        } else {
          console.warn("Unexpected products payload shape:", body);
        }
      } catch (e) {
        console.error("Failed to load products (network or parse error):", e);
      }
    };

    load();
    // empty deps: run once on mount
  }, []);

  // keep cart persisted
  React.useEffect(() => {
    try {
      localStorage.setItem("savr_cart", JSON.stringify(cart));
    } catch {
      /* ignore localStorage errors */
    }
  }, [cart]);

  // DEV: log token values to help diagnose why token-driven colors may not be applied
  React.useEffect(() => {
    try {
      // Vite exposes import.meta.env.DEV; guard to avoid noise in production
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((import.meta as any).env && (import.meta as any).env.DEV) {
        const root = document.documentElement;
        const get = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();
        // print a compact debug of key tokens
        // eslint-disable-next-line no-console
        console.info("[theme-debug] theme=", themeContext ? themeContext.theme : "(no ThemeProvider)", {
          primary: get("--primary"),
          success: get("--success"),
          destructive: get("--destructive"),
          selected: get("--selected"),
        });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[theme-debug] failed to read tokens", e);
    }
  }, [themeContext]);

  // single navigate-to-cart handler
  const handleNavigateToCart = React.useCallback(() => {
    navigate("/cart");
  }, [navigate]);

  const handleOrderComplete = React.useCallback(() => {
    setCart([]);
  }, []);

  return (
    <AuthProvider>
      <CartProvider value={{ cart, setCart }}>
        <ProductsProvider>
          <AuthedHeader cartCount={cart.length} onCartClick={handleNavigateToCart} />

          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/who" element={<RoleSelect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* Admin / Agent */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/agent/login" element={<AgentLogin />} />
            <Route path="/agent/register" element={<AgentRegister />} />
            <Route path="/cookie-debug" element={<CookieDebug />} />
            <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
            <Route path="/agent" element={<RequireAuth><AgentDashboard /></RequireAuth>} />

            {/* Protected */}
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

            <Route
              path="/cart"
              element={<RequireAuth><OptimizedCart cart={cart} setCart={setCart} products={products} /></RequireAuth>}
            />

            <Route
              path="/checkout"
              element={<RequireAuth><CheckoutFlow /></RequireAuth>}
            />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ProductsProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
