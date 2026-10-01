import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, AlertTriangle, FileText, RefreshCw, Shield, Users } from 'lucide-react';
import { useAuth } from '../context/authContext';
import { filterAuditLogs } from './adminPanelUtils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ink = '#1C1F26';
const teal = '#0F6E56';
const muted = '#65717B';
const border = '#DDE3E5';
const card = { background: '#fff', border: `1px solid ${border}`, borderRadius: 8 };
const button = { font: 'inherit', fontSize: 13, fontWeight: 650, borderRadius: 6, padding: '8px 11px', border: `1px solid ${border}`, background: '#fff', color: ink, cursor: 'pointer' };
const cell = { padding: '11px 12px', borderBottom: `1px solid ${border}`, textAlign: 'left', verticalAlign: 'middle' };
const roleTones = {
  admin: { color: '#8A5060', background: '#F7EEF1' },
  engineer: { color: '#466E88', background: '#EDF3F7' },
  viewer: { color: muted, background: '#F3F5F5' },
};
const statusTones = {
  SUCCESS: { color: teal, background: '#EAF4F0' },
  DENIED: { color: '#9B4242', background: '#F9EEEE' },
  FAILED: { color: '#9B4242', background: '#F9EEEE' },
};
const actionLabels = {
  LOGIN: 'Signed in', LOGOUT: 'Signed out', ACCESS_DENIED: 'Access denied',
  REVOKE_CLEARANCE: 'Access revocation', ACTIVATE_BRIDGE: 'Bridge activated',
  DEACTIVATE_BRIDGE: 'Bridge deactivated', ACKNOWLEDGE_ALERT: 'Alert acknowledged',
  EXPORT_REPORT: 'PDF report exported', EXPORT_AGENT_REPORT: 'Inspection PDF exported',
  EXPORT_CHAT_REPORT: 'Chat PDF exported',
};

function readable(value) {
  if (!value) return 'Unavailable';
  const words = value.replaceAll('_', ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? (parts[0][0] + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() : '?';
}

function timestamp(value) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Unavailable' : parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function Pill({ value, tones }) {
  const tone = tones[value] || { color: muted, background: '#F3F5F5' };
  return <span style={{ display: 'inline-block', padding: '4px 8px', borderRadius: 5, background: tone.background, color: tone.color, fontWeight: 650, fontSize: 12, textTransform: 'none', whiteSpace: 'nowrap' }}>{readable(value)}</span>;
}

async function requestJson(url, token, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status})`);
  }
  return response.json();
}

export default function AdminPanel() {
  const { user: currentUser, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);
  const isAdmin = currentUser?.role === 'admin';

  const loadData = useCallback(async (showLoading = false) => {
    if (!token || !isAdmin) return;
    if (showLoading) setLoading(true);
    setError('');
    try {
      const [people, logs, overview, me] = await Promise.all([
        requestJson(`${API_BASE}/api/auth/users`, token),
        requestJson(`${API_BASE}/api/audit-log`, token),
        requestJson(`${API_BASE}/api/admin/metrics`, token),
        requestJson(`${API_BASE}/api/auth/me`, token),
      ]);
      setUsers(people);
      setAuditLogs(logs);
      setMetrics(overview);
      setVerifiedUser(me);
      setHasLoaded(true);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, token]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    Promise.resolve().then(() => loadData(true));
    const interval = setInterval(() => loadData(false), 30000);
    return () => clearInterval(interval);
  }, [isAdmin, loadData]);

  const filteredLogs = useMemo(() => filterAuditLogs(auditLogs, statusFilter), [auditLogs, statusFilter]);
  const statuses = useMemo(() => [...new Set(['SUCCESS', 'DENIED', 'FAILED', ...auditLogs.map((log) => log.status).filter(Boolean)])].sort(), [auditLogs]);
  const adminCount = users.filter((person) => person.role === 'admin').length;

  async function handleRevoke(person) {
    if (!isAdmin || busyId !== null || person.id === verifiedUser?.id || (person.role === 'admin' && adminCount <= 1)) return;
    const confirmed = window.confirm(`Revoke ${person.name} (${person.email}, ID ${person.id})? This removes this account's access and all its sessions. Assignments and audit records are retained.`);
    if (!confirmed) return;
    setBusyId(person.id);
    setNotice('');
    setError('');
    try {
      const result = await requestJson(`${API_BASE}/api/auth/users/${person.id}`, token, { method: 'DELETE' });
      setNotice(`Access revoked for user ID ${result.revoked_user_id}; ${result.sessions_revoked} session${result.sessions_revoked === 1 ? '' : 's'} revoked.`);
      await loadData(false);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) return <div role="alert" style={{ ...card, padding: 20, fontFamily: 'var(--font-family)', color: ink }}>Admin access is required. This page is read-only for other roles.</div>;

  const cards = [
    { label: 'Active sessions', value: metrics?.active_sessions, note: metrics?.active_sessions_note, icon: Users },
    { label: 'Simulator instances', value: metrics?.simulator_instances, note: 'Loaded in this server process', icon: Activity },
    { label: `Alerts today${metrics?.alert_day ? ` · ${metrics.alert_day}` : ''}`, value: metrics?.alerts_today, note: `${metrics?.alerts_today_note || 'Recorded alert events'} · ${metrics?.alert_timezone || 'Asia/Kolkata'}`, icon: AlertTriangle },
    { label: 'PDF reports exported', value: metrics?.pdf_reports_exported, note: metrics?.pdf_reports_note, icon: FileText },
  ];

  return <main style={{ fontFamily: 'var(--font-family, sans-serif)', color: ink, textTransform: 'none', fontVariantNumeric: 'tabular-nums', display: 'grid', gap: 16 }}>
    <section aria-labelledby="admin-panel-title" style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '16px 18px' }}><div><h1 id="admin-panel-title" style={{ margin: 0, color: ink, fontSize: 23 }}>Admin panel</h1><p style={{ margin: '4px 0 0', color: muted, fontSize: 13 }}>Accounts, recorded access events, and server metrics</p></div><button type="button" onClick={() => loadData(true)} disabled={loading} style={{ ...button, display: 'inline-flex', alignItems: 'center', gap: 7, marginLeft: 'auto' }}><RefreshCw size={15} /> Refresh</button></section>
    {loading && !hasLoaded && <p role="status" style={{ ...card, margin: 0, padding: 16, color: muted }}>Loading admin data…</p>}
    {error && <div role="alert" style={{ ...card, display: 'flex', alignItems: 'center', gap: 9, padding: 14, color: '#9B4242' }}><AlertCircle size={17} />{error}<button type="button" onClick={() => loadData(true)} style={{ ...button, marginLeft: 'auto' }}>Retry</button></div>}
    {metrics?.audit_history_complete === false && <p role="alert" style={{ ...card, margin: 0, padding: 14, color: '#9B4242' }}>Recorded audit history is incomplete. Historical counts and last-login times may be unavailable.</p>}
    {notice && <p role="status" style={{ ...card, margin: 0, padding: 14, color: teal }}>{notice}</p>}
    {hasLoaded && <>
      <section aria-label="Admin metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>{cards.map((metric) => { const Icon = metric.icon; return <div key={metric.label} style={{ ...card, padding: 16, display: 'flex', justifyContent: 'space-between', gap: 10 }}><div><div style={{ color: muted, fontSize: 13 }}>{metric.label}</div><div style={{ marginTop: 8, color: ink, fontSize: metric.value == null ? 18 : 26, fontWeight: 700 }}>{metric.value ?? 'Unavailable'}</div><div style={{ marginTop: 5, color: muted, fontSize: 12 }}>{metric.note || 'Recorded backend data'}</div></div><Icon size={18} color={teal} /></div>; })}</section>
      <section style={{ ...card, overflow: 'hidden' }}><div style={{ padding: '17px 18px', borderBottom: `1px solid ${border}` }}><h2 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Users size={17} color={teal} /> User access</h2><p style={{ margin: '5px 0 0', color: muted, fontSize: 13 }}>Revocation removes one account and its sessions. It does not remove assignments or audit records.</p></div><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 850, fontSize: 13 }}><thead><tr>{['User', 'Email', 'Role', 'Organization', 'Last login', 'Action'].map((heading) => <th key={heading} style={{ ...cell, color: muted, fontWeight: 600 }}>{heading}</th>)}</tr></thead><tbody>{users.map((person) => { const self = person.id === verifiedUser?.id; const lastAdmin = person.role === 'admin' && adminCount <= 1; return <tr key={person.id}><td style={cell}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}><span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 31, height: 31, borderRadius: 6, background: '#EAF4F0', color: teal, fontWeight: 700, fontSize: 12 }}>{initials(person.name)}</span><span><strong>{person.name}</strong>{self && <span style={{ color: muted }}> · You</span>}<small style={{ display: 'block', color: muted }}>ID {person.id}</small></span></span></td><td style={cell}>{person.email}</td><td style={cell}><Pill value={person.role} tones={roleTones} /></td><td style={cell}>{person.org || 'Unavailable'}</td><td style={cell}>{timestamp(person.last_login)}</td><td style={cell}><button type="button" disabled={self || lastAdmin || busyId !== null} title={self ? 'You cannot revoke your own account' : lastAdmin ? 'The last admin cannot be revoked' : undefined} onClick={() => handleRevoke(person)} style={{ ...button, color: '#9B4242', opacity: self || lastAdmin || busyId !== null ? 0.5 : 1 }}>{busyId === person.id ? 'Revoking…' : 'Revoke access'}</button></td></tr>; })}</tbody></table>{users.length === 0 && <p style={{ margin: 0, padding: 20, color: muted }}>No users available.</p>}</div></section>
      <section style={{ ...card, overflow: 'hidden' }}><div style={{ padding: '17px 18px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}><div><h2 style={{ margin: 0, fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><Shield size={17} color={teal} /> Audit log</h2><p style={{ margin: '5px 0 0', color: muted, fontSize: 13 }}>Latest 100 recorded events; simulated events are excluded. Times shown in Asia/Kolkata.</p></div><label style={{ display: 'flex', alignItems: 'center', gap: 8, color: muted, fontSize: 13 }}>Filter status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ ...button, minWidth: 125 }}><option value="ALL">All events</option>{statuses.map((status) => <option key={status} value={status}>{readable(status)}</option>)}</select></label></div><div style={{ overflowX: 'auto' }}><table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820, fontSize: 13 }}><thead><tr>{['Time', 'User', 'Role', 'Action', 'Target', 'Status'].map((heading) => <th key={heading} style={{ ...cell, color: muted, fontWeight: 600 }}>{heading}</th>)}</tr></thead><tbody>{filteredLogs.map((log) => <tr key={log.id}><td style={cell}>{timestamp(log.timestamp)}</td><td style={cell}>{log.user_email || 'Unavailable'}</td><td style={cell}><Pill value={log.user_role} tones={roleTones} /></td><td style={cell} title={log.action}>{actionLabels[log.action] || readable(log.action)}</td><td style={cell}>{log.target || 'Unavailable'}</td><td style={cell}><Pill value={log.status} tones={statusTones} /></td></tr>)}</tbody></table>{filteredLogs.length === 0 && <p style={{ margin: 0, padding: 20, color: muted }}>{auditLogs.length ? 'No events match this filter.' : 'No recorded audit events yet.'}</p>}</div></section>
    </>}
  </main>;
}
