import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bot, MapPin, AlertTriangle, X, Send, Camera, CheckCircle2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MAX_HISTORY_MESSAGES = 10;

const renderMarkdown = (text) => {
  if (!text) return '';

  const redBadge = '<span style="background: #FDF2F2; color: #1C1F26; border: 1px solid #FECACA; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 6px; display: inline-block;">Critical</span>';
  const yellowBadge = '<span style="background: #FFFBEB; color: #1C1F26; border: 1px solid #FEF3C7; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 6px; display: inline-block;">Monitor</span>';
  const greenBadge = '<span style="background: #F0FDF4; color: #1C1F26; border: 1px solid #DCFCE7; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-left: 6px; display: inline-block;">Healthy</span>';

  let formatted = text
    .replace(/(severity(?:\s+assessment)?(?:\s+is)?(?:\s+rated\s+as)?(?:\s+level)?:?\s*)(severe\/critical|severe|critical|moderate|minor\/low|minor|low)/gi, (match, p1, p2) => {
      const val = p2.toLowerCase();
      let badge = '';
      if (val.includes('severe') || val.includes('critical')) {
        badge = redBadge;
      } else if (val.includes('moderate')) {
        badge = yellowBadge;
      } else if (val.includes('minor') || val.includes('low')) {
        badge = greenBadge;
      }
      return `${p1}${p2} ${badge}`;
    })
    .replace(/(DAMAGE TYPE|SEVERITY|RECOMMENDATIONS|ESTIMATED WIDTH|IRC REFERENCE|IMMEDIATE ACTION|MONITORING):?/gi, (match) => {
      const title = match.replace(':', '').trim();
      const sentenceTitle = title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
      return `<div style="font-weight: 600; margin-top: 10px; margin-bottom: 3px; color: #1C1F26;">${sentenceTitle}</div>`;
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^[-*•]\s+(.*?)$/gm, '<li style="margin-left: 16px; list-style-type: disc; margin-bottom: 4px;">$1</li>')
    .replace(/^[-*•]\s+/gm, '<li>')
    .replace(/^\d+\.\s*(.*?)$/gm, '<li style="margin-left: 16px; list-style-type: decimal; margin-bottom: 4px;">$1</li>')
    .replace(/^\d+\. /gm, '<li>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');

  return formatted;
};

export default function ChatPanel({ bridgeId = 1, bridgeName = 'Selected Bridge', isOpen: propIsOpen, setIsOpen: propSetIsOpen, onNewProactiveAlert, onClearProactiveAlerts }) {
  console.log('[ChatPanel] mounting...');
  const [localIsOpen, setLocalIsOpen] = useState(false);
  const isOpen = propIsOpen !== undefined ? propIsOpen : localIsOpen;
  const setIsOpen = propSetIsOpen !== undefined ? propSetIsOpen : setLocalIsOpen;

  const { user } = useAuth();
  const [alertedBridges, setAlertedBridges] = useState(new Set());
  const [pendingAction, setPendingAction] = useState(null); // stores { bridge_id, bridge_name }

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [liveInfo, setLiveInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Vision states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/chat/model-info`)
      .then((response) => response.json())
      .then((data) => setModelInfo(data))
      .catch(() => setModelInfo(null));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadLive() {
      try {
        const res = await fetch(`${API_BASE}/api/live?bridge_id=${bridgeId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('bridgeiq_token')}`
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setLiveInfo(data);
        }
      } catch (err) {
        console.error('[ChatPanel live poller error]', err);
      }
    }
    loadLive();
    const id = setInterval(loadLive, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [bridgeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && typeof onClearProactiveAlerts === 'function') {
      onClearProactiveAlerts();
    }
  }, [isOpen, onClearProactiveAlerts]);

  // Proactive Alerts Polling
  useEffect(() => {
    async function checkProactiveAlerts() {
      const token = localStorage.getItem('bridgeiq_token');
      if (!token) return;

      try {
        const res = await fetch(`${API_BASE}/api/chat/critical-alerts`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!res.ok) return;
        const data = await res.json();
        const criticalBridges = data.critical_bridges || [];

        // Find the first critical bridge that hasn't been alerted yet
        const nextAlertBridge = criticalBridges.find(b => !alertedBridges.has(b.bridge_id));

        if (nextAlertBridge) {
          // Add to alerted set
          setAlertedBridges(prev => {
            const next = new Set(prev);
            next.add(nextAlertBridge.bridge_id);
            return next;
          });

          // Inject AI proactive message
          const userName = user?.name || 'Engineer';
          const healthVal = (nextAlertBridge.health_score !== null && nextAlertBridge.health_score !== undefined) ? Number(nextAlertBridge.health_score).toFixed(1) : '0.0';
          const vibrationVal = (nextAlertBridge.vibration !== null && nextAlertBridge.vibration !== undefined) ? nextAlertBridge.vibration : '0';
          const alertMessage = {
            role: 'assistant',
            isProactive: true,
            content: `${userName}, ${nextAlertBridge.bridge_name} has crossed the critical threshold. Health: ${healthVal}/100, Vibration: ${vibrationVal}g.\n\nRecommended protocol:\n• Run full AI inspection\n• Assign nearest available crew\n• Send dispatch alert`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          setMessages(prev => [...prev, alertMessage].slice(-MAX_HISTORY_MESSAGES));

          // Set as pending action
          setPendingAction({
            bridge_id: nextAlertBridge.bridge_id,
            bridge_name: nextAlertBridge.bridge_name
          });

          // Increment unread count in parent if chat is closed
          if (!isOpen && typeof onNewProactiveAlert === 'function') {
            onNewProactiveAlert();
          }
        }
      } catch (err) {
        console.error('[ChatPanel proactive alerts error]', err);
      }
    }

    checkProactiveAlerts();
    const intervalId = setInterval(checkProactiveAlerts, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [alertedBridges, isOpen, user, onNewProactiveAlert]);

  // Reset alertedBridges on unmount
  useEffect(() => {
    return () => {
      setAlertedBridges(new Set());
    };
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be under 10MB');
      return;
    }
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleAlertResponse = async (choice) => {
    if (!pendingAction) return;
    const token = localStorage.getItem('bridgeiq_token');
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bridge_id = pendingAction.bridge_id;
    const bridge_name = pendingAction.bridge_name;

    if (choice === 'yes') {
      // Append user confirmation message
      const userMsg = {
        role: 'user',
        content: 'Proceeding with inspection, crew assignment and alert dispatch...',
        timestamp: timestampStr
      };
      setMessages((prev) => [...prev, userMsg].slice(-MAX_HISTORY_MESSAGES));
      setPendingAction(null);
      setIsLoading(true);

      // Show "Running autonomous actions..."
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Running autonomous actions...',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ].slice(-MAX_HISTORY_MESSAGES));

      // Step 1: AI Inspection
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Step 1/3: Running AI inspection...',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));
      }, 1000);

      // Step 2: Assign Crew
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Step 2/3: Assigning nearest crew...',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));
      }, 2000);

      // Step 3: Send Alert
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Step 3/3: Dispatching notification alert...',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));
      }, 3000);

      // Make API Call
      const startTime = Date.now();
      let apiSummary = null;
      let apiError = null;

      try {
        const response = await fetch(`${API_BASE}/api/chat/autonomous-action`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            bridge_id: bridge_id,
            bridge_name: bridge_name,
            confirmed: true
          })
        });

        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        apiSummary = data.summary;
      } catch (error) {
        apiError = error.message;
      }

      const elapsed = Date.now() - startTime;
      const remainingDelay = Math.max(0, 4000 - elapsed);

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: apiSummary || (apiError ? `Error running autonomous actions: ${apiError}` : `All actions completed for ${bridge_name}.`),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));
        setIsLoading(false);
      }, remainingDelay);

    } else {
      // User said no / Dismissed
      setPendingAction(null);
      // Append user message "Alert dismissed."
      const userMsg = {
        role: 'user',
        content: 'Alert dismissed.',
        timestamp: timestampStr
      };
      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          role: 'assistant',
          content: "Understood. Monitoring continues. You can manually inspect from AI Inspector tab.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ].slice(-MAX_HISTORY_MESSAGES));
    }
  };

  const conversationHistory = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, content }) => ({ role, content }));

  async function sendMessage() {
    const userMessage = inputValue.trim();
    if (!userMessage && !selectedImage) return;
    if (isLoading) return;

    const token = localStorage.getItem('bridgeiq_token');
    const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to chat history
    const userMsg = { 
      role: 'user', 
      content: userMessage || 'Analyze this image',
      image: imagePreview,
      timestamp: timestampStr
    };

    setMessages((prev) => [...prev, userMsg].slice(-MAX_HISTORY_MESSAGES));
    setInputValue('');
    setIsLoading(true);

    const isYes = /^(yes|yeah|haan|kar do|proceed|confirm|ok|okay)$/i.test(userMessage.trim());
    const isNo = /^(no|nahi|nope|cancel|dismiss)$/i.test(userMessage.trim());

    if (pendingAction && (isYes || isNo)) {
      if (isYes) {
        const bridge_id = pendingAction.bridge_id;
        const bridge_name = pendingAction.bridge_name;
        setPendingAction(null);

        // Show "Running autonomous actions..."
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Running autonomous actions...',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));

        // Step 1: AI Inspection
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Step 1/3: Running AI inspection...',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ].slice(-MAX_HISTORY_MESSAGES));
        }, 1000);

        // Step 2: Assign Crew
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Step 2/3: Assigning nearest crew...',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ].slice(-MAX_HISTORY_MESSAGES));
        }, 2000);

        // Step 3: Send Alert
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: 'Step 3/3: Dispatching notification alert...',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ].slice(-MAX_HISTORY_MESSAGES));
        }, 3000);

        // Make API Call
        const startTime = Date.now();
        let apiSummary = null;
        let apiError = null;

        try {
          const response = await fetch(`${API_BASE}/api/chat/autonomous-action`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              bridge_id: bridge_id,
              bridge_name: bridge_name,
              confirmed: true
            })
          });

          if (!response.ok) throw new Error(`API returned ${response.status}`);
          const data = await response.json();
          apiSummary = data.summary;
        } catch (error) {
          apiError = error.message;
        }

        const elapsed = Date.now() - startTime;
        const remainingDelay = Math.max(0, 4000 - elapsed);

        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: apiSummary || (apiError ? `Error running autonomous actions: ${apiError}` : `All actions completed for ${bridge_name}.`),
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ].slice(-MAX_HISTORY_MESSAGES));
          setIsLoading(false);
        }, remainingDelay);

      } else {
        // User said no
        setPendingAction(null);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "Understood. Monitoring continues. You can manually inspect from AI Inspector tab.",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ].slice(-MAX_HISTORY_MESSAGES));
        setIsLoading(false);
      }
      return;
    }

    try {
      let reply;

      if (selectedImage) {
        // Vision API call
        const formData = new FormData();
        formData.append('bridge_id', bridgeId);
        formData.append('message', userMessage || 'Analyze this bridge image and identify any structural issues');
        formData.append('image', selectedImage);

        const response = await fetch(`${API_BASE}/api/chat/vision`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}` 
          },
          body: formData
        });

        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        reply = data.reply;

        // Clear image after sending
        setSelectedImage(null);
        setImagePreview(null);
      } else {
        // Regular text chat
        const response = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            bridge_id: bridgeId,
            message: userMessage,
            history: conversationHistory,
          }),
        });

        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        reply = data.reply;
      }

      setMessages((prev) =>
        [...prev, { 
          role: 'assistant', 
          content: reply || 'No reply.', 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }].slice(-MAX_HISTORY_MESSAGES)
      );
    } catch (error) {
      setMessages((prev) =>
        [...prev, { 
          role: 'assistant', 
          content: `Error: ${error.message}`, 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        }].slice(-MAX_HISTORY_MESSAGES)
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const healthScore = liveInfo?.health_score !== undefined ? liveInfo.health_score.toFixed(1) : '—';
  const rawHealth = liveInfo?.health_score;
  const alertLevel = rawHealth !== undefined && rawHealth !== null
    ? (rawHealth >= 75 ? 'Healthy' : (rawHealth >= 50 ? 'Monitor' : 'Critical'))
    : 'Healthy';

  return (
    <>
      <style>{`
        .typing-bubble {
          display: inline-flex;
          gap: 4px;
          align-items: center;
          background: #F8FAFA;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 8px 12px;
        }
        .typing-bubble span {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8B94A3;
          margin: 0 2px;
          animation: bounce 1.2s infinite;
        }
        .typing-bubble span:nth-child(2) { animation-delay: 0.2s; }
        .typing-bubble span:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      <div>
        {/* Open panel */}
        {isOpen && (
          <div style={{
            position: "fixed",
            top: 0,
            left: "64px",
            width: "410px",
            height: "100vh",
            background: "#FFFFFF",
            borderRight: "1px solid #E2E8F0",
            boxShadow: "none",
            display: "flex",
            flexDirection: "column",
            zIndex: 99,
            overflow: "hidden",
          }}>
            
            {/* Header */}
            <div style={{
              background: "#1C1F26",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #2A2E39",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "#282D37",
                  border: "1px solid #333945",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF"
                }}>
                  <Bot size={18} strokeWidth={1.8} />
                </div>
                <div>
                  <div style={{ color: "#FFFFFF", fontWeight: "600", fontSize: "13px" }}>Bridge assistant</div>
                  <div style={{ color: "#8B94A3", fontSize: "11px" }}>{selectedImage ? 'Vision AI model' : 'SHM telemetry agent'}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#0F6E56" }} />
                <span style={{ color: "#0F6E56", fontSize: "11px", fontWeight: "500" }}>Connected</span>
                <button 
                  onClick={() => setIsOpen(false)} 
                  style={{ 
                    background: "none", 
                    border: "none", 
                    color: "#8B94A3", 
                    cursor: "pointer", 
                    padding: "4px", 
                    marginLeft: "8px",
                    display: "flex",
                    alignItems: "center"
                  }}
                  title="Close assistant"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Context Bar */}
            <div style={{
              background: '#F8FAFA',
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '6px 12px',
              margin: '12px 16px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MapPin size={13} color="#0F6E56" />
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: '500' }}>
                {bridgeName} · Health: {healthScore} · {alertLevel}
              </span>
            </div>

            {/* Messages Area */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              background: "#FFFFFF",
            }}>
              {messages.length === 0 ? (
                <div style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: '#8B94A3',
                  fontSize: '12px',
                  lineHeight: '1.6',
                  padding: '0 24px'
                }}>
                  Query bridge telemetry, vibration spikes, strain levels, active alerts, or upload crack imagery.
                </div>
              ) : (
                messages.map((m, i) => {
                  const msgTime = m.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  if (m.role === 'user') {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }} key={i}>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%', alignItems: 'flex-end' }}>
                          <div style={{
                            background: '#1C1F26',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            border: '1px solid #2A2E39'
                          }}>
                            {m.image && (
                              <img
                                src={m.image}
                                alt="Uploaded crack"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '140px',
                                  borderRadius: '4px',
                                  marginBottom: '6px',
                                  display: 'block'
                                }}
                              />
                            )}
                            <div style={{ fontSize: '13px', color: '#FFFFFF', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                               {m.content}
                            </div>
                          </div>
                          <span style={{ fontSize: '10px', color: '#8B94A3', marginTop: '3px' }}>
                            {msgTime}
                          </span>
                        </div>
                      </div>
                    );
                  } else {
                    const isProactive = m.isProactive;
                    const containerStyle = {
                      display: 'flex',
                      gap: '8px',
                      marginBottom: '8px',
                      alignItems: 'flex-start'
                    };
                    const iconStyle = {
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      background: isProactive ? '#FDF2F2' : '#F1F5F9',
                      border: isProactive ? '1px solid #FECACA' : '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    };
                    const bubbleStyle = isProactive ? {
                      background: '#FDF2F2',
                      border: '1px solid #FECACA',
                      borderLeft: '3px solid #991B1B',
                      borderRadius: '6px',
                      padding: '10px 12px',
                    } : {
                      background: '#F8FAFA',
                      border: '1px solid #E2E8F0',
                      borderRadius: '6px',
                      padding: '8px 12px'
                    };

                    return (
                      <div style={containerStyle} key={i}>
                        <div style={iconStyle}>
                          {isProactive ? (
                            <AlertTriangle size={13} color="#991B1B" />
                          ) : (
                            <Bot size={13} color="#1C1F26" />
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '82%' }}>
                          <div style={bubbleStyle}>
                            {m.image && (
                              <img
                                src={m.image}
                                alt="Inspection attachment"
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '140px',
                                  borderRadius: '4px',
                                  marginBottom: '6px',
                                  display: 'block'
                                }}
                              />
                            )}
                            <div 
                              style={{ fontSize: '13px', color: '#1C1F26', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                            />
                            {m.isProactive && pendingAction && i === messages.length - 1 && (
                              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button 
                                  onClick={() => handleAlertResponse('yes')}
                                  style={{ 
                                    background: '#1C1F26', 
                                    color: 'white', 
                                    border: 'none', 
                                    borderRadius: '6px', 
                                    padding: '5px 12px', 
                                    cursor: 'pointer',
                                    fontSize: '12px', 
                                    fontWeight: '500'
                                  }}
                                >
                                  Yes, proceed
                                </button>
                                <button 
                                  onClick={() => handleAlertResponse('no')}
                                  style={{ 
                                    background: 'transparent', 
                                    color: '#475569',
                                    border: '1px solid #CBD5E1', 
                                    borderRadius: '6px', 
                                    padding: '5px 12px', 
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                  }}
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '10px', color: '#8B94A3', marginTop: '3px' }}>
                            {msgTime}
                          </span>
                        </div>
                      </div>
                    );
                  }
                })
              )}

              {isLoading && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    background: '#F1F5F9',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Bot size={13} color="#1C1F26" />
                  </div>
                  <div className="typing-bubble">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid #E2E8F0",
              background: "#FFFFFF",
              display: "flex",
              flexDirection: "column",
            }}>
              {/* Image Preview Container */}
              {imagePreview && (
                <div style={{
                  position: 'relative',
                  marginBottom: '8px',
                  display: 'inline-block',
                  alignSelf: 'flex-start'
                }}>
                  <img
                    src={imagePreview}
                    alt="Selected attachment"
                    style={{
                      maxHeight: '70px',
                      maxWidth: '110px',
                      borderRadius: '4px',
                      border: '1px solid #CBD5E1'
                    }}
                  />
                  <button
                    onClick={() => { setSelectedImage(null); setImagePreview(null) }}
                    type="button"
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-6px',
                      background: '#1C1F26',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >×</button>
                </div>
              )}

              {/* Photo Upload Row */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <label style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "4px 10px",
                  background: "#F8FAFA",
                  border: "1px solid #E2E8F0",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "11px",
                  color: "#475569",
                  fontWeight: "500",
                }}>
                  <Camera size={13} />
                  Upload photo
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageSelect} disabled={isLoading} />
                </label>
                <span style={{ fontSize: "11px", color: "#8B94A3", alignSelf: "center" }}>
                  Analyze surface cracks with vision AI
                </span>
              </div>

              {/* Text Input Row */}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about sensors, alerts, risk scores..."
                  rows={1}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    border: "1px solid #E2E8F0",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    maxHeight: "72px",
                    background: "#FFFFFF",
                    color: "#1C1F26",
                  }}
                />
                <button
                  disabled={isLoading || (!inputValue.trim() && !selectedImage)}
                  onClick={sendMessage}
                  aria-label="Send message"
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "6px",
                    background: "#1C1F26",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    opacity: (isLoading || (!inputValue.trim() && !selectedImage)) ? 0.4 : 1,
                    transition: "background-color 0.15s ease"
                  }}
                >
                  <Send size={15} color="white" />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
