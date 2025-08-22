import React, { useEffect, useState } from "react";
// Removed useNavigate as we will handle navigation with state
// import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Search, Package, ArrowLeft } from "lucide-react";

// Interfaces for our data structures
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

// Mock data as fallback with placeholder images from a reliable service
const mockProducts: Product[] = [
  { product_id: 1, name: "Organic Apples (1kg)", category: "grocery", price: 150, quality_score: 4.5, mart_name: "Fresh Mart", image_url: "https://placehold.co/600x400/a8e6cf/333?text=Apples" },
  { product_id: 2, name: "Whole Milk (1L)", category: "dairy", price: 60, quality_score: 4.2, mart_name: "Dairy Plus", image_url: "https://placehold.co/600x400/dcedc1/333?text=Milk" },
  { product_id: 3, name: "Cotton T-Shirt", category: "clothing", price: 500, quality_score: 4.0, mart_name: "Fashion Hub", image_url: "https://placehold.co/600x400/ffd3b6/333?text=T-Shirt" },
  { product_id: 4, name: "Hand Sanitizer (250ml)", category: "essential", price: 80, quality_score: 4.8, mart_name: "Health Store", image_url: "https://placehold.co/600x400/ffaaa5/333?text=Sanitizer" },
  { product_id: 5, name: "Basmati Rice (5kg)", category: "grocery", price: 200, quality_score: 4.3, mart_name: "Grain Market", image_url: "https://placehold.co/600x400/a8e6cf/333?text=Rice" },
  { product_id: 6, name: "Greek Yogurt (500g)", category: "dairy", price: 120, quality_score: 4.6, mart_name: "Dairy Plus", image_url: "https://placehold.co/600x400/dcedc1/333?text=Yogurt" },
];

// Reusable ProductImage component
const ProductImage = ({ src, alt, className }: { src?: string; alt: string; className: string }) => {
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    
    if (!src || imageError) {
      return (
        <div className={`${className} flex items-center justify-center bg-gray-200 dark:bg-gray-600`}>
          <Package className="h-8 w-8 text-gray-400" />
        </div>
      );
    }

    return (
      <div className={className}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 dark:bg-gray-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
          </div>
        )}
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setImageError(true);
            setIsLoading(false);
          }}
          style={{ display: isLoading ? 'none' : 'block' }}
        />
      </div>
    );
};


// ShoppingList component to display products
const ShoppingList: React.FC<{ onNavigateToCart: () => void, cart: CartItem[], setCart: React.Dispatch<React.SetStateAction<CartItem[]>>, products: Product[] }> = ({ onNavigateToCart, cart, setCart, products }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Initialize quantities when products load
  useEffect(() => {
    const initialQuantities: Record<number, number> = {};
    products.forEach((p: Product) => (initialQuantities[p.product_id] = 1));
    setQuantities(initialQuantities);
  }, [products]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      grocery: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      dairy: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      clothing: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      essential: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    };
    return colors[category] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200";
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleQuantityChange = (productId: number, delta: number) => {
    setQuantities(prev => {
      const newQuantity = Math.max(1, (prev[productId] || 1) + delta);
      return { ...prev, [productId]: newQuantity };
    });
  };

  const handleAddToCart = (productId: number) => {
    const quantity = quantities[productId] || 1;
    setCart(prev => {
      const existing = prev.find(item => item.product_id === productId);
      if (existing) {
        return prev.map(item =>
          item.product_id === productId ? { ...item, quantity: item.quantity + quantity } : item
        );
      } else {
        return [...prev, { product_id: productId, quantity }];
      }
    });
  };

  const totalCartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      {/* Heading */}
      <div className="flex items-center gap-3 mb-8">
        <ShoppingCart className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Available Products</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500" />
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="grocery">Grocery</option>
          <option value="dairy">Dairy</option>
          <option value="clothing">Clothing</option>
          <option value="essential">Essential</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredProducts.length > 0 ? (
          filteredProducts.map(product => (
            <Card key={product.product_id} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="relative w-full h-48 mb-4 rounded-lg overflow-hidden">
                <ProductImage
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full relative"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-white line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{product.mart_name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{product.price}</span>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <span>⭐</span>
                      <span>{product.quality_score}</span>
                    </div>
                  </div>
                  <Badge className={`${getCategoryColor(product.category)} mt-2`}>{product.category}</Badge>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleQuantityChange(product.product_id, -1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-sm font-medium transition-colors">-</button>
                    <span className="w-8 text-center font-medium dark:text-white">{quantities[product.product_id] || 1}</span>
                    <button onClick={() => handleQuantityChange(product.product_id, 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-sm font-medium transition-colors">+</button>
                  </div>
                  <button onClick={() => handleAddToCart(product.product_id)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Add to Cart</button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12 text-gray-600 dark:text-gray-400 col-span-full">
            <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No matching products found.</p>
            <p className="text-sm mt-2">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {totalCartQuantity > 0 && (
        <button
          onClick={onNavigateToCart}
          className="fixed bottom-6 right-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg z-50 transition-all hover:scale-105"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="font-semibold">{totalCartQuantity} item{totalCartQuantity > 1 ? "s" : ""}</span>
        </button>
      )}
    </>
  );
};

// New CartPage component
const CartPage: React.FC<{ onNavigateToList: () => void, cart: CartItem[], setCart: React.Dispatch<React.SetStateAction<CartItem[]>>, products: Product[] }> = ({ onNavigateToList, cart, setCart, products }) => {
    
    const getProductDetails = (productId: number) => {
        return products.find(p => p.product_id === productId);
    }

    const handleQuantityChange = (productId: number, newQuantity: number) => {
        setCart(prevCart => {
            if (newQuantity <= 0) {
                return prevCart.filter(item => item.product_id !== productId);
            }
            return prevCart.map(item => item.product_id === productId ? { ...item, quantity: newQuantity } : item);
        });
    }
    
    const totalPrice = cart.reduce((total, item) => {
        const product = getProductDetails(item.product_id);
        return total + (product ? product.price * item.quantity : 0);
    }, 0);

    return (
        <div>
            <div className="flex items-center gap-3 mb-8">
                <button onClick={onNavigateToList} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ArrowLeft className="h-6 w-6 text-gray-900 dark:text-white" />
                </button>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Your Cart</h1>
            </div>
            {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-600 dark:text-gray-400">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Your cart is empty.</p>
                    <p className="text-sm mt-2">Add some products to get started!</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {cart.map(item => {
                        const product = getProductDetails(item.product_id);
                        if (!product) return null;
                        return (
                            <Card key={item.product_id} className="p-4 flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 h-20 rounded-md overflow-hidden">
                                       <ProductImage src={product.image_url} alt={product.name} className="w-full h-full relative" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{product.name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">₹{product.price}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2">
                                        <button onClick={() => handleQuantityChange(item.product_id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-sm font-medium transition-colors">-</button>
                                        <span className="w-8 text-center font-medium dark:text-white">{item.quantity}</span>
                                        <button onClick={() => handleQuantityChange(item.product_id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-sm font-medium transition-colors">+</button>
                                    </div>
                                    <p className="font-semibold text-lg text-gray-900 dark:text-white">₹{product.price * item.quantity}</p>
                                </div>
                            </Card>
                        )
                    })}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end items-center">
                        <div className="text-right">
                           <p className="text-lg text-gray-600 dark:text-gray-400">Total:</p>
                           <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalPrice.toFixed(2)}</p>
                           <button className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">Checkout</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


// Main App component to manage state and routing
const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState('list'); // 'list' or 'cart'

  // Initialize cart from localStorage safely
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.warn('Failed to load cart from localStorage:', error);
      return [];
    }
  });

  // Fetch products from backend with fallback
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/api/v1/products-with-images/");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.log('Backend not available, using mock data');
        setError('');
        setProducts(mockProducts);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Persist cart in localStorage safely
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch (error) {
      console.warn('Failed to save cart to localStorage:', error);
    }
  }, [cart]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-6 py-8">
      {loading ? (
        <div className="col-span-full flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Loading products...</p>
          </div>
        </div>
      ) : error ? (
        <p className="text-center text-red-500 col-span-full py-12">{error}</p>
      ) : currentPage === 'list' ? (
        <ShoppingList 
            onNavigateToCart={() => setCurrentPage('cart')} 
            cart={cart}
            setCart={setCart}
            products={products}
        />
      ) : (
        <CartPage 
            onNavigateToList={() => setCurrentPage('list')}
            cart={cart}
            setCart={setCart}
            products={products}
        />
      )}
    </div>
  );
};

export default App;
