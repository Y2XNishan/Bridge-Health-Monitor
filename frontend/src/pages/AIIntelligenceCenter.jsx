import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SENSOR_THRESHOLDS } from '../constants/thresholds';
import StatusBadge, { formatHealthScore } from '../components/StatusBadge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Brain,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Activity,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  Wrench,
  Settings,
  Search,
  Sparkles,
  Shield,
  Radio
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS (AIOps Center)
   ═══════════════════════════════════════════════════════════════════════════ */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API = `${API_BASE}/api`;
const REFRESH_MS = 15000;
const BRIDGE_IDS = Array.from({ length: 58 }, (_, i) => i + 1);

const C = {
  bg:        '#F8FAFA',
  card:      '#ffffff',
  cardAlt:   '#F8FAFA',
  border:    '#E2E8F0',
  purple:    '#0F6E56',
  purpleDim: '#0F6E56',
  blue:      '#1C1F26',
  green:     '#0F6E56',
  yellow:    '#D97706',
  red:       '#991B1B',
  cyan:      '#0F6E56',
  text1:     '#1C1F26',
  text2:     '#475569',
  text3:     '#8B94A3',
  text4:     '#CBD5E1',
};

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS (AIOps Center)
   ═══════════════════════════════════════════════════════════════════════════ */
function headers() {
  const t = localStorage.getItem('bridgeiq_token') || '';
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}

async function api(path) {
  const r = await fetch(`${API}${path}`, { headers: headers() });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json();
}

function fmt(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */
function Skel({ h = 120, className = '' }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className}`}
      style={{ background: C.card, border: `1px solid ${C.border}`, height: h }}
    />
  );
}

function Pulse({ color = C.green, s = 8 }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: s, height: s }}>
      <span
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          animation: 'aio-ping 1.6s cubic-bezier(0,0,.2,1) infinite',
        }}
      />
      <span className="relative rounded-full" style={{ width: s, height: s, backgroundColor: color }} />
    </span>
  );
}

function Badge({ label, color, glow }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold"
      style={{
        background: 'var(--bg-secondary)',
        color: color || C.text2,
        border: '1px solid var(--border-subtle)',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color || C.text2 }} />
      {label}
    </span>
  );
}

function CircGauge({ pct, color, size = 72, stroke = 5, label, sub, badge }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={{ width: size, height: size, position: 'relative' }} className="flex items-center justify-center">
        <svg width={size} height={size} className="transform -rotate-90 absolute inset-0">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}18`} strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <span className="text-[11px] font-extrabold font-mono relative z-10" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <span className="text-[10px] font-bold mt-1 flex items-center gap-1" style={{ color: C.text1 }}>
        {label}
        {badge}
      </span>
      {sub && <span className="text-[8px]" style={{ color: C.text3 }}>{sub}</span>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div 
      className="rounded-lg px-3 py-2 shadow-xl text-[10px]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="font-mono mb-1" style={{ color: 'var(--text-secondary)' }}>Round {label}</p>
      {payload.map((item, idx) => (
        <p key={idx} style={{ color: item.color }} className="font-bold">
          {item.name}: {item.value !== null && item.value !== undefined ? `${item.value.toFixed(2)}%` : '—'}
        </p>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 1: AIOPS OPERATIONS
   ═══════════════════════════════════════════════════════════════════════════ */
function AIOpsOperationsTab({ onSwitchTab }) {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // raw API data
  const [liveMap, setLiveMap] = useState({});       // { 1: {...}, 2: {...}, 3: {...} }
  const [anomalyMap, setAnomalyMap] = useState({});
  const [predictMap, setPredictMap] = useState({});
  const [alertsMap, setAlertsMap] = useState({});
  const [auditLog, setAuditLog] = useState([]);
  const [fedStatus, setFedStatus] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [telegramCfg, setTelegramCfg] = useState(null);

  // Dynamic timeline states
  const [timelineBridges, setTimelineBridges] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // Interactive selected bridge state
  const [selectedBridgeId, setSelectedBridgeId] = useState(null);

  /* ── Fetch everything ────────────────────────────────────────── */
  const refresh = useCallback(async () => {
    try {
      const [results, bridgesRes] = await Promise.allSettled([
        Promise.allSettled([
          api('/audit-log'),
          api('/federated/status'),
          api('/chat/model-info'),
          api('/telegram/config'),
        ]),
        api('/india/bridges')
      ]);

      let bridgesList = [];
      if (bridgesRes.status === 'fulfilled') {
        bridgesList = bridgesRes.value || [];
      }

      // Populate maps from bridgesList
      const lm = {};
      const am = {};
      const pm = {};
      const alm = {};

      bridgesList.forEach((b) => {
        lm[b.id] = {
          id: b.id,
          bridge_name: b.name,
          health_score: b.health_score,
          health_grade: b.health_grade,
          health_status: b.status,
          alert_level: b.alert_level,
          vibration: b.vibration,
          strain: b.strain,
          crack_gap: b.crack_gap,
          water_level: b.water_level,
          anomaly_score: b.anomaly_score,
          risk_score: b.risk_score,
          traffic_load: b.traffic_load,
          vehicle_count: b.vehicle_count,
          degradation_rate: b.degradation_rate
        };
        
        am[b.id] = {
          combined_score: b.anomaly_score,
          anomaly_score: b.anomaly_score,
          alert_level: b.alert_level
        };
        
        pm[b.id] = {
          bridge_name: b.name,
          risk_score: b.risk_score
        };
        
        alm[b.id] = {
          alert_level: b.alert_level
        };
      });

      setLiveMap(lm);
      setAnomalyMap(am);
      setPredictMap(pm);
      setAlertsMap(alm);

      if (results.status === 'fulfilled') {
        const resultsArray = results.value;
        const v = (i) => (resultsArray[i].status === 'fulfilled' ? resultsArray[i].value : null);

        if (v(0)) setAuditLog(Array.isArray(v(0)) ? v(0) : []);
        if (v(1)) setFedStatus(v(1));
        if (v(2)) setModelInfo(v(2));
        if (v(3)) setTelegramCfg(v(3));
      }

      if (bridgesRes.status === 'fulfilled') {
        const sorted = [...bridgesList].sort((a, b) => (a.health_score ?? 100) - (b.health_score ?? 100));
        // Show all 58 bridges in the timeline
        const allBridgesWithLive = sorted.map((b) => ({
          id: b.id,
          name: b.name || `Bridge ${b.id}`,
          health_score: b.health_score,
          live: lm[b.id] || null,
        }));
        setTimelineBridges(allBridgesWithLive);
        setTimelineLoading(false);
      }
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[aiops]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  /* ── Bridge name helper ──────────────────────────────────────── */
  const bridgeName = (id) => {
    const n = liveMap[id]?.bridge_name || predictMap[id]?.bridge_name;
    return n || `Bridge ${id}`;
  };

  /* ── Predictive Failure Timeline Data ────────────────────────── */
  const timelineData = useMemo(() => {
    const list = timelineBridges.map((b) => {
      const live = b.live || {};
      const riskScore = live.risk_score || 0;
      const anomalyScore = live.anomaly_score || 0;
      const combinedRisk = riskScore * 0.6 + anomalyScore * 0.4;
      const health = live.health_score ?? 100;

      // Calculate days until failure: days = (health - 20) / degradation_rate
      const degradationRate = live.degradation_rate || 1.5;
      const days = Math.round((health - 20) / degradationRate);
      const daysText = health >= 75 ? "90+ days" : `~${days} days`;

      const riskPct = Math.round(riskScore * 100);
      let status = "Healthy — No immediate risk";
      let statusColor = C.green;
      let statusIcon = "";

      if (riskPct >= 50) {
        status = "Critical — Immediate attention required";
        statusColor = C.red;
        statusIcon = "";
      } else if (riskPct >= 30) {
        status = "Monitor — Moderate risk";
        statusColor = C.yellow;
        statusIcon = "";
      }

      return {
        id: b.id,
        name: b.name,
        combinedRisk,
        daysText,
        status,
        statusColor,
        statusIcon,
        anomalyScore,
        riskScore
      };
    });

    // Sort by risk highest first
    list.sort((a, b) => b.riskScore - a.riskScore);
    return list;
  }, [timelineBridges]);

  const renderTimeline = () => {
    if (loading || timelineLoading) return <Skel h={380} />;

    return (
      <div
        className="p-6 rounded-xl border space-y-5"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center gap-2.5">
          <Activity size={14} className="text-slate-500" />
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
            Predictive Failure Timeline
          </h2>
        </div>

        <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2">
          {timelineData.map((b) => {
            const pct = Math.min((b.anomalyScore || 0) * 100, 100);
            const barGrad =
              pct > 70
                ? `linear-gradient(90deg, ${C.yellow}, ${C.red})`
                : pct > 30
                ? `linear-gradient(90deg, ${C.green}, ${C.yellow})`
                : `linear-gradient(90deg, ${C.green}90, ${C.green})`;
            const isSelected = selectedBridgeId === b.id;

            return (
              <div 
                key={b.id} 
                className={`space-y-2 p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected ? 'bg-purple-50/10' : 'border-transparent hover:bg-slate-50'
                }`}
                style={{
                  border: isSelected ? `1.5px solid ${C.purple}` : '1px solid transparent'
                }}
                onClick={() => setSelectedBridgeId(b.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    
                    <span className="text-[12px] font-bold" style={{ color: C.text1 }}>{b.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px]">{b.statusIcon}</span>
                    <span className="text-[10px] font-semibold" style={{ color: b.statusColor }}>
                      {b.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div
                    className="flex-1 h-3 rounded-full overflow-hidden relative"
                    style={{ background: `${C.border}` }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-1000 relative"
                      style={{ width: `${Math.max(pct, 2)}%`, background: barGrad }}
                    >
                      <div
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                          backgroundSize: '200% 100%',
                          animation: 'aio-shimmer 2s ease-in-out infinite',
                        }}
                      />
                    </div>
                  </div>

                  {/* Sparkline: 5 dots */}
                  <div className="flex items-end gap-[3px] h-4 shrink-0">
                    {[0.8, 0.6, 0.7, 0.9, 1.0].map((m, i) => {
                      const v = b.anomalyScore * m * (0.7 + Math.random() * 0.6);
                      const dotH = Math.max(3, Math.min(v * 16, 16));
                      const dotColor = v > 0.5 ? C.red : v > 0.3 ? C.yellow : C.green;
                      return (
                        <div
                          key={i}
                          className="w-[4px] rounded-full transition-all"
                          style={{ height: dotH, background: dotColor, opacity: 0.4 + i * 0.15 }}
                        />
                      );
                    })}
                  </div>

                  {/* % risk badge scales consistently with risk_score: % risk = risk_score * 100 */}
                  <span
                    className="text-[10px] font-mono font-bold shrink-0 w-12 text-right"
                    style={{ color: b.statusColor }}
                  >
                    {Math.round(b.riskScore * 100)}% risk
                  </span>
                </div>

                <div className="flex gap-4 text-[9px] font-mono" style={{ color: C.text3 }}>
                  <span>Risk: {b.riskScore.toFixed(3)}</span>
                  <span>Anomaly: {b.anomalyScore.toFixed(3)}</span>
                  <span>Combined: {b.combinedRisk.toFixed(3)}</span>
                  <span>Days: {b.daysText}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /* ── Anomaly Correlation Data ────────────────────────────────── */
  const correlation = useMemo(() => {
    const allEntries = BRIDGE_IDS.map((id) => {
      const a = anomalyMap[id] || {};
      const live = liveMap[id] || {};
      return {
        id,
        name: bridgeName(id),
        score: a.combined_score ?? a.anomaly_score ?? 0,
        health: live.health_score ?? 100
      };
    });

    // Only show bridges where anomaly_score >= 0.50 (health <= 50) to match Critical bridges exactly
    let filtered = allEntries.filter(e => e.score >= 0.50);
    if (filtered.length === 0) {
      filtered = [...allEntries].sort((a, b) => a.health - b.health).slice(0, 10);
    } else {
      filtered.sort((a, b) => b.score - a.score);
    }

    const high = allEntries.filter((e) => e.score >= 0.50);
    
    // Check if anomaly_scores of high anomalous bridges are all within 0.05 of each other
    const scores = high.map(e => e.score);
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const spread = maxScore - minScore;
    const isCorrelated = spread < 0.05;

    let label, cause, color;
    if (high.length >= 10 && isCorrelated) {
      label = 'MULTI-BRIDGE EVENT DETECTED';
      cause = 'Possible seismic activity, weather event, or heavy convoy';
      color = C.purple;
    } else if (high.length >= 2) {
      label = 'ELEVATED READINGS DETECTED';
      cause = 'Multiple bridges showing independent degradation — schedule prioritized maintenance';
      color = C.yellow;
    } else if (high.length === 1) {
      label = 'ISOLATED ANOMALY';
      cause = 'Localized structural issue or sensor drift';
      color = C.yellow;
    } else {
      label = 'NO CORRELATION';
      cause = 'All bridges operating independently within normal parameters';
      color = C.green;
    }

    // Dynamic confidence based on data quality and sample size
    let conf = 85;
    if (high.length > 5) {
      conf += Math.min(10, high.length - 5);
    }
    if (spread < 0.10) {
      conf += 3;
    }
    const maxCap = spread < 0.05 ? 99 : 98;
    const finalConfidence = Math.min(maxCap, Math.round(conf));

    return { label, cause, color, confidence: finalConfidence, high, entries: filtered };
  }, [anomalyMap, liveMap]);

  const renderCorrelation = () => {
    if (loading) return <Skel h={380} />;

    return (
      <div
        className="p-5 rounded-xl border h-full flex flex-col"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} />
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
            Anomaly Correlation Engine
          </h2>
        </div>

        {/* Correlation badge */}
        <div
          className="p-4 rounded-xl mb-4 text-center"
          style={{ background: `${correlation.color}08`, border: `1px solid ${correlation.color}25` }}
        >
          <span
            className="text-[11px] font-black uppercase tracking-widest"
            style={{ color: correlation.color }}
          >
            {correlation.label}
          </span>
        </div>

        {/* Contributing bridges */}
        <div className="space-y-2 mb-4 flex-1 max-h-[180px] overflow-y-auto pr-1">
          {correlation.entries.map((e) => {
            const barColor = e.score > 0.7 ? C.red : e.score > 0.3 ? C.yellow : C.green;
            const isHigh = e.score > 0.3;
            const isSelected = selectedBridgeId === e.id;
            return (
              <div
                key={e.id}
                onClick={() => setSelectedBridgeId(e.id)}
                className={`flex items-center gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                  isSelected ? 'bg-purple-50/10' : 'hover:bg-slate-50'
                }`}
                style={{
                  background: isSelected ? 'rgba(139, 92, 246, 0.05)' : (isHigh ? `${barColor}08` : 'transparent'),
                  border: `1px solid ${isSelected ? C.purple : (isHigh ? `${barColor}25` : C.border)}`,
                }}
              >
                <span className="text-[11px] font-bold flex-1" style={{ color: C.text1 }}>
                  {e.name}
                </span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(e.score * 100, 100)}%`, background: barColor }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold w-10 text-right" style={{ color: barColor }}>
                  {e.score.toFixed(2)}
                </span>
                {isHigh && <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />}
              </div>
            );
          })}
        </div>

        {/* AI reasoning */}
        <div
          className="p-3 rounded-lg text-[10px] leading-relaxed mb-3"
          style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}18`, color: C.text2 }}
        >
          <span className="font-bold" style={{ color: C.purple }}>AI analysis: </span>
          Bridge Health Monitor AI detected <strong style={{ color: C.text1 }}>{correlation.high.length}</strong> bridge(s) showing elevated readings simultaneously.
          This pattern suggests <em style={{ color: correlation.color }}>{correlation.cause.toLowerCase()}</em>.
        </div>

        {/* Confidence + detection time */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase" style={{ color: C.text3 }}>Confidence</span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${correlation.confidence}%`, background: C.purple }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold" style={{ color: C.purple }}>
              {correlation.confidence}%
            </span>
          </div>
          <span className="text-[9px] font-mono" style={{ color: C.text3 }}>
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  };

  /* ── Auto-Decision Log Data ──────────────────────────────────── */
  const decisions = useMemo(() => {
    return auditLog.slice(0, 12).map((e) => {
      const a = (e.action || '').toUpperCase();
      let icon, desc;
      if (a.includes('AI_FLAGGED')) {
        icon = ''; desc = `AI flagged ${e.target} for review`;
      } else if (a.includes('FEDERATED_ROUND')) {
        icon = ''; desc = `Federated training round ${e.target} started`;
      } else if (a.includes('ANOMALY_BREACH')) {
        icon = ''; desc = `Anomaly threshold breach: ${e.target}`;
      } else if (a.includes('PREDICTIVE_MAINTENANCE')) {
        icon = ''; desc = `Predictive maintenance recommendation generated for ${e.target}`;
      } else if (a.includes('ACTIVATE') || a.includes('BRIDGE')) {
        icon = ''; desc = 'Auto-activated bridge monitoring';
      } else if (a.includes('LOGIN')) {
        icon = ''; desc = 'Security: New session detected';
      } else if (a.includes('RESET') || a.includes('FEDERATED')) {
        icon = ''; desc = 'AI triggered federated retraining';
      } else {
        icon = ''; desc = `System: ${e.action || 'operation'}`;
      }
      const isAuto = (e.user_email || '').toLowerCase().includes('system');
      return { ...e, icon, desc, isAuto, time: e.timestamp ? new Date(e.timestamp).toLocaleString() : '—' };
    });
  }, [auditLog]);

  const renderDecisions = () => {
    if (loading) return <Skel h={380} />;

    return (
      <div
        className="p-5 rounded-xl border h-full flex flex-col"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Settings size={14} />
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
            Auto-Decision Log
          </h2>
        </div>

        <div
          className="flex-1 overflow-y-auto space-y-2 pr-1"
          style={{ maxHeight: 360, scrollbarWidth: 'thin' }}
        >
          {decisions.map((d, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border transition-all duration-300"
              style={{
                background: C.cardAlt,
                borderColor: C.border,
                animation: `aio-fadeSlide 0.4s ease ${i * 0.05}s both`,
              }}
            >
              <div className="flex items-start gap-2.5">
                <span className="text-sm shrink-0 mt-0.5">{d.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ color: C.purple, background: `${C.purple}15`, border: `1px solid ${C.purple}25` }}
                    >
                      AI Decision
                    </span>
                    <span
                      className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: d.isAuto ? C.cyan : C.text3,
                        background: d.isAuto ? `${C.cyan}12` : `${C.text3}12`,
                        border: `1px solid ${d.isAuto ? `${C.cyan}20` : `${C.text3}20`}`,
                      }}
                    >
                      {d.isAuto ? 'Automated' : 'Manual'}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold truncate" style={{ color: C.text1 }}>
                    {d.desc}
                  </p>
                  {d.user_email && (
                    <p className="text-[9px] font-mono truncate mt-0.5" style={{ color: C.text3 }}>
                      {d.user_email}
                    </p>
                  )}
                </div>
                <span className="text-[8px] font-mono shrink-0" style={{ color: C.text4 }}>
                  {d.time}
                </span>
              </div>
            </div>
          ))}
          {decisions.length === 0 && (
            <div className="p-8 text-center text-[11px]" style={{ color: C.text3 }}>
              No decisions recorded yet
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Root Cause Analysis Chain Data ──────────────────────────── */
  const rootCause = useMemo(() => {
    let targetId = selectedBridgeId;
    
    // If no bridge is selected, find the most critical one (lowest health score)
    if (!targetId) {
      let minHealth = 100;
      let minId = 1;
      BRIDGE_IDS.forEach((id) => {
        const live = liveMap[id] || {};
        const h = live.health_score ?? 100;
        if (h < minHealth) {
          minHealth = h;
          minId = id;
        }
      });
      targetId = minId;
    }

    const live = liveMap[targetId] || {};
    const score = anomalyMap[targetId]?.combined_score ?? anomalyMap[targetId]?.anomaly_score ?? 0;
    const highAnomaly = score > 0.5;

    // Correct thresholds aligned with IRC standards
    const thresholds = {
      vibration: SENSOR_THRESHOLDS.vibration.crit,   // 1.2 g (IRC:6-2017)
      strain: SENSOR_THRESHOLDS.strain.crit,          // 210 MPa (IRC:112-2011)
      crack_gap: SENSOR_THRESHOLDS.crack_gap.crit,    // 0.30 mm (IRC:112-2011)
      water_level: SENSOR_THRESHOLDS.water_level.crit, // 4.5 m (IRC:6-2017)
    };

    // Health score color helper
    const hsVal = live.health_score ?? 100;
    const hsAbnormal = hsVal < 60;
    const hsWarn = hsVal >= 60 && hsVal <= 80;

    const chain = [
      {
        label: 'Vehicle Load',
        value: live.traffic_load ?? live.vehicle_count ?? '—',
        unit: live.traffic_load ? 'tons' : 'vehicles',
        icon: '',
        abnormal: false,
        warn: false,
      },
      {
        label: 'Vibration',
        value: live.vibration ?? 0,
        threshold: thresholds.vibration,
        unit: 'g',
        icon: '',
        abnormal: (live.vibration ?? 0) > thresholds.vibration,
        warn: false,
      },
      {
        label: 'Strain',
        value: live.strain ?? 0,
        threshold: thresholds.strain,
        unit: 'MPa',
        icon: '',
        abnormal: (live.strain ?? 0) > thresholds.strain,
        warn: false,
      },
      {
        label: 'Crack Gap',
        value: live.crack_gap ?? 0,
        threshold: thresholds.crack_gap,
        unit: 'mm',
        icon: '',
        abnormal: (live.crack_gap ?? 0) > thresholds.crack_gap,
        warn: false,
      },
      {
        label: 'Water Level',
        value: live.water_level ?? 0,
        threshold: thresholds.water_level,
        unit: 'm',
        icon: '',
        abnormal: (live.water_level ?? 0) > thresholds.water_level,
        warn: false,
      },
      {
        label: 'Health Score',
        value: live.health_score ?? live.risk_score ?? '—',
        unit: '',
        icon: '',
        abnormal: hsAbnormal,
        warn: hsWarn,
      },
    ];

    // Determine primary driver by comparing value/threshold ratio
    const sensors = [
      { name: 'Vibration', value: live.vibration ?? 0, threshold: thresholds.vibration },
      { name: 'Strain', value: live.strain ?? 0, threshold: thresholds.strain },
      { name: 'Crack Gap', value: live.crack_gap ?? 0, threshold: thresholds.crack_gap },
      { name: 'Water Level', value: live.water_level ?? 0, threshold: thresholds.water_level },
    ];
    const anomalousSensors = sensors.filter((s) => s.value > s.threshold);
    const primaryDriver =
      anomalousSensors.length > 0
        ? anomalousSensors.sort((a, b) => b.value / b.threshold - a.value / a.threshold)[0].name
        : null;

    // Find first abnormal step in chain
    const firstAbnIdx = chain.findIndex((c) => c.abnormal);

    return { chain, bridgeId: targetId, bridgeName: bridgeName(targetId), maxScore: score, highAnomaly, primaryDriver, firstAbnIdx };
  }, [liveMap, anomalyMap, selectedBridgeId]);

  const criticalBridgesForRca = useMemo(() => {
    return BRIDGE_IDS.map((id) => {
      const live = liveMap[id] || {};
      return {
        id,
        name: liveMap[id]?.bridge_name || bridgeName(id),
        health: live.health_score ?? 100
      };
    })
    .filter((b) => b.health < 50)
    .sort((a, b) => a.health - b.health);
  }, [liveMap]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const t = localStorage.getItem('bridgeiq_token') || '';
      const response = await fetch(`${API}/reports/bridge/${rootCause.bridgeId}`, {
        headers: {
          'Authorization': `Bearer ${t}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const blob = await response.blob();
      
      let filename = `BridgeReport_${rootCause.bridgeName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[report-download-error]', err);
      alert(`Report download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const [isNetworkDownloading, setIsNetworkDownloading] = useState(false);

  const handleNetworkDownload = async () => {
    setIsNetworkDownloading(true);
    try {
      const t = localStorage.getItem('bridgeiq_token') || '';
      const response = await fetch(`${API}/reports/network`, {
        headers: {
          'Authorization': `Bearer ${t}`
        }
      });
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const blob = await response.blob();
      
      let filename = `NetworkReport_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
      const disposition = response.headers.get('Content-Disposition');
      if (disposition) {
        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[network-report-download-error]', err);
      alert(`Network report download failed: ${err.message}`);
    } finally {
      setIsNetworkDownloading(false);
    }
  };

  const renderRootCause = () => {
    if (loading) return <Skel h={160} />;

    return (
      <div
        className="p-6 rounded-xl border"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Activity size={14} />
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
              Root Cause Analysis Chain
            </h2>
          </div>
          <div className="flex items-center text-[10px] font-medium" style={{ color: C.text2 }}>
            <span>Analyzing:</span>
            <select
              value={rootCause.bridgeId}
              onChange={(e) => setSelectedBridgeId(Number(e.target.value))}
              className="ml-2 rounded-lg border py-1 px-2 text-[10px] font-bold outline-none cursor-pointer"
              style={{
                background: C.cardAlt,
                borderColor: C.border,
                color: C.text1
              }}
            >
              {criticalBridgesForRca.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (Health: {formatHealthScore(b.health)}/100)
                </option>
              ))}
            </select>
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="ml-3 px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all"
              style={{
                background: isDownloading ? C.card : C.purple,
                color: isDownloading ? C.text3 : '#fff',
                borderColor: isDownloading ? C.border : C.purple,
                cursor: isDownloading ? 'not-allowed' : 'pointer'
              }}
            >
              {isDownloading ? (
                <>
                  <span className="inline-block animate-spin text-xs">...</span>
                  Generating...
                </>
              ) : (
                <>
                  <FileText size={14} />
                  Download Report
                </>
              )}
            </button>
          </div>
        </div>

        {/* Chain visualization */}
        <div className="flex items-stretch gap-0 overflow-x-auto pb-3" style={{ scrollbarWidth: 'thin' }}>
          {rootCause.chain.map((step, idx) => {
            const isHighlighted = rootCause.highAnomaly && idx === rootCause.firstAbnIdx;
            const boxBorder = step.abnormal ? C.red : step.warn ? C.yellow : isHighlighted ? C.yellow : C.border;
            const arrowColor = step.abnormal ? C.red : C.green;
            const valueColor = step.abnormal ? C.red : step.warn ? C.yellow : C.green;

            return (
              <div key={idx} className="flex items-center shrink-0">
                {/* Box */}
                <div
                  className="p-3 rounded-xl relative transition-all"
                  style={{
                    background: isHighlighted ? `${C.red}08` : C.cardAlt,
                    border: `1.5px solid ${boxBorder}`,
                    minWidth: 130,
                    boxShadow: 'none',
                  }}
                >
                  {isHighlighted && (
                    <div
                      className="absolute -top-2 left-1/2 -translate-x-1/2 text-[7px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{ background: C.red, color: '#fff' }}
                    >
                      Root Cause
                    </div>
                  )}
                  <div className="text-center">
                    <span className="text-lg block mb-1">{step.icon}</span>
                    <span className="text-[10px] font-bold block" style={{ color: C.text1 }}>
                      {step.label}
                    </span>
                    <span
                      className="text-[13px] font-extrabold font-mono block mt-1"
                      style={{ color: valueColor }}
                    >
                      {typeof step.value === 'number' ? step.value.toFixed(2) : step.value}
                      <span className="text-[8px] font-normal" style={{ color: C.text3 }}> {step.unit}</span>
                    </span>
                    {step.threshold != null && (
                      <span className="text-[8px] font-mono" style={{ color: C.text4 }}>
                        threshold: {step.threshold}{step.unit}
                      </span>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                {idx < rootCause.chain.length - 1 && (
                  <div className="flex items-center px-1 shrink-0">
                    <svg width="28" height="14" viewBox="0 0 28 14">
                      <line x1="0" y1="7" x2="20" y2="7" stroke={arrowColor} strokeWidth="2" />
                      <polygon points="19,3 27,7 19,11" fill={arrowColor} />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Primary driver label */}
        <div
          className="mt-4 p-3 rounded-lg text-[10px]"
          style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}18` }}
        >
          <span className="font-bold" style={{ color: C.purple }}>AI root cause: </span>
          <span style={{ color: C.text2 }}>
            {rootCause.primaryDriver ? (
              <>
                <strong style={{ color: C.red }}>{rootCause.primaryDriver}</strong> is the primary driver of health degradation
                on {rootCause.bridgeName}. Anomaly score: <strong style={{ color: C.yellow }}>{rootCause.maxScore.toFixed(3)}</strong>.
              </>
            ) : (
              <>All sensors within normal parameters — no anomaly detected. All values are below their respective thresholds.</>
            )}
          </span>
        </div>
      </div>
    );
  };

  /* ── Cost Intelligence Panel ─────────────────────────────────── */
  const costData = useMemo(() => {
    const deferredCostPerDay = 15000;
    const repairPerBridge = 200000;
    const bridges = BRIDGE_IDS.map((id) => {
      const a = anomalyMap[id] || {};
      const live = liveMap[id] || {};
      const level = a.alert_level ?? a.level ?? 'NORMAL';
      return { id, level: level.toUpperCase(), health: live.health_score ?? 100 };
    });
    // Cost calculations scale with Grade F/Critical bridges (health < 50)
    const warningBridges = bridges.filter((b) => b.health < 50);
    const totalDeferredRisk = warningBridges.length * deferredCostPerDay * 30;
    const immediateRepairCost = warningBridges.length * repairPerBridge;
    const savings = Math.max(totalDeferredRisk - immediateRepairCost, 0);

    const total = totalDeferredRisk + immediateRepairCost + (savings > 0 ? savings : 1);
    const healthyCount = bridges.filter((b) => b.health >= 75).length;
    const monitorCount = bridges.filter((b) => b.health >= 50 && b.health < 75).length;
    const criticalCount = bridges.filter((b) => b.health < 50).length;

    return {
      warningCount: warningBridges.length,
      deferredRisk: totalDeferredRisk,
      repairCost: immediateRepairCost,
      savings,
      deferredPct: (totalDeferredRisk / total) * 100,
      repairPct: (immediateRepairCost / total) * 100,
      savingsPct: ((savings > 0 ? savings : 1) / total) * 100,
      healthyCount,
      monitorCount,
      criticalCount,
    };
  }, [anomalyMap, liveMap]);

  const renderCostIntel = () => {
    if (loading) return <Skel h={340} />;

    if (costData.warningCount === 0) {
      const proactiveSavings = (58 * 15000 * 30).toLocaleString('en-IN');
      return (
        <div
          className="p-5 rounded-xl border h-full flex flex-col"
          style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign size={14} />
              <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
                Cost Intelligence
              </h2>
            </div>
            <button
              onClick={handleNetworkDownload}
              disabled={isNetworkDownloading}
              className="px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all text-[10px]"
              style={{
                background: isNetworkDownloading ? C.card : C.purple,
                color: isNetworkDownloading ? C.text3 : '#fff',
                borderColor: isNetworkDownloading ? C.border : C.purple,
                cursor: isNetworkDownloading ? 'not-allowed' : 'pointer',
                boxShadow: 'none'
              }}
            >
              {isNetworkDownloading ? (
                <>
                  <span className="inline-block animate-spin text-xs">...</span>
                  Generating...
                </>
              ) : (
                <>
                  <FileText size={14} />
                  Download Network Report
                </>
              )}
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `${C.green}12`, border: `2px solid ${C.green}30`, boxShadow: 'none' }}
            >
              <CheckCircle size={22} color={C.green} />
            </div>

            <div>
              <h3 className="text-[14px] font-extrabold mb-1" style={{ color: C.green }}>
                All Bridges Healthy
              </h3>
              <p className="text-[11px] leading-relaxed" style={{ color: C.text2 }}>
                No deferred maintenance costs. All 58 bridges are<br />operating within normal parameters.
              </p>
            </div>

            <div
              className="p-3 rounded-lg w-full"
              style={{ background: `${C.green}06`, border: `1px solid ${C.green}18` }}
            >
              <p className="text-[10px] mb-1" style={{ color: C.text3 }}>Estimated savings from proactive monitoring</p>
              <p className="text-[18px] font-extrabold font-mono" style={{ color: C.green }}>₹{proactiveSavings}</p>
              <p className="text-[9px] mt-0.5" style={{ color: C.text3 }}>over 30 days</p>
            </div>
          </div>

          <div
            className="p-3 rounded-lg text-[10px]"
            style={{ background: `${C.green}08`, border: `1px solid ${C.green}18`, color: C.text2 }}
          >
            <span className="font-bold" style={{ color: C.green }}>AI insight: </span>
            Bridge Health Monitor AI has prevented potential emergency costs through early detection and proactive monitoring.
          </div>
        </div>
      );
    }

    const stops = `${C.red} 0deg ${costData.deferredPct * 3.6}deg, ${C.yellow} ${costData.deferredPct * 3.6}deg ${(costData.deferredPct + costData.repairPct) * 3.6}deg, ${C.green} ${(costData.deferredPct + costData.repairPct) * 3.6}deg 360deg`;
    const fmtLakhs = (val) => `₹${(val / 100000).toFixed(1)}L`;

    return (
      <div
        className="p-5 rounded-xl border h-full flex flex-col"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign size={14} />
            <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
              Cost Intelligence
            </h2>
          </div>
          <button
            onClick={handleNetworkDownload}
            disabled={isNetworkDownloading}
            className="px-3 py-1 rounded-lg border font-bold flex items-center gap-1.5 transition-all text-[10px]"
            style={{
              background: isNetworkDownloading ? C.card : C.purple,
              color: isNetworkDownloading ? C.text3 : '#fff',
              borderColor: isNetworkDownloading ? C.border : C.purple,
              cursor: isNetworkDownloading ? 'not-allowed' : 'pointer',
              boxShadow: 'none'
            }}
          >
            {isNetworkDownloading ? (
              <>
                <span className="inline-block animate-spin text-xs">...</span>
                Generating...
              </>
            ) : (
              <>
                <FileText size={14} />
                Download Network Report
              </>
            )}
          </button>
        </div>

        {/* Dynamic Grade Count Breakdown */}
        <div
          className="p-2.5 rounded-lg mb-4 text-center font-bold text-[10px]"
          style={{ background: `${C.purple}08`, border: `1px solid ${C.purple}20`, color: C.text1 }}
        >
          Status Summary: <span style={{ color: C.green }}>{costData.healthyCount} Healthy</span>, <span style={{ color: C.yellow }}>{costData.monitorCount} Monitor</span>, <span style={{ color: C.red }}>{costData.criticalCount} Critical</span>
        </div>

        <div className="flex gap-5 flex-1 items-center">
          <div className="shrink-0 relative">
            <div
              className="rounded-full"
              style={{
                width: 110,
                height: 110,
                background: `conic-gradient(${stops})`,
                boxShadow: 'none',
              }}
            >
              <div
                className="absolute inset-0 m-auto rounded-full flex items-center justify-center"
                style={{ width: 64, height: 64, background: C.card }}
              >
                <span className="text-[11px] font-bold" style={{ color: C.text1 }}>
                  {costData.warningCount} at risk
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: C.red }} />
                <span className="text-[10px]" style={{ color: C.text2 }}>Deferred Risk (30d)</span>
              </div>
              <span className="text-[12px] font-extrabold font-mono" style={{ color: C.red, flexShrink: 0, textAlign: 'right', minWidth: '65px' }}>
                {fmtLakhs(costData.deferredRisk)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: C.yellow }} />
                <span className="text-[10px]" style={{ color: C.text2 }}>Immediate Repair</span>
              </div>
              <span className="text-[12px] font-extrabold font-mono" style={{ color: C.yellow, flexShrink: 0, textAlign: 'right', minWidth: '65px' }}>
                {fmtLakhs(costData.repairCost)}
              </span>
            </div>

            <div
              className="flex items-center justify-between p-2 rounded-lg gap-4"
              style={{ background: `${C.green}08`, border: `1px solid ${C.green}20` }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: C.green }} />
                <span className="text-[10px] font-bold" style={{ color: C.green }}>Potential Savings</span>
              </div>
              <span className="text-[14px] font-extrabold font-mono" style={{ color: C.green, flexShrink: 0, textAlign: 'right', minWidth: '65px' }}>
                {fmtLakhs(costData.savings)}
              </span>
            </div>
          </div>
        </div>

        <div
          className="mt-4 p-3 rounded-lg text-[10px]"
          style={{ background: `${C.green}08`, border: `1px solid ${C.green}18`, color: C.text2 }}
        >
          <span className="font-bold" style={{ color: C.green }}>AI recommendation: </span>
          Act now to save <strong style={{ color: C.green }}>{fmtLakhs(costData.savings)}</strong>. {costData.warningCount} bridge(s) have deferred maintenance accumulating at ₹15,000/day.
        </div>
      </div>
    );
  };

  /* ── Model Performance Intelligence Panel ────────────────────── */
  const renderModelPerf = () => {
    if (loading) return <Skel h={340} />;

    const fedRounds = fedStatus?.current_round ?? 0;
    const modelType = modelInfo?.model_type ?? modelInfo?.type ?? 'unknown';
    const isLocal = modelType?.toLowerCase?.()?.includes?.('local') || modelType?.toLowerCase?.()?.includes?.('llama');

    const models = [
      { name: 'Isolation Forest', auc: 0.985, color: C.green },
      { name: 'LSTM Autoencoder', auc: 0.992, color: C.blue },
      { name: 'Federated Model', auc: 0.991, color: C.purple },
    ];

    const anyLow = models.some((m) => m.auc < 0.8);

    return (
      <div
        className="p-5 rounded-xl border h-full flex flex-col"
        style={{ background: C.card, borderColor: C.border, boxShadow: 'none' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Activity size={14} />
          <h2 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: C.purple }}>
            Model Performance Intelligence
          </h2>
        </div>

        <div className="flex justify-around items-start mb-4 flex-wrap gap-2">
          {models.map((m, i) => {
            const isFed = m.name === 'Federated Model';
            const showBadge = isFed && fedRounds >= 10;
            return (
              <CircGauge
                key={i}
                pct={m.auc * 100}
                color={m.color}
                label={m.name}
                sub={`AUC ${m.auc.toFixed(3)}`}
                badge={showBadge ? <Badge label="Fully Trained" color={C.green} glow /> : null}
              />
            );
          })}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: 72,
                height: 72,
                background: `${isLocal ? C.green : C.purple}10`,
                border: `2px solid ${isLocal ? C.green : C.purple}30`,
              }}
            >
              <Brain size={22} color={C.purple} />
            </div>
            <span className="text-[10px] font-bold mt-1" style={{ color: C.text1 }}>LLaMA 3.2</span>
            <Badge label={isLocal ? 'LOCAL' : 'GROQ'} color={isLocal ? C.green : C.purple} />
          </div>
        </div>

        {/* Model Drift Alerts */}
        {(() => {
          const alerts = [];
          if (fedRounds < 10) {
            alerts.push({
              level: 'warning', icon: '', color: C.yellow,
              isDrift: true,
              message: `Federated model has completed only ${fedRounds} training round${fedRounds !== 1 ? 's' : ''}. Minimum 10 rounds recommended for optimal accuracy. Run more federated rounds in the Federated ML page.`,
              action: 'Go to Federated ML →',
            });
          } else {
            alerts.push({
              level: 'success', icon: null, color: C.green,
              isDrift: false,
              message: `Federated model fully trained (10/10 rounds)`,
              action: null,
            });
          }
          return alerts.map((alert, i) => (
            <div
              key={i}
              className="p-2.5 rounded-lg mb-3 flex items-start gap-2 text-[10px]"
              style={{ background: `${alert.color}08`, border: `1px solid ${alert.color}25` }}
            >
              {alert.icon && <span className="shrink-0 mt-0.5">{alert.icon}</span>}
              <div className="flex-1">
                <span style={{ color: alert.color }}>
                  {alert.isDrift ? (
                    <><strong>Model Drift Alert:</strong> {alert.message}</>
                  ) : (
                    <strong>{alert.message}</strong>
                  )}
                </span>
                {alert.action && (
                  <span
                    onClick={() => {
                      if (onSwitchTab) onSwitchTab('federated');
                    }}
                    className="block mt-1 font-bold cursor-pointer"
                    style={{ color: alert.color, textDecoration: 'underline', textUnderlineOffset: 2 }}
                  >
                    {alert.action}
                  </span>
                )}
              </div>
            </div>
          ));
        })()}

        <div className="space-y-1.5 mt-auto">
          <div className="flex justify-between text-[9px]" style={{ color: C.text3 }}>
            <span>Last Inference</span>
            <span className="font-mono" style={{ color: C.text2 }}>Just now</span>
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: C.text3 }}>
            <span>Active Model</span>
            <span className="font-mono" style={{ color: C.text2 }}>{modelType}</span>
          </div>
          <div className="flex justify-between text-[9px]" style={{ color: C.text3 }}>
            <span>Federated Rounds</span>
            <span className="font-mono" style={{ color: C.purple }}>{fedRounds} completed</span>
          </div>
        </div>

        <button
          className="mt-3 w-full py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-default"
          style={{
            background: anyLow ? `${C.red}15` : `${C.purple}10`,
            border: `1px solid ${anyLow ? C.red : C.purple}30`,
            color: anyLow ? C.red : C.purple,
            boxShadow: 'none',
            animation: anyLow ? 'aio-glow 2s ease-in-out infinite' : 'none',
          }}
        >
          {anyLow ? 'Retraining recommended' : 'All models performant'}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in-up" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Scoped keyframes */}
      <style>{`
        @keyframes aio-ping {
          0% { transform: scale(1); opacity: .75 }
          75%, 100% { transform: scale(2.4); opacity: 0 }
        }
        @keyframes aio-shimmer {
          0% { background-position: -200% 0 }
          100% { background-position: 200% 0 }
        }
        @keyframes aio-pulse-purple {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${C.purple}40 }
          50% { opacity: .7; box-shadow: 0 0 20px ${C.purple}60 }
        }
        @keyframes aio-fadeSlide {
          from { opacity: 0; transform: translateY(8px) }
          to { opacity: 1; transform: translateY(0) }
        }
        @keyframes aio-glow {
          0%, 100% { box-shadow: 0 0 8px ${C.red}20 }
          50% { box-shadow: 0 0 22px ${C.red}40 }
        }
      `}</style>

      {/* ── SECTION 1: Predictive Failure Timeline ───────────────── */}
      <section>{renderTimeline()}</section>

      {/* ── SECTIONS 2 & 3: Correlation + Decisions ──────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">{renderCorrelation()}</div>
        <div className="lg:col-span-2">{renderDecisions()}</div>
      </section>

      {/* ── SECTION 4: Root Cause Analysis ────────────────────────── */}
      <section>{renderRootCause()}</section>

      {/* ── SECTIONS 5 & 6: Cost Intel + Model Perf ──────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>{renderCostIntel()}</div>
        <div>{renderModelPerf()}</div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TAB 2: BRIDGE INTELLIGENCE (RAG Q&A)
   ═══════════════════════════════════════════════════════════════════════════ */
const STARTER_CHIPS = [
  "Which bridges need immediate repair?",
  "What is causing Godavari Bridge degradation?",
  "Show me all critical bridges in Maharashtra",
  "Which bridge has the highest vibration reading?",
  "Estimate repair cost for all critical bridges",
];

function BridgeIntelligenceTab() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [referencedBridges, setReferencedBridges] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportReport = async () => {
    setIsExporting(true);
    try {
      const t = localStorage.getItem('bridgeiq_token') || '';
      const response = await fetch(`${API}/reports/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${t}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }
      
      const blob = await response.blob();
      
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');
        
      const filename = `bridge-intelligence-report-${timestamp}.pdf`;
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[export-chat-report-error]', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const chatEndRef = useCallback((node) => { if (node) node.scrollIntoView({ behavior: 'smooth' }); }, []);

  // Fetch bridge data on mount
  useEffect(() => {
    const fetchBridges = async () => {
      try {
        const data = await api('/india/bridges');
        setBridges(data || []);
      } catch (e) {
        console.error('[bridge-intel] fetch error', e);
      }
    };
    fetchBridges();
    const iv = setInterval(fetchBridges, 60000);
    return () => clearInterval(iv);
  }, []);

  // Parse AI response to find referenced bridge names
  const extractReferencedBridges = useCallback((text) => {
    if (!bridges.length || !text) return [];
    const found = [];
    const lower = text.toLowerCase();
    for (const b of bridges) {
      if (b.name && lower.includes(b.name.toLowerCase())) {
        found.push(b);
      }
    }
    // If none found explicitly, show top critical bridges
    if (found.length === 0) {
      return [...bridges]
        .sort((a, b) => (a.health_score ?? 100) - (b.health_score ?? 100))
        .slice(0, 3);
    }
    return found.slice(0, 8);
  }, [bridges]);

  // Get top sensor for a bridge
  const getTopSensor = (b) => {
    const sensors = [
      { name: 'Vibration', value: b.vibration, unit: 'g', threshold: SENSOR_THRESHOLDS.vibration.crit },
      { name: 'Strain', value: b.strain, unit: 'MPa', threshold: SENSOR_THRESHOLDS.strain.crit },
      { name: 'Crack Gap', value: b.crack_gap, unit: 'mm', threshold: SENSOR_THRESHOLDS.crack_gap.crit },
      { name: 'Water Level', value: b.water_level, unit: 'm', threshold: SENSOR_THRESHOLDS.water_level.crit },
    ];
    // Return the sensor with the highest ratio to its threshold
    let top = sensors[0];
    let maxRatio = 0;
    for (const s of sensors) {
      const ratio = (s.value || 0) / s.threshold;
      if (ratio > maxRatio) {
        maxRatio = ratio;
        top = s;
      }
    }
    return top;
  };

  const getHealthTier = (score) => {
    if (score < 50) return { label: 'Critical', color: '#ef4444', bg: '#ef444418' };
    if (score < 75) return { label: 'Monitor', color: '#f59e0b', bg: '#f59e0b18' };
    return { label: 'Healthy', color: '#10b981', bg: '#10b98118' };
  };

  const sendMessage = async (text) => {
    const userMsg = text.trim();
    if (!userMsg) return;

    setShowChips(false);
    const newUserMessage = { role: 'user', content: userMsg, time: new Date() };
    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API}/chat/bridge-intelligence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, bridges: bridges })
      });

      const data = await response.json();
      const reply = data.answer || 'No response received.';

      const aiMessage = { role: 'assistant', content: reply, time: new Date() };
      setMessages(prev => [...prev, aiMessage]);
      setReferencedBridges(extractReferencedBridges(reply));
    } catch (err) {
      console.error('[rag-chat]', err);
      const errMsg = { role: 'assistant', content: `Request failed: ${err.message}. Please check your connection and try again.`, time: new Date() };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Render ──
  return (
    <div className="animate-fade-in-up" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div
        className="rounded-xl p-5 mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style={{ background: C.card, border: `1px solid ${C.border}` }}
      >
        <div>
          <h1 className="text-[14px] font-extrabold tracking-tight uppercase" style={{ color: C.text1 }}>
            Bridge intelligence — AI Q&A
          </h1>
          <p className="text-[11px] mt-1" style={{ color: C.text3 }}>
            Ask questions about bridge health, sensors, risk, and maintenance — powered by RAG + Llama 3.3
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
            style={{ color: C.green, background: `${C.green}12`, border: `1px solid ${C.green}30` }}
          >
            <Pulse color={C.green} s={5} />
            {bridges.length} Bridges Live
          </span>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Left: Chat (60%) */}
        <div className="lg:col-span-3 flex flex-col" style={{ minHeight: 520 }}>
          <div
            className="flex-1 rounded-xl flex flex-col overflow-hidden"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            {/* Chat Header with Export Button */}
            <div
              className="px-5 py-3 flex items-center justify-between border-b"
              style={{ borderBottom: `1px solid ${C.border}`, background: C.cardAlt }}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: C.purple, animation: 'aio-pulse-purple 2.5s ease-in-out infinite' }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.text2 }}>
                  AI Assistant Chat Session
                </span>
              </div>
              {messages.some(m => m.role === 'assistant') && (
                <button
                  onClick={handleExportReport}
                  disabled={isExporting}
                  className="px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5"
                  style={{
                    background: '#1C1F26',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {isExporting ? (
                    <>
                      <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full" />
                      Generating...
                    </>
                  ) : (
                    'Export report'
                  )}
                </button>
              )}
            </div>

            {/* Chat Messages Area */}
            <div
              className="flex-1 overflow-y-auto p-5 space-y-4"
              style={{ maxHeight: 440, minHeight: 340 }}
            >
              {messages.length === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center h-full gap-4 pb-10 pt-[2rem]">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{ background: `${C.purple}14`, border: `1px solid ${C.purple}25` }}
                  >
                    <Brain size={24} color={C.purple} />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold" style={{ color: C.text1 }}>Bridge Intelligence AI</p>
                    <p className="text-[11px] mt-1 max-w-xs" style={{ color: C.text3 }}>
                      Ask me anything about bridge health, sensor anomalies, risk predictions, or maintenance planning.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className="max-w-[85%] rounded-xl px-4 py-3"
                    style={{
                      background: msg.role === 'user'
                        ? '#1C1F26'
                        : C.cardAlt,
                      color: msg.role === 'user' ? '#ffffff' : C.text1,
                      border: msg.role === 'user' ? 'none' : `1px solid ${C.border}`,
                    }}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: C.purple }}>
                          Bridge intelligence AI
                        </span>
                        <span className="text-[8px]" style={{ color: C.text4 }}>
                          {formatTime(msg.time)}
                        </span>
                      </div>
                    )}
                    <div
                      className="text-[12px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        fontWeight: msg.role === 'user' ? 500 : 400,
                        lineHeight: '1.6',
                      }}
                    >
                      {msg.content}
                    </div>
                    {msg.role === 'user' && (
                      <div className="flex justify-end mt-1">
                        <span className="text-[8px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {formatTime(msg.time)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div
                    className="rounded-xl px-4 py-3"
                    style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}
                  >
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Starter Chips */}
            {showChips && messages.length === 0 && (
              <div
                className="px-5 pb-3"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  justifyContent: 'center',
                  padding: '0 16px 12px'
                }}
              >
                {STARTER_CHIPS.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(chip)}
                    className="rounded-full cursor-pointer font-semibold transition-all"
                    style={{
                      color: C.purple,
                      background: `${C.purple}08`,
                      border: `1px solid ${C.purple}30`,
                      padding: '8px 14px',
                      fontSize: '13px',
                      height: '36px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${C.purple}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${C.purple}08`; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div
              className="p-3 flex items-center gap-2"
              style={{ borderTop: `1px solid ${C.border}`, background: C.cardAlt }}
            >
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about bridge health, sensors, risks..."
                disabled={isTyping}
                className="flex-1 text-[12px] px-4 py-2.5 rounded-lg outline-none disabled:opacity-50"
                style={{
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  color: C.text1,
                }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isTyping || !input.trim()}
                className="px-4 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                style={{
                  background: '#1C1F26',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                {isTyping ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Context Panel (40%) */}
        <div className="lg:col-span-2 flex flex-col gap-5">

          {/* Referenced Bridges */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <h3
              className="text-[11px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
              style={{ color: C.text1 }}
            >
              <span style={{ color: C.purple }}>◆</span> Referenced Bridges
            </h3>

            {referencedBridges.length === 0 ? (
              <div className="text-center py-6">
                <div
                  className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-lg mb-3"
                  style={{ background: `${C.purple}10`, border: `1px solid ${C.purple}20` }}
                >
                  <Search size={18} color={C.purple} />
                </div>
                <p className="text-[11px]" style={{ color: C.text3 }}>
                  Ask a question to see which bridges are referenced in the response.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {[...referencedBridges]
                  .sort((a, b) => {
                    const getPrio = (bridge) => {
                      const score = bridge.health_score ?? 100;
                      if (score < 50) return 0;
                      if (score < 75) return 1;
                      return 2;
                    };
                    const prioA = getPrio(a);
                    const prioB = getPrio(b);
                    if (prioA !== prioB) return prioA - prioB;
                    return (a.health_score ?? 100) - (b.health_score ?? 100);
                  })
                  .map((b, i) => {
                  const topSensor = getTopSensor(b);
                  return (
                    <div
                      key={i}
                      className="p-3 rounded-lg flex items-center justify-between gap-2"
                      style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold truncate" style={{ color: C.text1 }}>
                          {b.name}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ color: C.text3 }}>
                          {topSensor.name}: {(topSensor.value ?? 0).toFixed(2)} {topSensor.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono font-medium" style={{ color: C.text1 }}>
                          {formatHealthScore(b.health_score)}<span className="text-[10px]" style={{ color: C.text3 }}>/100</span>
                        </span>
                        <StatusBadge healthScore={b.health_score ?? 100} size="sm" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Data Sources */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <h3
              className="text-[11px] font-bold uppercase tracking-wider mb-4 flex items-center gap-2"
              style={{ color: C.text1 }}
            >
              <span style={{ color: C.green }}>◆</span> Data Sources
            </h3>
            <div className="space-y-2.5">
              {[
                { label: 'Live sensor readings', icon: '' },
                { label: 'AI risk scores', icon: '' },
                { label: 'Historical trends', icon: '' },
                { label: 'Maintenance records', icon: '' },
              ].map((src, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-lg"
                  style={{ background: C.cardAlt, border: `1px solid ${C.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{src.icon}</span>
                    <span className="text-[11px] font-semibold" style={{ color: C.text2 }}>
                      {src.label}
                    </span>
                  </div>
                  <span
                    className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: C.green, background: `${C.green}14`, border: `1px solid ${C.green}25` }}
                  >
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Network Summary */}
          <div
            className="rounded-xl p-5"
            style={{ background: C.card, border: `1px solid ${C.border}` }}
          >
            <h3
              className="text-[11px] font-bold uppercase tracking-wider mb-3 flex items-center gap-2"
              style={{ color: C.text1 }}
            >
              <span style={{ color: C.blue }}>◆</span> Network Summary
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {(() => {
                const crit = bridges.filter(b => (b.health_score ?? 100) < 50).length;
                const mon = bridges.filter(b => (b.health_score ?? 100) >= 50 && (b.health_score ?? 100) < 75).length;
                const ok = bridges.filter(b => (b.health_score ?? 100) >= 75).length;
                return [
                  { label: 'Critical', count: crit, color: C.red },
                  { label: 'Monitor', count: mon, color: C.yellow },
                  { label: 'Healthy', count: ok, color: C.green },
                ];
              })().map((item, i) => (
                <div
                  key={i}
                  className="text-center p-2.5 rounded-lg"
                  style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}
                >
                  <p className="text-[16px] font-extrabold font-mono" style={{ color: item.color }}>
                    {item.count}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: item.color }}>
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT: AI INTELLIGENCE CENTER (UNIFIED)
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AIIntelligenceCenter() {
  const [activeTab, setActiveTab] = useState('aiops'); // 'aiops' or 'federated'

  return (
    <div className="space-y-6">
      {/* Pill-Style Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit">
          <button
            onClick={() => setActiveTab('aiops')}
            style={{ transition: 'all 0.2s ease' }}
            className={`px-4 py-1.5 rounded-md font-bold uppercase tracking-wider text-[10px] cursor-pointer ${
              activeTab === 'aiops'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 bg-transparent'
            }`}
          >
            AIOps operations
          </button>
          <button
            onClick={() => setActiveTab('federated')}
            style={{ transition: 'all 0.2s ease' }}
            className={`px-4 py-1.5 rounded-md font-bold uppercase tracking-wider text-[10px] cursor-pointer ${
              activeTab === 'federated'
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 bg-transparent'
            }`}
          >
            Bridge intelligence
          </button>
        </div>

        {activeTab === 'aiops' && (
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest"
              style={{
                color: C.purple,
                background: `${C.purple}12`,
                border: `1px solid ${C.purple}35`,
                animation: 'aio-pulse-purple 2.5s ease-in-out infinite',
              }}
            >
              <Pulse color={C.purple} s={5} />
              Autonomous Mode
            </span>
          </div>
        )}
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {activeTab === 'aiops' ? (
          <AIOpsOperationsTab onSwitchTab={setActiveTab} />
        ) : (
          <BridgeIntelligenceTab />
        )}
      </div>
    </div>
  );
}
