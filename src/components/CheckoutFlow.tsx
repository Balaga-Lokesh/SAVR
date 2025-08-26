import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, MapPin, Clock, CheckCircle, Truck, User } from "lucide-react";

interface CheckoutFlowProps {
  onOrderComplete: () => void;
  selectedPlan?: any;
}

const CheckoutFlow: React.FC<CheckoutFlowProps> = ({ onOrderComplete, selectedPlan }) => {
  const [step, setStep] = useState<'details' | 'payment' | 'confirmation'>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    nameOnCard: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 'details') {
      setStep('payment');
    } else if (step === 'payment') {
      setStep('confirmation');
      setTimeout(() => {
        onOrderComplete();
      }, 3000);
    }
  };

  const deliverySlots = [
    { time: "Today, 3:00 PM - 4:00 PM", price: 4.99, available: true },
    { time: "Today, 6:00 PM - 7:00 PM", price: 3.99, available: true },
    { time: "Tomorrow, 10:00 AM - 11:00 AM", price: 2.99, available: true },
    { time: "Tomorrow, 2:00 PM - 3:00 PM", price: 2.99, available: false }
  ];

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent mb-2">
          Complete Your Order
        </h2>
        <p className="text-muted-foreground">
          Secure checkout with multiple delivery options
        </p>
      </div>

      {step === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter your email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter your phone number"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Delivery Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Enter your delivery address"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Delivery Slots
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {deliverySlots.map((slot, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      slot.available 
                        ? 'hover:border-fresh hover:bg-fresh/5' 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{slot.time}</div>
                        <div className="text-sm text-muted-foreground">
                          Delivery fee: ${slot.price}
                        </div>
                      </div>
                      {slot.available ? (
                        <Badge variant="outline" className="border-fresh text-fresh">
                          Available
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Full
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button
              onClick={handleNext}
              className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg"
              disabled={!formData.name || !formData.email || !formData.address}
            >
              Continue to Payment
            </Button>
          </div>
        </div>
      )}

      {step === 'payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input
                  id="cardNumber"
                  value={formData.cardNumber}
                  onChange={(e) => handleInputChange('cardNumber', e.target.value)}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Input
                    id="expiryDate"
                    value={formData.expiryDate}
                    onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                    placeholder="MM/YY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvv">CVV</Label>
                  <Input
                    id="cvv"
                    value={formData.cvv}
                    onChange={(e) => handleInputChange('cvv', e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameOnCard">Name on Card</Label>
                <Input
                  id="nameOnCard"
                  value={formData.nameOnCard}
                  onChange={(e) => handleInputChange('nameOnCard', e.target.value)}
                  placeholder="Enter name as on card"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-fresh">
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>$24.99</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Fees:</span>
                  <span>$8.47</span>
                </div>
                <div className="flex justify-between text-success">
                  <span>Savings:</span>
                  <span>-$7.00</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span className="text-fresh">$33.46</span>
                </div>
              </div>

              <div className="bg-fresh/10 p-3 rounded-lg">
                <div className="text-sm font-medium text-fresh mb-1">Delivery Details</div>
                <div className="text-xs text-fresh/80">
                  Today, 3:00 PM - 4:00 PM<br />
                  {formData.address || "123 Main Street, City"}
                </div>
              </div>

              <Button
                onClick={handleNext}
                className="w-full bg-gradient-primary hover:opacity-90 shadow-button py-6 text-lg"
                disabled={!formData.cardNumber || !formData.nameOnCard}
              >
                Complete Order
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'confirmation' && (
        <Card className="shadow-card max-w-2xl mx-auto text-center">
          <CardContent className="p-12">
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-2xl font-bold text-success mb-4">Order Confirmed!</h3>
            <p className="text-muted-foreground mb-6">
              Your order has been placed successfully. You'll receive a confirmation email shortly.
            </p>
            <div className="bg-gradient-card p-4 rounded-lg mb-6">
              <div className="flex items-center justify-center gap-2 text-fresh font-semibold mb-2">
                <Truck className="h-5 w-5" />
                Order #SP2024-001
              </div>
              <p className="text-sm text-muted-foreground">
                Estimated delivery: Today, 3:00 PM - 4:00 PM
              </p>
            </div>
            <Button
              onClick={onOrderComplete}
              className="bg-gradient-primary hover:opacity-90"
            >
              Track Your Order
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CheckoutFlow;