import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';

interface Delivery {
  delivery_id: number;
  order_id: number;
  status: string;
  estimated_time?: number | null;
  created_at?: string;
}

const AgentDashboard: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [agentName, setAgentName] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
  const res = await fetch('/api/v1/partners/deliveries/', { credentials: 'include' });
      if (!res.ok) {
        setDeliveries([]);
        return;
      }
      const j = await res.json();
      setDeliveries(j.deliveries || []);
      // optionally fetch agent info
      try {
  const me = await fetch('/api/v1/auth/me/', { credentials: 'include' });
        if (me.ok) { const jm = await me.json(); setAgentName(jm?.name || jm?.username || null); }
      } catch (e) { /* ignore */ }
    } catch (e) {
      console.error('failed to load agent deliveries', e);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // optional polling every 30s while mounted
  useEffect(() => {
    const id = setInterval(() => { load(); }, 30000);
    return () => clearInterval(id);
  }, []);

  const { toast } = useToast();

  const markDelivered = async (id: number) => {
    if (!confirm('Mark this delivery as delivered?')) return;
    try {
  const res = await fetch(`/api/v1/partners/deliveries/${id}/mark-delivered/`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual_time: 0 }) });
      if (!res.ok) throw new Error('failed');
      toast({ title: 'Marked delivered', description: `Delivery ${id} marked delivered` });
      load();
    } catch (e) {
      console.error(e); toast({ title: 'Failed', description: 'Failed to mark delivered' });
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Delivery Partner Dashboard {agentName ? `— ${agentName}` : ''}</h1>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Assigned orders are listed below. Mark delivered when complete.</p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => load()}>Refresh</Button>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? <div>Loading…</div> : (
          deliveries.length === 0 ? <div className="p-4 border rounded-lg bg-card">No assigned deliveries</div> : (
            deliveries.map(d => (
              <div key={d.delivery_id} className={`p-4 border rounded-lg bg-card flex items-center justify-between ${d.status==='delivered'?'opacity-60':''}`} style={{
                boxShadow: d.status === 'assigned' ? '0 0 0 3px hsl(var(--warning) / 0.18)' : d.status === 'in_transit' ? '0 0 0 3px hsl(var(--accent) / 0.18)' : undefined
              }}>
                <div>
                  <div className="font-medium">Order #{d.order_id} • Delivery #{d.delivery_id}</div>
                  <div className="text-sm text-muted-foreground">Status: {d.status} • ETA: {d.estimated_time ?? '—'}</div>
                </div>
                <div>
                  {d.status !== 'delivered' && <Button onClick={() => markDelivered(d.delivery_id)}>Mark delivered</Button>}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;
