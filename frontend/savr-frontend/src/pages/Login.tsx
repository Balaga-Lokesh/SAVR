import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLong, setLocationLong] = useState('');
  const [preferences, setPreferences] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "http://127.0.0.1:8000";
  const apiBase = rawApiBase.replace(/\/+$/, "");

  // Auto-detect location when on signup
  useEffect(() => {
    if (isSignup && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationLat(pos.coords.latitude.toString());
          setLocationLong(pos.coords.longitude.toString());
        },
        (err) => {
          console.warn('Location access denied:', err.message);
        }
      );
    }
  }, [isSignup]);

  // Basic email validation
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // LOGIN
  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/v1/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {}

      if (res.ok) {
        // Store token locally
        if (data.token) {
          localStorage.setItem("authToken", data.token);
        }
        // Proceed with OTP step
        await requestOTP(email);
      } else {
        setError(data?.error || "Login failed");
      }
    } catch (e) {
      setError("Network error");
    }
  };

  // Request OTP after successful login
  const requestOTP = async (destination: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/request-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination, purpose: 'login' }),
      });
      if (res.ok) {
        sessionStorage.setItem('otp_dest', destination);
        navigate('/verify-otp');
      } else {
        setError('Failed to send OTP');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  // REGISTER
  const handleRegister = async () => {
    if (!username || !email || !password) {
      setError('Username, email, and password are required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      const payload: any = { username, email, password };
      if (locationLat) payload.location_lat = parseFloat(locationLat);
      if (locationLong) payload.location_long = parseFloat(locationLong);
      if (preferences) {
        try {
          JSON.parse(preferences);
          payload.preferences = preferences;
        } catch {
          setError('Invalid JSON format for preferences');
          return;
        }
      }

      const res = await fetch(`${apiBase}/api/v1/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setError('');
        alert('Registration successful! Please sign in.');
        setIsSignup(false);
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setUsername('');
        setPreferences('');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (e) {
      setError('Network error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">
          {isSignup ? 'Create an account' : 'Log in to SAVR'}
        </h2>
        {error && <p className="text-destructive mb-4">{error}</p>}

        {isSignup && (
          <label className="block mb-3">
            <div className="text-sm mb-1">Email</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </label>
        )}

        {!isSignup && (
          <label className="block mb-3">
            <div className="text-sm mb-1">Email</div>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </label>
        )}

        <label className="block mb-3">
          <div className="text-sm mb-1">Password</div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
          />
        </label>

        {isSignup && (
          <>
            <label className="block mb-3">
              <div className="text-sm mb-1">Username</div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
              />
            </label>

            <label className="block mb-3">
              <div className="text-sm mb-1">Confirm password</div>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
              />
            </label>

            <div className="text-sm text-muted-foreground mb-3">
              {locationLat && locationLong ? (
                <p>📍 Location detected: {locationLat}, {locationLong}</p>
              ) : (
                <p>Detecting your location...</p>
              )}
            </div>

            <label className="block mb-3">
              <div className="text-sm mb-1">Preferences (JSON)</div>
              <textarea
                value={preferences}
                onChange={(e) => setPreferences(e.target.value)}
                className="w-full rounded-md border p-2"
                placeholder='{"veg": true}'
              />
            </label>
          </>
        )}

        <div className="flex gap-3">
          {!isSignup ? (
            <Button onClick={handleLogin} className="flex-1">Sign in</Button>
          ) : (
            <Button onClick={handleRegister} className="flex-1">Sign up</Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setIsSignup(!isSignup);
              setError('');
            }}
          >
            {isSignup ? 'Have an account? Sign in' : 'New? Sign up'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;
