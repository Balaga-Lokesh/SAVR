import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PendingAgent {
  // backend returns `agent_id`, older shapes may use `id` — accept both
  agent_id?: number;
  id?: number;
  name: string;
  email: string;
  contact_number?: string;
  created_at?: string;
}

type Props = {
  onApproved?: () => Promise<void> | void;
};

const PendingAgents: React.FC<Props> = ({ onApproved }) => {
  const [pending, setPending] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({});

  const apiBase = (import.meta.env.VITE_API_BASE as string) ?? '';
  const base = apiBase ? apiBase.replace(/\/+$/, '') : '';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
  const res = await fetch(`${base}/api/v1/admin/partners/pending/`, { credentials: 'include' });
  if (!res.ok) return setError(`Failed to load pending partners (status ${res.status})`);
        const j = await res.json();
        // Normalize to objects that include agent_id for later actions
        const raw = j.pending || j.agents || [];
        const norm = (raw || []).map((x: any) => ({ ...x, agent_id: x.agent_id ?? x.id }));
        setPending(norm);
      } catch (e: any) {
        console.error(e);
  setError('Network error while loading pending partners');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [base]);

  const { toast } = useToast();

  const runAction = async (id: number, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this registration?`)) return;
    setActionLoading(prev => ({ ...prev, [id]: true }));
    try {
  const url = `${base}/api/v1/admin/partners/${id}/${action}/`;
      const res = await fetch(url, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(`Request failed: ${res.status} ${txt}`);
      }
      // remove from pending list on success
      setPending(prev => prev.filter(p => (p.agent_id ?? p.id) !== id));
      // Inform parent to refresh agents list if provided
      try {
        const maybeRes = onApproved && onApproved();
        // if parent returned a Promise, await it
        if (maybeRes && typeof (maybeRes as any).then === 'function') {
          await (maybeRes as Promise<void>);
        }
      } catch (e) {
        // non-fatal: parent refresh failed — we already removed item from pending
        console.warn('onApproved callback failed', e);
      }
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Action failed', description: e?.message || 'Request failed' });
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading pending partner registrations…</div>;
  if (error) return <div className="text-sm text-destructive">{error}</div>;
  if (pending.length === 0) return <div className="text-sm text-muted-foreground">No pending partner registrations</div>;

  return (
    <div className="space-y-2">
      {pending.map(p => {
        const aid = p.agent_id ?? p.id!;
        return (
          <div key={aid} className="p-3 border rounded border-border bg-card flex items-center justify-between">
            <div>
              <div className="font-medium text-foreground">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.email} {p.contact_number ? `• ${p.contact_number}` : ''}</div>
              {p.created_at && <div className="text-xs text-muted-foreground">Requested {p.created_at}</div>}
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="px-3 py-1" onClick={() => runAction(aid, 'approve')} disabled={!!actionLoading[aid]}>{actionLoading[aid] ? 'Approving…' : 'Approve'}</Button>
              <Button size="sm" variant="destructive" onClick={() => runAction(aid, 'reject')} disabled={!!actionLoading[aid]}>{actionLoading[aid] ? 'Rejecting…' : 'Reject'}</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PendingAgents;
