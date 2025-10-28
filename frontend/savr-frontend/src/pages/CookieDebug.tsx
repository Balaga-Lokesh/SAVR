import React, { useEffect, useState } from 'react';

const CookieDebug: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/v1/debug/cookies/', { credentials: 'include' });
      const j = await res.json();
      setData(j);
    } catch (e: any) {
      setErr(String(e));
    } finally { setLoading(false); }
  }

  useEffect(() => { run(); }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Cookie Debug</h1>
      <p className="mb-2">This page fetches <code>/api/v1/debug/cookies/</code> with credentials included and shows the JSON response. Use this after completing the OTP login to verify the httpOnly auth cookie is sent by the browser.</p>
      <div className="mb-4">
        <button className="btn" onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Re-check'}</button>
      </div>
      {err && <div className="text-destructive">Error: {err}</div>}
  <pre className="whitespace-pre-wrap bg-card/5 p-3 rounded">{data ? JSON.stringify(data, null, 2) : 'No data yet'}</pre>
    </div>
  );
}

export default CookieDebug;
