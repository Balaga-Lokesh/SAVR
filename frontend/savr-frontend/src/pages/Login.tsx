import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);

  // Shared
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Signup-only
  const [username, setUsername] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const rawApiBase = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
  const apiBase = rawApiBase.replace(/\/+$/, '');

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validatePhone = (v: string) => /^[0-9]{7,15}$/.test(v.replace(/\D/g, ''));

  // LOGIN → then request OTP → go to /verify-otp
  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Login failed');
        return;
      }

      // if backend returns a temp token for OTP step, keep it in sessionStorage
      if (data?.temp_token) {
        sessionStorage.setItem('temp_token', data.temp_token);
      }

      // proceed to OTP
      await requestOTP(email);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Request OTP after login
  const requestOTP = async (destination: string) => {
    try {
      const body: Record<string, string> = { destination, purpose: 'login' };
      const temp = sessionStorage.getItem('temp_token');
      if (temp) {
        body['temp_token'] = temp;
      }

      const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        sessionStorage.setItem('otp_dest', destination);
        navigate('/verify-otp');
      } else {
        setError('Failed to send OTP');
      }
    } catch {
      setError('Network error');
    }
  };

  // SIGNUP → success popup → switch to Sign in
  const handleRegister = async () => {
    setError('');
    if (!username || !email || !password || !contactNumber) {
      setError('All fields are required');
      return;
    }
    if (!validateEmail(email)) {
      setError('Invalid email format');
      return;
    }
    if (!validatePhone(contactNumber)) {
      setError('Enter a valid contact number (digits only, 7–15)');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username,
        email,
        password,
        contact_number: contactNumber,
      };

      const res = await fetch(`${apiBase}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setUsername('');
        setEmail('');
        setPassword('');
        setContactNumber('');
        alert('Registration successful! Please sign in.');
        setIsSignup(false);
      } else {
        setError(data?.error || 'Registration failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">
          {isSignup ? 'Create an account' : 'Log in to SAVR'}
        </h2>

        {error && <p className="text-destructive mb-4">{error}</p>}

        {/* Email */}
        <label className="block mb-3">
          <div className="text-sm mb-1">Email</div>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        {/* Password */}
        <label className="block mb-3">
          <div className="text-sm mb-1">Password</div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {/* Signup-only fields */}
        {isSignup && (
          <>
            <label className="block mb-3">
              <div className="text-sm mb-1">Username</div>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_nickname"
              />
            </label>

            <label className="block mb-5">
              <div className="text-sm mb-1">Contact number</div>
              <Input
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                placeholder="e.g., 9876543210"
              />
            </label>
          </>
        )}

        <div className="flex gap-3">
          {!isSignup ? (
            <Button onClick={handleLogin} className="flex-1" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          ) : (
            <Button onClick={handleRegister} className="flex-1" disabled={loading}>
              {loading ? 'Creating…' : 'Sign up'}
            </Button>
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
