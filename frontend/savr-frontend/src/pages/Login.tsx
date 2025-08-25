import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState('');   // ✅ New field
  const [preferences, setPreferences] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || "http://127.0.0.1:8000";
  const apiBase = rawApiBase.replace(/\/+$/, "");

  // Validate email
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // LOGIN
  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        if (data.token) localStorage.setItem("authToken", data.token);
        await requestOTP(email);
      } else {
        setError(data?.error || "Login failed");
      }
    } catch (e) {
      setError("Network error");
    }
  };

  // Request OTP after login
  const requestOTP = async (destination: string) => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
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
    if (!address) {
      setError('Address is required');
      return;
    }

    try {
      const payload: any = { username, email, password, address }; // ✅ Send address
      
      if (preferences) {
        try {
          JSON.parse(preferences);
          payload.preferences = preferences;
        } catch {
          setError('Invalid JSON format for preferences');
          return;
        }
      }

      const res = await fetch(`${apiBase}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setError('');
        alert('Registration successful! Please sign in.');
        setIsSignup(false);
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setUsername('');
        setPreferences('');
        setAddress('');
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

        <label className="block mb-3">
          <div className="text-sm mb-1">Email</div>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />
        </label>

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

            {/* ✅ Address input */}
            <label className="block mb-3">
              <div className="text-sm mb-1">Delivery Address</div>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full rounded-md border p-2"
                placeholder="Enter your delivery address"
              />
            </label>

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
