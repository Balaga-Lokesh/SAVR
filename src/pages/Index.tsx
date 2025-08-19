import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      // User is logged in, redirect to shopping flow
      navigate('/shopping-flow');
    } else {
      // User is not logged in, redirect to login
      navigate('/login');
    }
  }, [navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fresh mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading SAVR...</p>
      </div>
    </div>
  );
};

export default Index;