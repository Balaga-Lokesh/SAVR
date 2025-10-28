import React, { useEffect, useState } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import PendingAgents from "@/components/admin/PendingAgents";
import { useToast } from "@/hooks/use-toast";

interface OrderItem { product_id: number; name: string; qty: number; price: string; mart: string }
interface Order { order_id: number; user: string; total_cost: string; status: string; items: OrderItem[]; created_at: string }
interface Product { product_id: number; name: string; price: string; stock: number }

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isMainAdmin, setIsMainAdmin] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview'|'inventory'|'agents'|'admins'|'marts'|'deliveries'|'logs'>('overview');
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selectedAgentForDelivery, setSelectedAgentForDelivery] = useState<Record<number, number | null>>({});
  const [partners, setPartners] = useState<any[]>([]);
  const [selectedPartnerForDelivery, setSelectedPartnerForDelivery] = useState<Record<number, number | null>>({});
  const [marts, setMarts] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedAdminForMart, setSelectedAdminForMart] = useState<Record<number, number | null>>({});
  const [editedStocks, setEditedStocks] = useState<Record<number, number>>({});
  const { toast } = useToast();

  // helper to fetch active agents list (used on mount and after approvals)
  const fetchAgents = async () => {
    try {
      const la = await fetch('/api/v1/admin/partners/', { credentials: 'include' });
      if (la.ok) {
        const ja = await la.json();
        // normalize partners to agent-like shape used in this UI
        const parts = (ja.partners || []).map((p:any) => ({ agent_id: p.partner_id, name: p.name, email: p.email, phone: p.phone || '', partner: p }));
        setAgents(parts || []);
      }
    } catch (e) {
      console.error('fetchAgents failed', e);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const me = await fetch('/api/v1/auth/me/', { credentials: 'include' });
        if (!me.ok) { window.location.href = '/admin/login'; return; }
        const mejson = await me.json();
        const main = Boolean(mejson?.is_superuser);
        setIsMainAdmin(main);

        if (main) {
          const o = await fetch('/api/v1/admin/orders/', { credentials: 'include' });
          if (o.ok) { const j = await o.json(); setOrders(j.orders || []); }
        }

        const p = await fetch('/api/v1/products/with-images/');
        if (p.ok) { 
          const jp = await p.json();
          // If current user is a mart-admin (staff but not superuser), filter products to their mart(s)
          if (!main && mejson && (mejson?.is_staff || false)) {
            // try to find Admin record matching this user
            const adminsRes = await fetch('/api/v1/admin/auth/list/', { credentials: 'include' });
            if (adminsRes.ok) {
              const adminsJson = await adminsRes.json();
              const matched = (adminsJson.admins || []).find((a:any) => (a.email && a.email.toLowerCase() === (mejson.email||'').toLowerCase()) || (a.username && a.username.toLowerCase() === (mejson.username||'').toLowerCase()));
              if (matched) {
                // filter by mart_id where mart.admin_id === matched.admin_id — product payload includes mart_id
                setProducts((jp || []).filter((prod:any) => prod.mart_id && prod.mart_id === matched.admin_id));
              } else {
                setProducts(jp || []);
              }
            } else {
              setProducts(jp || []);
            }
          } else {
            setProducts(jp || []);
          }
        }

  await fetchAgents();

        // load marts for assignment view (accessible to main admin)
        if (main) {
          const rm = await fetch('/api/v1/marts/');
          if (rm.ok) { const jm = await rm.json(); setMarts(jm || []); }
        }

        if (main) {
          const la2 = await fetch('/api/v1/admin/auth/list/', { credentials: 'include' });
          if (la2.ok) { const ja2 = await la2.json(); setAdmins(ja2.admins || []); }
        }
        // if admin, also preload deliveries list
        if (main) {
          const rd = await fetch('/api/v1/admin/deliveries/', { credentials: 'include' });
          if (rd.ok) { const jd = await rd.json(); setDeliveries(jd.deliveries || []); }
          // preload partners for assignment UI
          const rp = await fetch('/api/v1/admin/partners/', { credentials: 'include' });
          if (rp.ok) { const jp = await rp.json(); setPartners(jp.partners || []); }
          // preload logs
          const rl = await fetch('/api/v1/admin/logs/', { credentials: 'include' });
          if (rl.ok) { const jl = await rl.json(); setLogs(jl.logs || []); }
        }
      } catch (e) {
        console.error('admin load failed', e);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  // Poll deliveries and orders periodically when Deliveries tab is active so UI reflects partner actions
  useEffect(() => {
    if (activeTab !== 'deliveries') return;
    let stopped = false;
    const tick = async () => {
      try {
        await fetchDeliveries();
        // refresh orders overview too so delivered status appears
        const o = await fetch('/api/v1/admin/orders/', { credentials: 'include' });
        if (o.ok) { const j = await o.json(); setOrders(j.orders || []); }
      } catch (e) {
        // ignore polling errors
      }
    };
    // immediately run once then every 10s
    tick();
    const id = setInterval(() => { if (!stopped) tick(); }, 10000);
    return () => { stopped = true; clearInterval(id); };
  }, [activeTab]);

  const fetchDeliveries = async () => {
    try {
      const res = await fetch('/api/v1/admin/deliveries/', { credentials: 'include' });
      if (!res.ok) return;
      const j = await res.json();
      setDeliveries(j.deliveries || []);
    } catch (e) {
      console.error('fetchDeliveries failed', e);
    }
  };

  // keep local edited stock map in sync with server-loaded products
  useEffect(() => {
    const map: Record<number, number> = {};
    products.forEach((p) => { map[p.product_id] = Number(p.stock || 0); });
    setEditedStocks(map);
  }, [products]);

  const updateStock = async (product_id: number, stock: number) => {
    try {
      const res = await fetch('/api/v1/admin/products/update-stock/', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id, stock })
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { window.location.href = '/admin-login'; return; }
        throw new Error('update failed');
      }
      const j = await res.json();
  setProducts(prev => prev.map(p => p.product_id === product_id ? { ...p, stock: j.stock } : p));
  // keep edited value in sync as well
  setEditedStocks(prev => ({ ...prev, [product_id]: j.stock }));
  setStatusMessage(`Stock for product ${product_id} updated to ${j.stock}`);
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (e: any) {
      console.error(e);
      setStatusMessage(e?.message || 'Failed to update');
      setTimeout(() => setStatusMessage(null), 3500);
    }
  }

    const confirmAndRun = async (message: string, fn: () => Promise<void> | void) => {
      if (!confirm(message)) return;
      try {
        await fn();
      } catch (e: any) {
          console.error(e);
          // Surface backend error messages when available for easier debugging
          toast({ title: 'Action failed', description: e?.message || 'Action failed' });
        }
    }

  const createAgent = async (name: string, email: string, phone?: string, partner_id?: number) => {
    // Always ask for confirmation before creating a partner
  await confirmAndRun(`Create partner ${name} <${email}>?`, async () => {
      const res = await fetch('/api/v1/admin/partners/create/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, partner_id }) });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Create partner failed: ${res.status} ${text}`);
      const j = text ? JSON.parse(text) : {};
      setAgents(prev => [ ...prev, { agent_id: j.partner_id ?? j.agent_id, name, email, phone } ]);
    });
  }

  const deleteAgent = async (agent_id: number) => {
  await confirmAndRun('Delete this partner?', async () => {
      const res = await fetch(`/api/v1/admin/partners/${agent_id}/`, { method: 'DELETE', credentials: 'include' });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Delete partner failed: ${res.status} ${text}`);
      setAgents(prev => prev.filter(a => a.agent_id !== agent_id));
    });
  }

  const createAdminAPI = async (username: string, email: string, password: string, role: 'main_admin'|'mart_admin') => {
    await confirmAndRun(`Create admin ${username} (${role})?`, async () => {
      const res = await fetch('/api/v1/admin/auth/create/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, email, password, role }) });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Create admin failed: ${res.status} ${text}`);
      const j = text ? JSON.parse(text) : {};
      setAdmins(prev => [ ...prev, { admin_id: j.admin_id, username: j.username, role: j.role } ]);
    });
  }

  const deleteAdminAPI = async (admin_id: number) => {
    await confirmAndRun('Delete this admin?', async () => {
      const res = await fetch(`/api/v1/admin/auth/${admin_id}/`, { method: 'DELETE', credentials: 'include' });
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(`Delete admin failed: ${res.status} ${text}`);
      setAdmins(prev => prev.filter(a => a.admin_id !== admin_id));
    });
  }

  return (
    <div className="p-6 text-foreground">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Admin Dashboard</h1>

      <div className="mb-4">
        <div className="inline-flex rounded-lg overflow-hidden border border-border bg-card">
          <button className={`px-3 py-1 ${activeTab==='overview'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`px-3 py-1 ${activeTab==='inventory'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('inventory')}>Inventory</button>
          <button className={`px-3 py-1 ${activeTab==='agents'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('agents')}>Partners</button>
          {isMainAdmin && <button className={`px-3 py-1 ${activeTab==='deliveries'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('deliveries')}>Deliveries</button>}
          {isMainAdmin && <button className={`px-3 py-1 ${activeTab==='logs'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('logs')}>Logs</button>}
          {isMainAdmin && <button className={`px-3 py-1 ${activeTab==='admins'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('admins')}>Admins</button>}
          {isMainAdmin && <button className={`px-3 py-1 ${activeTab==='marts'?'bg-primary text-primary-foreground':'bg-card text-foreground'}`} onClick={() => setActiveTab('marts')}>Marts</button>}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-semibold mb-2 text-foreground">Overview</h2>
          {isMainAdmin ? (
              loading ? <div className="text-muted-foreground">Loading...</div> : (
              orders.length === 0 ? <div>No recent orders</div> : (
                <div className="space-y-3">
                  {orders.map(o => (
                    <div key={o.order_id} className="p-2 border rounded border-border bg-card">
                      <div className="text-sm text-muted-foreground">#{o.order_id} — {o.user} • {o.created_at}</div>
                      <div className="font-medium">{o.total_cost} • {o.status}</div>
                    </div>
                  ))}
                </div>
              )
            )
          ) : <div className="text-sm text-muted-foreground">Overview available to main admin only.</div>}
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-semibold mb-2 text-foreground">Products / Inventory</h2>
          {statusMessage && <div className="mb-3 text-sm text-primary">{statusMessage}</div>}
          {products.length === 0 ? <div>No products</div> : (
            <div className="space-y-2">
              {products.map(p => (
                <div key={p.product_id} className="flex items-center justify-between p-2 border rounded border-border bg-card">
                    <div>
                    <div className="font-medium text-foreground">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Price: ₹{p.price}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 rounded border border-border bg-destructive text-destructive-foreground"
                      onClick={() => {
                        setEditedStocks(prev => ({ ...prev, [p.product_id]: Math.max(0, (prev[p.product_id] ?? p.stock ?? 0) - 1) }));
                      }}
                    >-
                    </button>
                    <span className="px-3 py-1 rounded text-foreground">{editedStocks[p.product_id] ?? p.stock}</span>
                    <button
                      className="px-3 py-1 rounded border border-border bg-success text-success-foreground"
                      onClick={() => {
                        setEditedStocks(prev => ({ ...prev, [p.product_id]: (prev[p.product_id] ?? p.stock ?? 0) + 1 }));
                      }}
                    >+
                    </button>
                    <Button
                      size="sm"
                      className="px-3 py-1"
                      onClick={() => {
                        const val = Number(editedStocks[p.product_id] ?? p.stock ?? 0);
                        confirmAndRun(`Confirm set stock for ${p.name} to ${val}? (Admin confirmation required)`, async () => {
                          await updateStock(p.product_id, val);
                        });
                      }}
                    >Save</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-2 text-foreground">Delivery Partners</h2>
            {isMainAdmin && (
              <div>
                <button className="px-3 py-1 rounded bg-primary text-primary-foreground" onClick={() => {
                  const name = prompt('Partner name'); if (!name) return; const email = prompt('Partner email')||''; confirmAndRun(`Create partner ${name} <${email}>?`, async () => { await createAgent(name, email); });
                }}>Create Partner</button>
              </div>
            )}
          </div>
          {isMainAdmin && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2 text-foreground">Pending registrations</h3>
              <PendingAgents onApproved={fetchAgents} />
            </div>
          )}
          {agents.length === 0 ? <div>No partners</div> : (
            <div className="space-y-2">
              {agents.map(a => (
                <div key={a.agent_id} className="flex items-center justify-between p-2 border rounded border-border bg-card">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.email} • {a.phone}</div>
                  </div>
                  <div>
                    {isMainAdmin ? (
                      <div className="px-2 py-1 rounded border border-border bg-card text-foreground">
                        <Button size="sm" variant="destructive" onClick={() => deleteAgent(a.agent_id)}>Delete</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Managed by main admin</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'deliveries' && isMainAdmin && (
        <div className="p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold mb-2 text-foreground">Deliveries</h2>
            <div>
              <Button size="sm" onClick={async () => { await fetchDeliveries(); await fetchAgents(); const rp = await fetch('/api/v1/admin/partners/', { credentials: 'include' }); if (rp.ok) { setPartners((await rp.json()).partners || []); } }}>Refresh</Button>
            </div>
          </div>
          {deliveries.length === 0 ? <div className="text-sm text-muted-foreground">No deliveries</div> : (
            <div className="space-y-2">
              {deliveries.map(d => (
                <div key={d.delivery_id} className="flex items-center justify-between p-2 border rounded border-border bg-card">
                  <div>
                    <div className="font-medium text-foreground">Delivery #{d.delivery_id} — Order #{d.order_id}</div>
                    <div className="text-xs text-muted-foreground">{d.address || ''} • {d.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select className="px-2 py-1 rounded border border-border bg-card text-foreground" value={selectedAgentForDelivery[d.delivery_id] ?? ''} onChange={(e) => setSelectedAgentForDelivery(prev => ({ ...prev, [d.delivery_id]: Number(e.target.value) || null }))}>
                      <option value="">Select partner</option>
                      {agents.map((a:any) => (
                        <option key={a.agent_id} value={a.agent_id}>{a.name} ({a.email})</option>
                      ))}
                    </select>
                    {/* If selected agent has no partner, show partner select */}
                    {(() => {
                      const sel = selectedAgentForDelivery[d.delivery_id];
                      const agentObj = agents.find((x:any) => x.agent_id === sel);
                      if (sel && agentObj && !agentObj.partner) {
                        return (
                          <>
                            <select className="px-2 py-1 rounded border border-border bg-card text-foreground" value={selectedPartnerForDelivery[d.delivery_id] ?? ''} onChange={(e) => setSelectedPartnerForDelivery(prev => ({ ...prev, [d.delivery_id]: Number(e.target.value) || null }))}>
                              <option value="">Select partner</option>
                              {partners.map((p:any) => (
                                <option key={p.partner_id} value={p.partner_id}>{p.name}</option>
                              ))}
                            </select>
            <Button size="sm" onClick={async () => {
              if (!sel) { alert('Please select a partner first'); return; }
              const partnerSel = selectedPartnerForDelivery[d.delivery_id];
              if (!partnerSel) { alert('Please select a partner for this agent'); return; }
              await confirmAndRun(`Assign delivery ${d.delivery_id} to partner ${partnerSel} (via agent ${sel})?`, async () => {
                                const res = await fetch(`/api/v1/admin/deliveries/${d.delivery_id}/assign/`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: Number(sel), partner_id: Number(partnerSel) }) });
                                const text = await res.text();
                                if (!res.ok) { alert('Assign failed: ' + text); return; }
                                await fetchDeliveries();
                                await fetchAgents();
                                setStatusMessage('Assigned'); setTimeout(() => setStatusMessage(null), 2500);
                              });
                            }}>Assign</Button>
                          </>
                        );
                      }
                      // default path: agent exists and/or has partner already
                      return (
                        <Button size="sm" onClick={async () => {
                          const sel2 = selectedAgentForDelivery[d.delivery_id];
                              if (!sel2) { alert('Please select a partner first'); return; }
                          await confirmAndRun(`Assign delivery ${d.delivery_id} to partner ${sel2}?`, async () => {
                            const res = await fetch(`/api/v1/admin/deliveries/${d.delivery_id}/assign/`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: Number(sel2) }) });
                            const text = await res.text();
                            if (!res.ok) { alert('Assign failed: ' + text); return; }
                            await fetchDeliveries();
                            await fetchAgents();
                            setStatusMessage('Assigned'); setTimeout(() => setStatusMessage(null), 2500);
                          });
                        }}>Assign</Button>
                      );
                    })()}
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={async () => {
                        await confirmAndRun(`Force-fix delivery ${d.delivery_id}? This will mark delivery and order as delivered.`, async () => {
                          const res = await fetch(`/api/v1/admin/deliveries/${d.delivery_id}/fix/`, { method: 'POST', credentials: 'include' });
                          const text = await res.text().catch(() => '');
                          if (!res.ok) { alert('Fix failed: ' + text); return; }
                          const j = text ? JSON.parse(text) : {};
                          await fetchDeliveries();
                          setStatusMessage('Fixed'); setTimeout(() => setStatusMessage(null), 3000);
                          toast({ title: 'Fix result', description: JSON.stringify(j, null, 2) });
                        });
                      }}>Fix</Button>

                      {d.partner && (
                        <Button size="sm" variant="outline" onClick={async () => {
                          const pid = d.partner.partner_id ?? d.partner_id ?? d.partner;
                          try {
                            const res = await fetch(`/api/v1/admin/partners/${pid}/inspect/`, { credentials: 'include' });
                            const text = await res.text().catch(() => '');
                            if (!res.ok) { alert('Inspect failed: ' + text); return; }
                            const j = text ? JSON.parse(text) : {};
                            toast({ title: 'Partner inspect', description: JSON.stringify(j, null, 2) });
                          } catch (e:any) { alert('Inspect failed: ' + (e?.message || e)); }
                        }}>Inspect Partner</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && isMainAdmin && (
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-semibold mb-2 text-foreground">Admin Logs</h2>
          <div className="mb-3">
            <Button size="sm" onClick={async () => { const rl = await fetch('/api/v1/admin/logs/', { credentials: 'include' }); if (rl.ok) setLogs((await rl.json()).logs || []); }}>Refresh</Button>
          </div>
          {logs.length === 0 ? <div className="text-sm text-muted-foreground">No logs</div> : (
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.log_id} className="p-2 border rounded border-border bg-card">
                  <div className="text-sm text-muted-foreground">{l.timestamp} • {l.action_type}</div>
                  <div className="font-medium">{l.admin ? l.admin.username : 'system'}</div>
                  <pre className="text-xs mt-2">{l.details}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'marts' && isMainAdmin && (
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-semibold mb-2 text-foreground">Marts</h2>
          {marts.length === 0 ? <div>No marts</div> : (
            <div className="space-y-2">
              {marts.map((m:any) => (
                <div key={m.mart_id} className="flex items-center justify-between p-2 border rounded border-border bg-card">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-muted-foreground">{m.address || ''}</div>
                    <div className="text-xs text-muted-foreground">Admin: {m.admin ? m.admin.username : 'Unassigned'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMainAdmin && (
                      <>
                        <select className="px-3 py-1 rounded border border-border bg-card text-foreground" value={selectedAdminForMart[m.mart_id] ?? (m.admin?.admin_id ?? '')} onChange={(e) => setSelectedAdminForMart(prev => ({ ...prev, [m.mart_id]: Number(e.target.value) || null }))}>
                          <option value="">Unassigned</option>
                          {admins.map(a => (
                            <option key={a.admin_id} value={a.admin_id}>{a.username} ({a.role})</option>
                          ))}
                        </select>
                        <Button size="sm" className="px-3 py-1" onClick={async () => {
                          const aid = selectedAdminForMart[m.mart_id] ?? (m.admin?.admin_id ?? null);
                          if (aid === null) { alert('Please select an admin (or choose Unassigned).'); return; }
                          if (!confirm(`Assign admin ${aid} to mart ${m.name}?`)) return;
                          try {
                            const body = { admin_id: Number(aid), mart_id: Number(m.mart_id) };
                            const r = await fetch('/api/v1/admin/marts/assign/', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                            const text = await r.text();
                            // Dev log: show response for debugging
                            // eslint-disable-next-line no-console
                            console.info('[admin-assign] status=', r.status, 'body=', text);
                            if (!r.ok) {
                              alert('Assign failed: ' + text);
                              return;
                            }
                            // server returns simple {assigned: True}; re-fetch marts to get updated data
                            const rm = await fetch('/api/v1/marts/');
                            if (rm.ok) {
                              const jm = await rm.json();
                              setMarts(jm || []);
                              alert('Assigned');
                            } else {
                              alert('Assigned, but failed to refresh marts (status ' + rm.status + ')');
                            }
                          } catch (e: any) { console.error(e); alert('Failed to assign: ' + (e?.message || e)); }
                        }}>Assign</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && isMainAdmin && (
        <div className="p-4 border rounded-lg bg-card">
          <h2 className="font-semibold mb-2 text-foreground">Admins</h2>
          <div className="mb-3">
            <Button size="sm" onClick={() => {
              const username = prompt('Username'); if (!username) return; const email = prompt('Email')||''; const pw = prompt('Password')||''; const role = confirm('Make main admin? OK=main, Cancel=mart admin') ? 'main_admin' : 'mart_admin'; createAdminAPI(username, email, pw, role as any);
            }}>Create Admin</Button>
          </div>
          {admins.length === 0 ? <div>No admins</div> : (
            <div className="space-y-2">
              {admins.map(a => (
                <div key={a.admin_id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.username}</div>
                    <div className="text-xs text-muted-foreground">{a.email} • {a.role}</div>
                  </div>
                  <div>
                    <Button size="sm" variant="destructive" onClick={() => deleteAdminAPI(a.admin_id)}>Delete</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
