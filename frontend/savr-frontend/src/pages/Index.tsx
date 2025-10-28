import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Brain, TrendingDown, MapPin, Star, Sparkles, CheckCircle, Zap } from "lucide-react";
import { useNavigate, Link } from 'react-router-dom';
import heroImage from "@/assets/hero-shopping.jpg";

/**
 * Visual upgrades only:
 * - Better section spacing on all breakpoints
 * - Elevated/glassy cards with soft shadows + border accents
 * - Subtle hover/tap animations (scale/translate/opacity) without changing content
 * - Enhanced gradient backdrops + decorative blobs (non-intrusive)
 * - Slightly tighter line lengths & max-widths for readability
 * - Accessible alt text and focus-visible styles retained
 */
const Index = () => {
  const navigate = useNavigate();

  const handleStartShopping = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-fresh/5 selection:bg-fresh/20 selection:text-foreground">
      {/* Decorative background orbs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-fresh/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Hero Section */}
      <section className="relative py-16 md:py-20 lg:py-24 px-4 md:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container mx-auto text-center relative z-10">
          <div className="mx-auto w-full max-w-5xl">
            <Badge className="mb-6 md:mb-8 bg-fresh/10 text-fresh border-fresh/20 text-base md:text-lg px-5 md:px-6 py-2 shadow-sm backdrop-blur">
              <Sparkles className="mr-2 h-5 w-5" />
              AI-Powered Shopping Assistant
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-4 md:mb-6 leading-tight tracking-[-0.02em] dark:text-white">
              Smart Shopping
              <span className="bg-gradient-hero bg-clip-text text-transparent block dark:bg-none dark:text-white">
                Made Simple
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-2xl md:max-w-3xl mx-auto leading-relaxed">
              Find the best deals across multiple stores, optimize your cart with AI, and get fresh groceries delivered to your door.
            </p>

            {/* Primary CTA — content unchanged */}
            <Button
              asChild
              className="bg-gradient-primary hover:opacity-90 shadow-button text-base md:text-lg px-10 md:px-12 py-5 md:py-6 rounded-xl transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <Link to="/who" className="inline-flex items-center">
                <ShoppingCart className="mr-3 h-5 w-5 md:h-6 md:w-6" />
                Start Smart Shopping
              </Link>
            </Button>
          </div>

          {/* Hero image with soft mask + ring */}
          <div className="mt-12 md:mt-16 relative mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10 pointer-events-none" />
            <img
              src={heroImage}
              alt="Smart shopping with fresh groceries"
                 className="mx-auto rounded-2xl shadow-card max-w-3xl md:max-w-4xl w-full ring-1 ring-border/10"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14 md:py-20 px-4 md:px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">How It Works</h2>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl md:max-w-3xl mx-auto">
              Our AI analyzes inventory, prices, and quality across multiple stores to optimize your shopping experience
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border border-border/40 bg-gradient-card/90 backdrop-blur-md group">
              <CardContent className="p-7 md:p-8 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-fresh/10 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="h-7 w-7 md:h-8 md:w-8 text-fresh" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2.5 md:mb-3">Add Items</h3>
                <p className="text-muted-foreground">
                  Create your shopping list with our smart interface that categorizes items automatically
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border border-border/40 bg-gradient-card/90 backdrop-blur-md group">
              <CardContent className="p-7 md:p-8 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-premium/10 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 group-hover:scale-105 transition-transform">
                  <Brain className="h-7 w-7 md:h-8 md:w-8 text-premium" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2.5 md:mb-3">AI Analysis</h3>
                <p className="text-muted-foreground">
                  Our AI compares prices, quality ratings, and availability across multiple stores
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border border-border/40 bg-gradient-card/90 backdrop-blur-md group">
              <CardContent className="p-7 md:p-8 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-savings/10 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 group-hover:scale-105 transition-transform">
                  <TrendingDown className="h-7 w-7 md:h-8 md:w-8 text-savings" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2.5 md:mb-3">Optimize Cart</h3>
                <p className="text-muted-foreground">
                  Get the best combination of price, quality, and delivery options across all stores
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-soft transition-all duration-300 border border-border/40 bg-gradient-card/90 backdrop-blur-md group">
              <CardContent className="p-7 md:p-8 text-center">
                <div className="w-14 h-14 md:w-16 md:h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-5 md:mb-6 group-hover:scale-105 transition-transform">
                  <CheckCircle className="h-7 w-7 md:h-8 md:w-8 text-success" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-2.5 md:mb-3">Fast Delivery</h3>
                <p className="text-muted-foreground">
                  Get your optimized grocery order delivered fresh to your door in record time
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 md:py-20 px-4 md:px-6 bg-gradient-card/70 backdrop-blur-sm">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-5 md:mb-6 tracking-tight">
                Save More with
                <span className="bg-gradient-savings bg-clip-text text-transparent block">
                  Smart Shopping
                </span>
              </h2>
              <div className="space-y-5 md:space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-fresh/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-fresh/20">
                    <TrendingDown className="h-5 w-5 text-fresh" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base md:text-lg mb-1.5 md:mb-2">Up to 30% Savings</h3>
                    <p className="text-muted-foreground">
                      Our AI finds the best deals and compares prices across multiple stores automatically
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-premium/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-premium/20">
                    <Star className="h-5 w-5 text-premium" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base md:text-lg mb-1.5 md:mb-2">Quality Guaranteed</h3>
                    <p className="text-muted-foreground">
                      Sentiment analysis ensures you get the freshest products with the best ratings
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cart/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-1 ring-1 ring-cart/20">
                    <Zap className="h-5 w-5 text-cart" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base md:text-lg mb-1.5 md:mb-2">Lightning Fast</h3>
                    <p className="text-muted-foreground">
                      Optimized delivery routes and multi-store coordination for fastest delivery
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:gap-5">
              <Card className="shadow-card bg-fresh/5 border-fresh/20 hover:bg-fresh/10 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-fresh mb-1.5 sm:mb-2">30%</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Average Savings</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-premium/5 border-premium/20 hover:bg-premium/10 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-premium mb-1.5 sm:mb-2">4.9★</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Quality Score</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-savings/5 border-savings/20 hover:bg-savings/10 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-savings mb-1.5 sm:mb-2">25min</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Avg Delivery</div>
                </CardContent>
              </Card>
              <Card className="shadow-card bg-success/5 border-success/20 hover:bg-success/10 transition-colors">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-success mb-1.5 sm:mb-2">50K+</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Happy Users</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-20 px-4 md:px-6">
        <div className="container mx-auto text-center">
          <Card className="shadow-card max-w-4xl mx-auto bg-gradient-hero text-white border-0 overflow-hidden">
            <div className="absolute inset-0 opacity-10 pointer-events-none" />
            <CardContent className="relative p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-3 md:mb-4">
                Ready to Transform Your Shopping?
              </h2>
              <p className="text-base md:text-xl opacity-90 mb-6 md:mb-8 max-w-2xl mx-auto">
                Join thousands of smart shoppers who save time and money with our AI-powered shopping assistant
              </p>

              {/* Secondary CTA — content unchanged */}
                <Button
                asChild
                className="bg-card text-fresh hover:bg-card/90 shadow-button text-base md:text-lg px-10 md:px-12 py-5 md:py-6 rounded-xl transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Link to="/who" className="inline-flex items-center">
                  <Sparkles className="mr-3 h-5 w-5 md:h-6 md:w-6" />
                  Get Started Now
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
