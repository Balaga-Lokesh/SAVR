import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [isSignup, setIsSignup] = useState(false);
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [locationLat, setLocationLat] = useState('');
  const [locationLong, setLocationLong] = useState('');
  const [preferences, setPreferences] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const navigate = useNavigate();

  const apiBase = apiUrl('');

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

  // LOGIN with OTP verification
  const handleLogin = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // backend expects `email` + `password` (or email-like identifier)
        body: JSON.stringify({ email: email || username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        // After successful login, request OTP
        await requestOTP();
      } else {
        if (data.error === 'invalid credentials') {
          alert('User does not exist. Please sign up first.');
          setIsSignup(true);
        } else {
          alert(data.error || 'Login failed');
        }
      }
    } catch (e) {
      alert('Network error');
    }
  };

  // Request OTP after successful login
  const requestOTP = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/request-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: email || username, purpose: 'login' })
      });
      if (res.ok) {
        setStep('otp');
        alert('OTP sent to your registered email');
      } else {
        alert('Failed to send OTP');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  // Verify OTP and complete login
  const handleVerifyOTP = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/auth/verify-otp/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: email || username, code: otpCode })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token || 'authenticated');
        navigate('/shopping-flow');
      } else {
        alert(data.error || 'Invalid OTP code');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  // REGISTER
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

      const res = await fetch(`${apiBase}/api/v1/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        alert('Registration successful! Please sign in.');
        setIsSignup(false);
        setStep('credentials');
        // Clear form
        setPassword('');
        setConfirmPassword('');
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (e) {
      alert('Network error');
    }
  };

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
        <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
          <h2 className="text-2xl font-bold mb-6">Verify OTP</h2>
          <p className="mb-4 text-sm">Enter the OTP sent to your registered email</p>
          <label className="block mb-6">
            <div className="text-sm mb-1">OTP Code</div>
            <Input 
              value={otpCode} 
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Enter 6-digit code"
              maxLength={6}
            />
          </label>
          <div className="flex gap-3">
            <Button onClick={handleVerifyOTP} className="flex-1">Verify & Continue</Button>
            <Button variant="ghost" onClick={() => setStep('credentials')}>Back</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">
          {isSignup ? 'Create an account' : 'Log in to SAVR'}
        </h2>

        {isSignup && (
          <label className="block mb-3">
            <div className="text-sm mb-1">Email</div>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
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
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            {/* Show auto-detected location */}
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
          <Button variant="ghost" onClick={() => setIsSignup(!isSignup)}>
            {isSignup ? 'Have an account? Sign in' : 'New? Sign up'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Login;