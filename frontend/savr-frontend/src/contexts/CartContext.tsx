// src/contexts/CartContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

export type CartItem = {
  product_id: number;
  quantity: number;
};

type CartContextType = {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

/**
 * CartProvider persists cart in localStorage so cart items survive
 * auth refresh / page reloads and prevent "lost cart" when RequireAuth briefly loads.
 */
export const CartProvider: React.FC<{ children: React.ReactNode; value?: CartContextType }> = ({ children, value }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem("savr_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("savr_cart", JSON.stringify(cart));
    } catch (e) {
      // ignore
    }
  }, [cart]);

  const providerValue = value ?? { cart, setCart };

  return <CartContext.Provider value={providerValue}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
};
