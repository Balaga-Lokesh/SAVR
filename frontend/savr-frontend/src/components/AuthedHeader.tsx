// src/components/AuthedHeader.tsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShoppingCart, MapPin, UserCircle2, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

type Props = {
  cartCount: number;
  onCartClick: () => void;
};

const AuthedHeader: React.FC<Props> = ({ cartCount, onCartClick }) => {
  const navigate = useNavigate();

  const logout = () => {
    sessionStorage.removeItem("authToken");
    sessionStorage.removeItem("mfaVerified");
    sessionStorage.removeItem("temp_token");
    sessionStorage.removeItem("otp_dest");
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
        {/* Brand */}
        <Link to="/shopping-list" className="flex items-center gap-2">
          <ShoppingCart className="h-6 w-6" />
          <span className="font-semibold text-lg">SAVR</span>
        </Link>

        {/* Actions */}
        <nav className="flex items-center gap-2">
          <button
            onClick={() => navigate("/addresses")}
            className="px-3 py-2 rounded-md border hover:bg-accent flex items-center gap-2"
            title="Manage Addresses"
          >
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Addresses</span>
          </button>

          <button
            onClick={onCartClick}
            className="px-3 py-2 rounded-md border hover:bg-accent relative"
            title="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 text-[10px] leading-none px-1.5 py-0.5 rounded-full bg-primary text-white">
                {cartCount}
              </span>
            )}
          </button>

          <ThemeToggle />

          {/* Profile -> /profile */}
          <button
            onClick={() => navigate("/profile")}
            className="px-3 py-2 rounded-md border hover:bg-accent"
            title="Profile"
          >
            <UserCircle2 className="h-5 w-5" />
          </button>

          <button
            onClick={logout}
            className="px-3 py-2 rounded-md border hover:bg-accent"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </nav>
      </div>
    </header>
  );
};

export default AuthedHeader;
