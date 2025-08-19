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
  const [locationLat, setLocationLat] = useState('');
  const [locationLong, setLocationLong] = useState('');
  const [preferences, setPreferences] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
  const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
  const res = await fetch(`${apiBase}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        navigate('/');
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const handleRegister = async () => {
    if (!username || !email || !password) {
      alert('username, email and password required');
      return;
    }
    if (password !== confirmPassword) {
      alert('passwords do not match');
      return;
    }
    try {
  const payload: any = { username, email, password };
  if (locationLat) payload.location_lat = parseFloat(locationLat);
  if (locationLong) payload.location_long = parseFloat(locationLong);
  if (preferences) payload.preferences = preferences;
  const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
  const res = await fetch(`${apiBase}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        navigate('/');
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  const requestOtp = async () => {
    const dest = prompt('Enter email or phone for OTP');
    if (!dest) return;
    const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
    const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destination: dest, purpose: 'login' })
    });
    if (res.ok) {
      // navigate to verify page with destination stored
      sessionStorage.setItem('otp_dest', dest);
      navigate('/verify-otp');
    } else {
      alert('Failed to send OTP');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">{isSignup ? 'Create an account' : 'Log in to SAVR'}</h2>

        {isSignup && (
          <>
            <label className="block mb-3">
              <div className="text-sm mb-1">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </>
        )}

        <label className="block mb-3">
          <div className="text-sm mb-1">Username</div>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>

        <label className="block mb-3">
          <div className="text-sm mb-1">Password</div>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>

        {isSignup && (
          <>
            <label className="block mb-3">
              <div className="text-sm mb-1">Confirm password</div>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>

            <label className="block mb-3">
              <div className="text-sm mb-1">Location (lat)</div>
              <Input value={locationLat} onChange={(e) => setLocationLat(e.target.value)} placeholder="optional" />
            </label>
            <label className="block mb-3">
              <div className="text-sm mb-1">Location (long)</div>
              <Input value={locationLong} onChange={(e) => setLocationLong(e.target.value)} placeholder="optional" />
            </label>
            <label className="block mb-3">
              <div className="text-sm mb-1">Preferences (JSON)</div>
              <textarea value={preferences} onChange={(e) => setPreferences(e.target.value)} className="w-full rounded-md border p-2" placeholder='{"veg": true}' />
            </label>
          </>
        )}

        <div className="flex gap-3">
          {!isSignup ? (
            <Button onClick={handleLogin} className="flex-1">Sign in</Button>
          ) : (
            <Button onClick={handleRegister} className="flex-1">Sign up</Button>
          )}
          <Button variant="ghost" onClick={() => setIsSignup(!isSignup)} className="">{isSignup ? 'Have an account? Sign in' : 'New? Sign up'}</Button>
        </div>

        <div className="mt-4 text-sm text-muted-foreground">
          <button onClick={requestOtp} className="underline">Sign in with OTP</button>
        </div>
  </div>
    </div>
  );
};

export default Login;
