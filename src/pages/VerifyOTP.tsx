import React, { useState } from 'react';
import { apiUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';

const VerifyOTP = () => {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const dest = sessionStorage.getItem('otp_dest') || '';

  const handleVerify = async () => {
  const apiBase = apiUrl('');
    const res = await fetch(`${apiBase}/api/v1/auth/verify-otp/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: dest, code })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token || 'authenticated');
      navigate('/shopping-flow');
    } else {
      alert(data.error || 'Invalid code');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-fresh/5 p-6">
      <div className="w-full max-w-md bg-card p-8 rounded-xl shadow-card">
        <h2 className="text-2xl font-bold mb-6">Verify OTP</h2>
        <p className="mb-4 text-sm">Code sent to: <strong>{dest}</strong></p>
        <label className="block mb-6">
          <div className="text-sm mb-1">OTP Code</div>
          <Input value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <Button onClick={handleVerify} className="w-full">Verify & Continue</Button>
      </div>
    </div>
  );
};

export default VerifyOTP;