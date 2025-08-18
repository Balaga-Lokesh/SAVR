import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Brain, TrendingDown, MapPin, Star, Sparkles, CheckCircle, Zap } from "lucide-react";
import ShoppingList from "@/components/ShoppingList";
import StoreComparison from "@/components/StoreComparison";
import OptimizedCart from "@/components/OptimizedCart";
import CheckoutFlow from "@/components/CheckoutFlow";
import heroImage from "@/assets/hero-shopping.jpg";

type AppState = 'landing' | 'shopping-list' | 'comparison' | 'optimized-cart' | 'checkout' | 'complete';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  category: string;
}

const Index = () => {
  const [currentState, setCurrentState] = useState<AppState>('landing');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([]);

  const handleStartShopping = () => {
    setCurrentState('shopping-list');
  };

  const handleOptimizeList = (items: ShoppingItem[]) => {
    setShoppingItems(items);
    setCurrentState('comparison');
  };

  const handleStoreSelection = () => {
    setCurrentState('optimized-cart');
  };

  const handleProceedToCheckout = () => {
    setCurrentState('checkout');
  };

  const handleOrderComplete = () => {
    setCurrentState('complete');
  };

  const handleStartOver = () => {
    setCurrentState('landing');
    setShoppingItems([]);
  };

  if (currentState === 'shopping-list') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
        <div className="container mx-auto py-8">
          <Button 
            onClick={() => setCurrentState('landing')} 
            variant="ghost" 
            className="mb-6"
          >
            ← Back to Home
          </Button>
          <ShoppingList onOptimize={handleOptimizeList} />
        </div>
      </div>
    );
  }

  if (currentState === 'comparison') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
        <div className="container mx-auto py-8">
          <Button 
            onClick={() => setCurrentState('shopping-list')} 
            variant="ghost" 
            className="mb-6"
          >
            ← Back to Shopping List
          </Button>
          <StoreComparison offers={[]} onSelectStore={handleStoreSelection} />
        </div>
      </div>
    );
  }

  if (currentState === 'optimized-cart') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
        <div className="container mx-auto py-8">
          <Button 
            onClick={() => setCurrentState('comparison')} 
            variant="ghost" 
            className="mb-6"
          >
            ← Back to Comparison
          </Button>
          <OptimizedCart items={[]} onProceedToCheckout={handleProceedToCheckout} />
        </div>
      </div>
    );
  }

  if (currentState === 'checkout') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
        <div className="container mx-auto py-8">
          <Button 
            onClick={() => setCurrentState('optimized-cart')} 
            variant="ghost" 
            className="mb-6"
          >
            ← Back to Cart
          </Button>
          <CheckoutFlow onOrderComplete={handleOrderComplete} />
        </div>
      </div>
    );
  }

  if (currentState === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-success/5 to-fresh/10 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-12 w-12 text-success" />
          </div>
          <h1 className="text-4xl font-bold text-success mb-4">Thank You!</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your smart shopping experience is complete. We've optimized your order for the best prices and quality!
          </p>
          <Button 
            onClick={handleStartOver}
            className="bg-gradient-primary hover:opacity-90 shadow-button text-lg px-8 py-6"
          >
            Start New Shopping List
          </Button>
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5">
      {/* Hero Section */}
      <section className="relative py-20 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5"></div>
        <div className="container mx-auto text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 bg-fresh/10 text-fresh border-fresh/20 text-lg px-6 py-2">
              <Sparkles className="mr-2 h-5 w-5" />
              AI-Powered Shopping Assistant
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Smart Shopping
              <span className="bg-gradient-hero bg-clip-text text-transparent block">
                Made Simple
              </span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Find the best deals across multiple stores, optimize your cart with AI, and get fresh groceries delivered to your door.
            </p>
            <Button 
              onClick={handleStartShopping}
              className="bg-gradient-primary hover:opacity-90 shadow-button text-lg px-12 py-6 rounded-xl"
            >
              <ShoppingCart className="mr-3 h-6 w-6" />
              Start Smart Shopping
            </Button>
          </div>

          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10"></div>
            <img 
              src={heroImage} 
              alt="Smart shopping with fresh groceries" 
              className="mx-auto rounded-2xl shadow-card max-w-4xl w-full"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Our AI analyzes inventory, prices, and quality across multiple stores to optimize your shopping experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border-0 bg-gradient-card">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-fresh/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <ShoppingCart className="h-8 w-8 text-fresh" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Add Items</h3>
                <p className="text-muted-foreground">
                  Create your shopping list with our smart interface that categorizes items automatically
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border-0 bg-gradient-card">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-premium/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Brain className="h-8 w-8 text-premium" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI Analysis</h3>
                <p className="text-muted-foreground">
                  Our AI compares prices, quality ratings, and availability across multiple stores
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border-0 bg-gradient-card">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-savings/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <TrendingDown className="h-8 w-8 text-savings" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Optimize Cart</h3>
                <p className="text-muted-foreground">
                  Get the best combination of price, quality, and delivery options across all stores
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border-0 bg-gradient-card">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-success" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Fast Delivery</h3>
                <p className="text-muted-foreground">
                  Get your optimized grocery order delivered fresh to your door in record time
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-6 bg-gradient-card">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Save More with
                <span className="bg-gradient-savings bg-clip-text text-transparent block">
                  Smart Shopping
                </span>
              </h2>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-fresh/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <TrendingDown className="h-5 w-5 text-fresh" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Up to 30% Savings</h3>
                    <p className="text-muted-foreground">
                      Our AI finds the best deals and compares prices across multiple stores automatically
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-premium/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Star className="h-5 w-5 text-premium" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Quality Guaranteed</h3>
                    <p className="text-muted-foreground">
                      Sentiment analysis ensures you get the freshest products with the best ratings
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cart/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                    <Zap className="h-5 w-5 text-cart" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Lightning Fast</h3>
                    <p className="text-muted-foreground">
                      Optimized delivery routes and multi-store coordination for fastest delivery
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-card bg-fresh/5 border-fresh/20">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-fresh mb-2">30%</div>
                  <div className="text-sm text-muted-foreground">Average Savings</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-premium/5 border-premium/20">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-premium mb-2">4.9★</div>
                  <div className="text-sm text-muted-foreground">Quality Score</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-savings/5 border-savings/20">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-savings mb-2">25min</div>
                  <div className="text-sm text-muted-foreground">Avg Delivery</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-success/5 border-success/20">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-success mb-2">50K+</div>
                  <div className="text-sm text-muted-foreground">Happy Users</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <Card className="shadow-card max-w-4xl mx-auto bg-gradient-hero text-white border-0">
            <CardContent className="p-12">
              <h2 className="text-4xl font-bold mb-4">
                Ready to Transform Your Shopping?
              </h2>
              <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
                Join thousands of smart shoppers who save time and money with our AI-powered shopping assistant
              </p>
              <Button 
                onClick={handleStartShopping}
                className="bg-white text-fresh hover:bg-white/90 shadow-button text-lg px-12 py-6 rounded-xl"
              >
                <Sparkles className="mr-3 h-6 w-6" />
                Get Started Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;