import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, MapPin, Clock, TrendingDown, Award } from "lucide-react";

interface StoreOffer {
  store: string;
  distance: string;
  rating: number;
  totalPrice: number;
  savings: number;
  deliveryTime: string;
  sentiment: 'excellent' | 'good' | 'average';
  offers: Array<{
    item: string;
    price: number;
    originalPrice: number;
    quality: number;
  }>;
}

interface StoreComparisonProps {
  offers: StoreOffer[];
  onSelectStore: (storeOffers: StoreOffer[]) => void;
}

const mockStores: StoreOffer[] = [
  {
    store: "Mart A",
    distance: "0.5 km",
    rating: 4.5,
    totalPrice: 24.99,
    savings: 8.50,
    deliveryTime: "25 mins",
    sentiment: 'excellent',
    offers: [
      { item: "Milk", price: 3.49, originalPrice: 4.99, quality: 4.5 },
      { item: "Bread", price: 2.99, originalPrice: 3.49, quality: 4.2 },
      { item: "Apples", price: 4.99, originalPrice: 5.99, quality: 4.8 }
    ]
  },
  {
    store: "Fresh Mart",
    distance: "1.2 km", 
    rating: 4.2,
    totalPrice: 26.75,
    savings: 6.25,
    deliveryTime: "35 mins",
    sentiment: 'good',
    offers: [
      { item: "Milk", price: 3.99, originalPrice: 4.99, quality: 4.3 },
      { item: "Bread", price: 3.25, originalPrice: 3.49, quality: 4.0 },
      { item: "Apples", price: 5.49, originalPrice: 5.99, quality: 4.5 }
    ]
  },
  {
    store: "Budget Store",
    distance: "2.0 km",
    rating: 3.8,
    totalPrice: 22.50,
    savings: 10.50,
    deliveryTime: "45 mins",
    sentiment: 'average',
    offers: [
      { item: "Milk", price: 2.99, originalPrice: 4.99, quality: 3.8 },
      { item: "Bread", price: 2.49, originalPrice: 3.49, quality: 3.5 },
      { item: "Apples", price: 4.25, originalPrice: 5.99, quality: 4.0 }
    ]
  }
];

const StoreComparison: React.FC<StoreComparisonProps> = ({ onSelectStore }) => {
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'excellent': return 'bg-success text-success-foreground';
      case 'good': return 'bg-warning text-warning-foreground';
      case 'average': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'excellent': return <Award className="h-4 w-4" />;
      case 'good': return <Star className="h-4 w-4" />;
      case 'average': return <TrendingDown className="h-4 w-4" />;
      default: return <TrendingDown className="h-4 w-4" />;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Store Comparison Results
        </h2>
        <p className="text-muted-foreground">
          AI-powered analysis of nearby stores with quality scoring and cost optimization
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {mockStores.map((store, index) => (
          <Card key={store.store} className={`shadow-card hover:shadow-soft transition-all duration-300 ${index === 0 ? 'ring-2 ring-fresh' : ''}`}>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-xl">{store.store}</CardTitle>
                {index === 0 && (
                  <Badge className="bg-fresh text-white">
                    <Award className="h-3 w-3 mr-1" />
                    Best Deal
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {store.distance}
                </div>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  {store.rating}
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {store.deliveryTime}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-fresh">${store.totalPrice}</span>
                  <Badge className="bg-savings text-savings-foreground">
                    Save ${store.savings}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getSentimentColor(store.sentiment)}>
                    {getSentimentIcon(store.sentiment)}
                    <span className="ml-1 capitalize">{store.sentiment} Quality</span>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Item Breakdown:</h4>
                  {store.offers.map((offer) => (
                    <div key={offer.item} className="flex justify-between text-sm">
                      <span>{offer.item}</span>
                      <div className="text-right">
                        <span className="font-medium">${offer.price}</span>
                        <span className="ml-1 text-xs text-muted-foreground line-through">
                          ${offer.originalPrice}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full" 
                  variant={index === 0 ? "default" : "outline"}
                  onClick={() => onSelectStore([store])}
                >
                  {index === 0 ? "Choose Best Deal" : "Select Store"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card bg-gradient-card">
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Multi-Store Optimization Available</h3>
            <p className="text-muted-foreground mb-4">
              Get even better savings by splitting your order across multiple stores
            </p>
            <Button 
              onClick={() => onSelectStore(mockStores)}
              className="bg-gradient-primary hover:opacity-90 shadow-button"
            >
              Optimize Across All Stores
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StoreComparison;