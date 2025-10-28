// src/components/AuthedHeader.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingCart, MapPin, UserCircle2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useLocation } from "react-router-dom";

type Props = {
  cartCount: number;
  onCartClick: () => void;
};

const AuthedHeader: React.FC<Props> = ({ cartCount, onCartClick }) => {
  const navigate = useNavigate();

  const { user, loading, refresh, logout: ctxLogout } = useAuth();

  const requireLogin = async (next: () => void) => {
    if (loading) return; // still loading user state
    if (!user) {
      // try a refresh (maybe cookie was just set)
      try {
        await refresh();
      } catch (e) {
        // ignore
      }
    }
    if (!user) {
      alert("Please login first");
      navigate("/login");
      return;
    }
    next();
  };

  const location = useLocation();

  const goHome = async () => await requireLogin(() => navigate("/shopping-list"));
  const goAddresses = async () => await requireLogin(() => navigate("/addresses"));
  const goCart = async () => await requireLogin(() => onCartClick());
  const goProfile = async () => await requireLogin(() => navigate("/profile"));

  const isActive = (path: string) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const logout = async () => {
    try {
      await ctxLogout();
    } catch (e) {
      // fall back to clearing local storage
      sessionStorage.removeItem("mfaVerified");
      sessionStorage.removeItem("otp_dest");
    }
    navigate("/login");
  };

  return (
  <header className="sticky top-0 z-40 w-full border-b bg-card/60 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Brand */}
      <button
        onClick={goHome}
        className="group inline-flex items-center gap-2 rounded-xl px-3 py-2 ring-1 ring-transparent hover:ring-border transition"
        title="Go to products"
      >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary/90 to-primary text-primary-foreground shadow-sm">
              <ShoppingCart className="h-4 w-4" />
            </span>
            <span className="font-semibold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 group-hover:opacity-90">
              SAVR
            </span>
          </button>

          {/* Actions */}
          <nav className="flex items-center gap-2">
            <button
              onClick={goAddresses}
              className={`px-3 py-2 rounded-xl border bg-card/60 transition inline-flex items-center gap-2 ${isActive('/addresses') ? 'bg-selected/60 ring-1 ring-selected' : 'hover:bg-special/60'}`}
              title="Manage Addresses"
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Addresses</span>
            </button>

            <button
              onClick={goCart}
              className={`px-3 py-2 rounded-xl border bg-card/60 transition relative inline-flex items-center gap-2 ${isActive('/cart') ? 'bg-selected/60 ring-1 ring-selected' : 'hover:bg-special/60'}`}
              title="Cart"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground shadow">
                  {cartCount}
                </span>
              )}
            </button>

            <ThemeToggle />

            <button
              onClick={goProfile}
              className={`px-3 py-2 rounded-xl border bg-card/60 transition inline-flex items-center gap-2 ${isActive('/profile') ? 'bg-selected/60 ring-1 ring-selected' : 'hover:bg-special/60'}`}
              title="Profile"
            >
              <UserCircle2 className="h-5 w-5" />
              <span className="hidden sm:inline">Profile</span>
            </button>

            <button
              onClick={logout}
              className={`px-3 py-2 rounded-xl border bg-card/60 transition inline-flex items-center gap-2 ${isActive('/login') ? 'bg-selected/60 ring-1 ring-selected' : 'hover:bg-special/60'}`}
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default AuthedHeader;
