import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const VerifyOTP = () => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dest = sessionStorage.getItem('otp_dest') || '';

  const handleVerify = async () => {
    if (!code) {
      setError('Please enter the OTP code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const apiBase = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8000';
      const res = await fetch(`${apiBase}/api/v1/auth/verify-otp/`, {  // ✅ Corrected URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: dest, code })
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('Failed to parse JSON:', jsonErr);
        setError(`Server error: ${res.statusText}`);
        return;
      }

      if (res.ok) {
        localStorage.setItem('token', data.token || 'authenticated');
        navigate('/shopping-list');
      } else {
        console.error('Server returned error:', data);
        setError(data.error || 'Invalid code');
      }
    } catch (e) {
      console.error('Fetch failed:', e);
      setError('Network error. Check backend server or CORS.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">Verify OTP</h2>
        <p className="mb-4 text-sm">Code sent to: <strong>{dest}</strong></p>
        {error && <p className="text-destructive mb-4">{error}</p>}
        <label className="block mb-6">
          <div className="text-sm mb-1">OTP Code</div>
          <Input 
            value={code} 
            onChange={(e) => setCode(e.target.value)} 
            placeholder="Enter 6-digit code"
            maxLength={6}
          />
        </label>
        <Button onClick={handleVerify} className="w-full" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </Button>
      </div>
    </div>
  );
};

export default VerifyOTP;
