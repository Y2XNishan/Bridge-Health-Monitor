import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, Bot, Camera, MapPin, Send, X } from 'lucide-react';
import { useAuth } from '../context/authContext';
import { alertFingerprint, dispatchMessage, formatNetworkAlert, markdownBlocks } from './chatPanelUtils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ink = '#1C1F26';
const teal = '#0F6E56';
const muted = '#65717B';
const border = '#DDE3E5';
const MAX_HISTORY_MESSAGES = 40;
const button = { font: 'inherit', fontSize: 12, fontWeight: 600, border: `1px solid ${border}`, borderRadius: 6, padding: '7px 10px', background: '#fff', color: ink, cursor: 'pointer' };
const primaryButton = { ...button, background: teal, borderColor: teal, color: '#fff' };
const markdownComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>,
  strong: ({ children }) => <strong style={{ fontWeight: 650 }}>{children}</strong>,
  ul: ({ children }) => <ul style={{ margin: '4px 0 9px', paddingLeft: 19 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '4px 0 9px', paddingLeft: 19 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 3 }}>{children}</li>,
  h1: ({ children }) => <h3 style={{ fontSize: 14, margin: '4px 0 8px' }}>{children}</h3>,
  h2: ({ children }) => <h3 style={{ fontSize: 14, margin: '4px 0 8px' }}>{children}</h3>,
};

function ChatMarkdown({ content }) {
  return markdownBlocks(content).map((block, index) => block.type === 'table' ?
    <div key={index} style={{ maxWidth: '100%', overflowX: 'auto', margin: '7px 0' }}><table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
      <thead><tr>{block.headers.map((cell, cellIndex) => <th key={cellIndex} scope="col" style={{ textAlign: 'left', padding: 5, border: `1px solid ${border}` }}><ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{cell}</ReactMarkdown></th>)}</tr></thead>
      <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{block.headers.map((_, cellIndex) => <td key={cellIndex} style={{ padding: 5, border: `1px solid ${border}` }}><ReactMarkdown components={{ p: ({ children }) => <>{children}</> }}>{row[cellIndex] || ''}</ReactMarkdown></td>)}</tr>)}</tbody>
    </table></div>
    : <ReactMarkdown key={index} components={markdownComponents}>{block.content}</ReactMarkdown>);
}

function newMessage(fields) {
  return { id: crypto.randomUUID(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...fields };
}

async function readError(response) {
  const body = await response.json().catch(() => null);
  return new Error(typeof body?.detail === 'string' ? body.detail : `Request failed (${response.status}).`);
}

export default function ChatPanel({ bridgeId = 1, bridgeName = 'Selected bridge', liveData, liveBridgeId, connectionStatus, isOpen: controlledOpen, setIsOpen: setControlledOpen, onNewProactiveAlert, onClearProactiveAlerts, onOpenInspection, onReviewAssignment }) {
  const { token, user } = useAuth();
  const [localOpen, setLocalOpen] = useState(false);
  const isOpen = controlledOpen ?? localOpen;
  const setIsOpen = setControlledOpen ?? setLocalOpen;
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [dispatchDraft, setDispatchDraft] = useState(null);
  const [dispatchError, setDispatchError] = useState('');
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const seenAlerts = useRef(new Map());
  const sendLock = useRef(false);
  const dispatchLock = useRef(false);
  const previewLock = useRef(false);
  const lastNavigation = useRef('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentLive = Number(liveBridgeId) === Number(bridgeId) ? liveData : null;
  const connection = !token || connectionStatus === 'error' ? 'Disconnected' : currentLive ? 'Connected' : 'Connecting';
  const canInspect = user?.role === 'admin' || user?.role === 'engineer';
  const canAssignAndDispatch = user?.role === 'admin';

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function pollAlerts() {
      try {
        const response = await fetch(`${API_BASE}/api/chat/critical-alerts`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Network alerts unavailable');
        const data = await response.json();
        if (!active) return;
        const current = new Map();
        const fresh = [];
        for (const alert of data.critical_bridges || []) {
          const fingerprint = alertFingerprint(alert);
          current.set(alert.bridge_id, fingerprint);
          if (seenAlerts.current.get(alert.bridge_id) !== fingerprint) {
            fresh.push(newMessage({ role: 'assistant', kind: 'network-alert', alert, content: formatNetworkAlert(alert, bridgeId, bridgeName) }));
          }
        }
        seenAlerts.current = current;
        if (fresh.length) {
          setMessages((previous) => [...previous, ...fresh].slice(-MAX_HISTORY_MESSAGES));
          if (!isOpen) fresh.forEach(() => onNewProactiveAlert?.());
        }
        setAlertError(data.evaluation_errors ? `${data.evaluation_errors} bridge alert reading${data.evaluation_errors === 1 ? '' : 's'} could not be evaluated.` : '');
      } catch {
        if (active) setAlertError('Network alerts are unavailable; retrying.');
      }
    }
    pollAlerts();
    const interval = setInterval(pollAlerts, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [token, bridgeId, bridgeName, isOpen, onNewProactiveAlert]);

  useEffect(() => { if (isOpen) onClearProactiveAlerts?.(); }, [isOpen, onClearProactiveAlerts]);
  useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ block: 'end' }); }, [messages, isLoading, isOpen]);

  function addFeedback(content) {
    setMessages((previous) => [...previous, newMessage({ role: 'assistant', kind: 'feedback', content })].slice(-MAX_HISTORY_MESSAGES));
  }

  function selectImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      addFeedback('Choose an image under 10 MB.');
      event.target.value = '';
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function sendMessage() {
    const message = inputValue.trim();
    if ((!message && !selectedImage) || sendLock.current || !token) return;
    sendLock.current = true;
    setIsLoading(true);
    const image = selectedImage;
    const chatHistory = messages.filter((item) => item.kind === 'chat').slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((previous) => [...previous, newMessage({ role: 'user', kind: 'chat', content: message || 'Analyze this photo', image: imagePreview, contextBridge: bridgeName })].slice(-MAX_HISTORY_MESSAGES));
    setInputValue('');
    try {
      let response;
      if (image) {
        const form = new FormData();
        form.append('bridge_id', String(bridgeId));
        form.append('message', message || 'Assess this photo for cracks');
        form.append('image', image);
        response = await fetch(`${API_BASE}/api/chat/vision`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      } else {
        response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ bridge_id: bridgeId, message, history: chatHistory }),
        });
      }
      if (!response.ok) throw await readError(response);
      const result = await response.json();
      setMessages((previous) => [...previous, newMessage({ role: 'assistant', kind: 'chat', content: result.reply || 'Assistant response unavailable.', contextBridge: bridgeName })].slice(-MAX_HISTORY_MESSAGES));
      if (image) clearImage();
    } catch (error) {
      addFeedback(`Request failed: ${error.message}`);
    } finally {
      sendLock.current = false;
      setIsLoading(false);
    }
  }

  function openInspection(alert) {
    if (!canInspect) return;
    const key = `inspection:${alert.bridge_id}`;
    if (lastNavigation.current === key) return;
    lastNavigation.current = key;
    setTimeout(() => { if (lastNavigation.current === key) lastNavigation.current = ''; }, 750);
    onOpenInspection?.(alert);
    addFeedback(`Opened AI inspector for ${alert.bridge_name}. No inspection was run automatically.`);
  }

  function reviewAssignment(alert) {
    if (!canAssignAndDispatch) return;
    const key = `assignment:${alert.bridge_id}`;
    if (lastNavigation.current === key) return;
    lastNavigation.current = key;
    setTimeout(() => { if (lastNavigation.current === key) lastNavigation.current = ''; }, 750);
    onReviewAssignment?.(alert);
    addFeedback(`Opened a prefilled assignment form for ${alert.bridge_name}. Review and save it there.`);
  }

  async function prepareDispatch(alert) {
    if (!canAssignAndDispatch || previewLock.current || !token) return;
    previewLock.current = true;
    setPreviewBusy(true);
    setDispatchError('');
    try {
      const response = await fetch(`${API_BASE}/api/chat/dispatch-preview`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw await readError(response);
      const result = await response.json();
      if (!result.available || !result.recipient) throw new Error('Dispatch recipient is not configured.');
      setDispatchDraft({ alert, recipient: result.recipient, message: dispatchMessage(alert), confirmed: false, requestId: crypto.randomUUID() });
    } catch (error) {
      setDispatchError(error.message);
    } finally {
      previewLock.current = false;
      setPreviewBusy(false);
    }
  }

  async function sendDispatch(event) {
    event.preventDefault();
    if (!canAssignAndDispatch || !dispatchDraft?.confirmed || dispatchLock.current || !token) return;
    dispatchLock.current = true;
    setDispatchBusy(true);
    setDispatchError('');
    try {
      const response = await fetch(`${API_BASE}/api/chat/dispatch`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridge_id: dispatchDraft.alert.bridge_id, recipient: dispatchDraft.recipient, message: dispatchDraft.message, confirmed: true, request_id: dispatchDraft.requestId }),
      });
      if (!response.ok) throw await readError(response);
      const result = await response.json();
      addFeedback(result.status === 'already_sent'
        ? `This dispatch to ${result.recipient} was already confirmed; no second notification was sent.`
        : `Dispatch provider confirmed a notification to ${result.recipient} for ${result.bridge_name}.`);
      setDispatchDraft(null);
    } catch (error) {
      setDispatchError(error.message);
    } finally {
      dispatchLock.current = false;
      setDispatchBusy(false);
    }
  }

  if (!isOpen) return null;

  return <aside aria-label="Bridge assistant" style={{ position: 'fixed', top: 0, left: 64, width: 'min(410px, calc(100vw - 64px))', height: '100dvh', zIndex: 99, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: '#fff', borderRight: `1px solid ${border}`, color: ink, fontFamily: 'var(--font-family, sans-serif)', textTransform: 'none' }}>
    <div style={{ flexShrink: 0, background: ink, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottom: '1px solid #2A2E39' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}><Bot size={21} color="#fff" /><div><div style={{ color: '#fff', fontSize: 14, fontWeight: 650 }}>Bridge assistant</div><div style={{ color: '#B8C0CB', fontSize: 11 }}>Bridge telemetry and photo review</div></div></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}><span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: connection === 'Connected' ? '#69C6A1' : connection === 'Disconnected' ? '#E6A4A4' : '#B8C0CB' }} /><span role="status" style={{ color: connection === 'Connected' ? '#C6EBDD' : connection === 'Disconnected' ? '#F2C6C6' : '#CFD5DE', fontSize: 11, fontWeight: 600 }}>{connection}</span><button type="button" aria-label="Close assistant" onClick={() => setIsOpen(false)} style={{ border: 0, background: 'transparent', color: '#CFD5DE', display: 'flex', cursor: 'pointer', padding: 4 }}><X size={17} /></button></div>
    </div>

    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7, margin: '10px 14px', padding: '9px 11px', background: '#F8FAFA', border: `1px solid ${border}`, borderRadius: 6, color: muted, fontSize: 11 }}><MapPin size={14} color={teal} aria-hidden="true" /><span><strong style={{ color: ink }}>Selected bridge:</strong> {bridgeName} · Health {currentLive?.health_score == null ? 'unavailable' : `${Number(currentLive.health_score).toFixed(1)}/100`} · {currentLive?.condition || 'Condition unavailable'}</span></div>
    {alertError && <p role="status" style={{ margin: '0 14px 8px', color: '#9B4242', fontSize: 11 }}>{alertError}</p>}

    <div aria-label="Assistant messages" style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {messages.length === 0 && <p style={{ margin: 'auto 14px', textAlign: 'center', color: muted, fontSize: 12, lineHeight: 1.6 }}>Ask about the selected bridge’s readings, or upload a photo for a model-estimated crack assessment. Network alerts are labelled separately.</p>}
      {messages.map((item) => <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
        {item.role !== 'user' && <span aria-hidden="true" style={{ flexShrink: 0, width: 23, height: 23, display: 'grid', placeItems: 'center', borderRadius: 5, background: item.kind === 'network-alert' ? '#F9EEEE' : '#F3F5F5', color: item.kind === 'network-alert' ? '#9B4242' : ink }}>{item.kind === 'network-alert' ? <AlertTriangle size={13} /> : <Bot size={13} />}</span>}
        <div style={{ maxWidth: '85%', minWidth: 0 }}><div style={{ borderRadius: 6, border: `1px solid ${item.kind === 'network-alert' ? '#E8D4D4' : item.role === 'user' ? ink : border}`, background: item.kind === 'network-alert' ? '#FBF4F4' : item.role === 'user' ? ink : '#F8FAFA', color: item.role === 'user' ? '#fff' : ink, padding: '9px 11px', fontSize: 12, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
          {item.contextBridge && <div style={{ color: item.role === 'user' ? '#C8D2DC' : muted, fontSize: 10, marginBottom: 5 }}>Selected bridge · {item.contextBridge}</div>}
          {item.image && <img src={item.image} alt="Uploaded bridge photo" style={{ display: 'block', maxWidth: '100%', maxHeight: 150, objectFit: 'contain', marginBottom: 7 }} />}
          {item.role === 'user' ? <span style={{ whiteSpace: 'pre-wrap' }}>{item.content}</span> : <ChatMarkdown content={item.kind === 'network-alert' ? formatNetworkAlert(item.alert, bridgeId, bridgeName) : item.content} />}
          {item.kind === 'network-alert' && !dismissedAlerts.has(item.id) && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {canInspect && <button type="button" onClick={() => openInspection(item.alert)} style={primaryButton}>Open inspection</button>}
            {canAssignAndDispatch && <button type="button" onClick={() => reviewAssignment(item.alert)} style={button}>Review assignment</button>}
            {canAssignAndDispatch && <button type="button" onClick={() => prepareDispatch(item.alert)} disabled={previewBusy} style={{ ...button, opacity: previewBusy ? 0.6 : 1 }}>{previewBusy ? 'Loading recipient…' : 'Prepare dispatch'}</button>}
            <button type="button" onClick={() => setDismissedAlerts((previous) => new Set(previous).add(item.id))} style={button}>Dismiss</button>
          </div>}
          {item.kind === 'network-alert' && !canInspect && <div style={{ marginTop: 7, color: muted, fontSize: 11 }}>Read-only access</div>}
        </div><div style={{ fontSize: 10, color: muted, marginTop: 3 }}>{item.timestamp}</div></div>
      </div>)}
      {isLoading && <div role="status" style={{ color: muted, fontSize: 11 }}>Assistant is responding…</div>}
      <div ref={messagesEndRef} />
    </div>

    {dispatchDraft && <form onSubmit={sendDispatch} style={{ flexShrink: 0, maxHeight: '45dvh', overflowY: 'auto', padding: '11px 14px', borderTop: `1px solid ${border}`, background: '#F8FAFA', fontSize: 12 }}>
      <div style={{ fontWeight: 650, marginBottom: 7 }}>Review dispatch for {dispatchDraft.alert.bridge_name}</div>
      <div style={{ marginBottom: 7 }}><strong>Recipient:</strong> {dispatchDraft.recipient}</div>
      <label htmlFor="chat-dispatch-message" style={{ display: 'block', marginBottom: 5, fontWeight: 600 }}>Message</label>
      <textarea id="chat-dispatch-message" value={dispatchDraft.message} onChange={(event) => setDispatchDraft((previous) => ({ ...previous, message: event.target.value, confirmed: false }))} maxLength={2000} rows={4} style={{ boxSizing: 'border-box', width: '100%', resize: 'vertical', font: 'inherit', padding: 8, color: ink, background: '#fff', border: `1px solid ${border}`, borderRadius: 5 }} />
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 7, margin: '8px 0' }}><input type="checkbox" checked={dispatchDraft.confirmed} onChange={(event) => setDispatchDraft((previous) => ({ ...previous, confirmed: event.target.checked }))} />I reviewed this recipient and message and authorize sending.</label>
      {dispatchError && <p role="alert" style={{ color: '#9B4242', margin: '5px 0' }}>{dispatchError}</p>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}><button type="button" disabled={dispatchBusy} onClick={() => setDispatchDraft(null)} style={button}>Cancel</button><button type="submit" disabled={dispatchBusy || !dispatchDraft.confirmed || !dispatchDraft.message.trim()} style={{ ...primaryButton, opacity: dispatchBusy || !dispatchDraft.confirmed || !dispatchDraft.message.trim() ? 0.55 : 1 }}>{dispatchBusy ? 'Sending…' : 'Confirm and send'}</button></div>
    </form>}
    {!dispatchDraft && dispatchError && <p role="alert" style={{ margin: '0 14px 8px', color: '#9B4242', fontSize: 11 }}>{dispatchError}</p>}

    <div style={{ flexShrink: 0, padding: '10px 14px 13px', borderTop: `1px solid ${border}`, background: '#fff' }}>
      {canInspect && <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, color: muted, fontSize: 11 }}><label style={{ ...button, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 8px' }}><Camera size={13} /> Upload photo<input ref={fileInputRef} type="file" accept="image/*" onChange={selectImage} disabled={isLoading} style={{ display: 'none' }} /></label><span>Model estimate; verify on site</span></div>}
      {selectedImage && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: muted, fontSize: 11 }}>{imagePreview && <img src={imagePreview} alt="Selected photo preview" style={{ maxWidth: 65, maxHeight: 55, objectFit: 'contain' }} />}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedImage.name}</span><button type="button" aria-label="Remove photo" onClick={clearImage} style={{ ...button, padding: 4 }}><X size={13} /></button></div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}><textarea ref={inputRef} value={inputValue} onChange={(event) => setInputValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Ask about the selected bridge…" rows={2} disabled={isLoading} style={{ flex: 1, minWidth: 0, maxHeight: 85, resize: 'vertical', font: 'inherit', fontSize: 12, color: ink, background: '#fff', padding: '8px 10px', border: `1px solid ${border}`, borderRadius: 6 }} /><button type="button" aria-label="Send message" onClick={sendMessage} disabled={isLoading || (!inputValue.trim() && !selectedImage)} style={{ ...primaryButton, display: 'grid', placeItems: 'center', height: 34, width: 36, padding: 0, opacity: isLoading || (!inputValue.trim() && !selectedImage) ? 0.55 : 1 }}><Send size={15} /></button></div>
    </div>
  </aside>;
}
