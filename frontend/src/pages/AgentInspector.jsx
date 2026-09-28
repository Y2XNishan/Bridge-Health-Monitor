import { useState, useEffect, useRef } from 'react';
import { SENSOR_THRESHOLDS } from '../constants/thresholds';
import StatusBadge, { formatHealthScore } from '../components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import ReactMarkdown from 'react-markdown';
import { 
  Bot, 
  Play, 
  CheckCircle, 
  Loader2, 
  Download, 
  AlertTriangle, 
  Droplet, 
  Activity, 
  AlertCircle, 
  FileText, 
  ChevronRight,
  Sparkles
} from 'lucide-react';


const STAGES = [
  { id: 'fetch', label: 'Fetching live sensor data...' },
  { id: 'anomaly', label: 'Analyzing anomaly scores...' },
  { id: 'rag', label: 'Searching IRC standards...' },
  { id: 'llm', label: 'Generating inspection report...' }
];

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Critical', color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
  MONITOR: { label: 'Monitor', color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
  HEALTHY: { label: 'Healthy', color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' }
};

const markdownComponents = {
  h1: ({ node, ...props }) => <h2 className="text-lg font-black mt-6 mb-3 text-[var(--text-primary)]" {...props} />,
  h2: ({ node, ...props }) => (
    <h3 className="text-base font-extrabold mt-5 mb-2.5 text-[var(--text-primary)] flex items-center gap-2">
      <Sparkles size={14} className="text-[var(--accent-blue)]" />
      {props.children}
    </h3>
  ),
  h3: ({ node, ...props }) => (
    <h4 className="text-sm font-bold mt-4 mb-2 text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-1 flex items-center gap-1.5">
      <ChevronRight size={12} className="text-[var(--accent-blue)]" />
      {props.children}
    </h4>
  ),
  p: ({ node, ...props }) => <p className="text-xs text-[var(--text-secondary)] leading-relaxed my-2" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-2 space-y-1.5" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-2 list-decimal ml-6 space-y-1.5" {...props} />,
  li: ({ node, ...props }) => (
    <li className="flex items-start gap-2 ml-4 my-1.5 list-none">
      <span className="text-[var(--accent-blue)] mt-0.5">•</span>
      <span className="text-xs text-[var(--text-secondary)] leading-relaxed flex-1">
        {props.children}
      </span>
    </li>
  ),
  strong: ({ node, ...props }) => <strong className="font-bold text-[var(--text-primary)]" {...props} />
};

function CollapsibleSection({ title, content }) {
  const [isOpen, setIsOpen] = useState(true);
  
  if (!title) {
    return (
      <ReactMarkdown components={markdownComponents}>
        {content}
      </ReactMarkdown>
    );
  }
  
  return (
    <div className="border-b border-[var(--border-subtle)] pb-2 mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 text-left font-bold text-xs uppercase tracking-wider text-[var(--text-primary)] hover:opacity-85 transition cursor-pointer font-sans"
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            size={14}
            className="text-[var(--accent-blue)] transition-transform duration-300"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          />
          <span>{title}</span>
        </div>
      </button>
      <div
        className="transition-all duration-300 overflow-hidden"
        style={{
          maxHeight: isOpen ? '1000px' : '0px',
          opacity: isOpen ? 1 : 0,
          marginTop: isOpen ? '8px' : '0px',
        }}
      >
        <ReactMarkdown components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

const parseReportSections = (reportText) => {
  if (!reportText) return [];
  const parts = reportText.split(/(?=### )/g);
  const sections = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("### ")) {
      const lines = trimmed.split("\n");
      const title = lines[0].replace("### ", "").trim();
      const content = lines.slice(1).join("\n").trim();
      sections.push({ title, content });
    } else {
      sections.push({ title: "", content: trimmed });
    }
  }
  return sections;
};

const getTodayDateFormatted = () => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const mapAlertLevel = (level) => {
  if (!level) return 'HEALTHY';
  const val = level.toUpperCase();
  if (val === 'NORMAL') return 'HEALTHY';
  if (val === 'WATCH' || val === 'WARNING') return 'MONITOR';
  return val;
};

export default function AgentInspector() {
  const [bridges, setBridges] = useState([]);
  const [selectedBridgeId, setSelectedBridgeId] = useState('');
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(-1);
  const [inspectionResult, setInspectionResult] = useState(null);
  const [error, setError] = useState(null);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  
  // Animated score display for progress ring
  const [displayScore, setDisplayScore] = useState(0);
  const animRef = useRef(null);
  
  // Fetch all 58 bridges on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/india/bridges`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBridges(data);
        if (data.length > 0) {
          setSelectedBridgeId(data[0].id);
          setSelectedBridge(data[0]);
        }
      })
      .catch((err) => {
        console.error('[agent-inspector-fetch-bridges]', err);
        setError('Failed to load bridges list.');
      });
  }, []);

  // Update selected bridge details when selector changes
  const handleBridgeChange = (e) => {
    const id = Number(e.target.value);
    setSelectedBridgeId(id);
    const bridge = bridges.find(b => b.id === id);
    setSelectedBridge(bridge);
  };

  // Run AI agent inspection
  const handleRunInspection = async () => {
    if (!selectedBridge) return;
    setLoading(true);
    setError(null);
    setInspectionResult(null);
    setCurrentStageIndex(0);

    // Sequence stages animation
    const stageTimers = [];
    const advanceStage = (index) => {
      if (index < STAGES.length - 1) {
        stageTimers.push(
          setTimeout(() => {
            setCurrentStageIndex(index + 1);
            advanceStage(index + 1);
          }, 1200)
        );
      }
    };
    advanceStage(0);

    try {
      console.log("Selected Bridge:", selectedBridge);
      const token = localStorage.getItem('bridgeiq_token');
      const response = await fetch(`${API_BASE}/api/agent/inspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bridge_id: selectedBridge.id, bridge_name: selectedBridge.name })
      });
      if (response.status === 401) {
        throw new Error("Please logout and login again to refresh your session.");
      }
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = await response.json();
      // Wait a brief moment if the API completed faster than animations to ensure steps show up
      await new Promise(resolve => setTimeout(resolve, 800));
      setInspectionResult(result);
    } catch (err) {
      console.error('[run-inspection-error]', err);
      setError(err.message || 'AI Inspection Agent failed to complete. Please ensure your GROQ_API_KEY is configured.');
    } finally {
      stageTimers.forEach(clearTimeout);
      setLoading(false);
      setCurrentStageIndex(-1);
    }
  };

  // Animate circular health score ring
  useEffect(() => {
    if (!inspectionResult) return;
    const score = inspectionResult.health_score ?? 0;
    let start = 0;
    const duration = 1000;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      setDisplayScore(start + (score - start) * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayScore(score);
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [inspectionResult]);

  // Download report PDF
  const handleDownloadPDF = async () => {
    if (!inspectionResult) return;
    setDownloadingPDF(true);
    try {
      const token = localStorage.getItem('bridgeiq_token');
      const response = await fetch(`${API_BASE}/api/agent/inspect/pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(inspectionResult)
      });
      if (response.status === 401) {
        throw new Error("Please logout and login again to refresh your session.");
      }
      if (!response.ok) throw new Error(`PDF endpoint returned ${response.status}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `AI_Inspection_Report_${inspectionResult.bridge_name}_${date}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[download-pdf-error]', err);
      alert('Failed to download PDF report.');
    } finally {
      setDownloadingPDF(false);
    }
  };



  // Circle progress ring math
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const healthScore = inspectionResult?.health_score ?? 0;
  const pct = healthScore / 100;
  const offset = circumference - pct * circumference;

  const severityCfg = inspectionResult 
    ? (healthScore >= 60 ? SEVERITY_CONFIG.HEALTHY : (healthScore >= 40 ? SEVERITY_CONFIG.MONITOR : SEVERITY_CONFIG.CRITICAL))
    : SEVERITY_CONFIG.HEALTHY;

  const vib = inspectionResult?.sensor_summary?.vibration ?? 0;
  const str = inspectionResult?.sensor_summary?.strain ?? 0;
  const crk = inspectionResult?.sensor_summary?.crack_gap ?? 0;
  const anom = selectedBridge?.anomaly_score ?? 0;

  const hasExceeded = 
    vib > SENSOR_THRESHOLDS.vibration.crit ||
    str > SENSOR_THRESHOLDS.strain.crit ||
    crk > SENSOR_THRESHOLDS.crack_gap.crit ||
    anom > 0.5;

  const displayIssues = [];
  if (inspectionResult) {
    if (anom > 0.5) {
      displayIssues.push(`Anomaly score ${anom} detected — further investigation required`);
    }
    if (vib > SENSOR_THRESHOLDS.vibration.crit) {
      displayIssues.push(`Vibration exceeds threshold: ${vib}g`);
    }
    if (str > SENSOR_THRESHOLDS.strain.crit) {
      displayIssues.push(`Strain exceeds threshold: ${str}MPa`);
    }
    if (crk > SENSOR_THRESHOLDS.crack_gap.crit) {
      displayIssues.push(`Crack gap exceeds threshold: ${crk}mm`);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up" style={{ color: 'var(--text-primary)' }}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Bot size={20} color="#0F6E56" />
            Agentic bridge inspector
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            AI-powered automatic inspection using RAG + Llama 3.3
          </p>
        </div>
      </div>

      {/* Main Glass Control Panel */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="flex-1 w-full space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>
            Select Bridge for Inspection
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={selectedBridgeId}
              onChange={handleBridgeChange}
              disabled={loading}
              className="flex-1 h-11 rounded-lg px-4 text-xs font-semibold focus:outline-none focus:border-[var(--accent-teal)] cursor-pointer transition"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {bridges.map((b) => (
                <option key={b.id} value={b.id} style={{ background: 'var(--bg-primary)' }}>
                  {b.name} ({b.location || `${b.city}, ${b.state}`})
                </option>
              ))}
            </select>

            <button
              onClick={handleRunInspection}
              disabled={loading || !selectedBridge}
              className="h-11 px-6 rounded-lg flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              style={{
                background: '#1C1F26',
                color: 'white',
                border: 'none',
              }}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={14} fill="white" />
              )}
              {loading ? 'Analyzing...' : 'Run Inspection'}
            </button>
          </div>
          {selectedBridge && (
            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>
              {selectedBridge.name} • {selectedBridge.type || 'Beam'} Type • Built in {selectedBridge.year_built || 'N/A'} • {selectedBridge.length_m || 'N/A'}m Length • {selectedBridge.state || 'N/A'} • Last Inspected: {getTodayDateFormatted()}
            </p>
          )}
        </div>
      </div>

      {/* Loading State Animation */}
      {loading && (
        <div className="glass-card p-8 flex flex-col items-center justify-center text-center space-y-6">
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--border-subtle)] animate-pulse" />
            <Loader2 size={32} className="animate-spin text-[var(--accent-blue)]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-primary)]">
              AI Bridge Inspector in Progress
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Analyzing structural health data, comparing design limit standards, and generating report.
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3 pt-4">
            {STAGES.map((stage, idx) => {
              const isActive = currentStageIndex === idx;
              const isCompleted = idx < currentStageIndex;
              return (
                <div 
                  key={stage.id}
                  className="flex items-center gap-3 p-3 rounded-xl border transition-all duration-300"
                  style={{
                    background: isActive ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                    borderColor: isActive ? 'var(--accent-blue-light)' : 'var(--border-subtle)',
                    opacity: isCompleted || isActive ? 1 : 0.4
                  }}
                >
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle size={16} className="text-[var(--accent-green-light)]" />
                    ) : isActive ? (
                      <Loader2 size={16} className="animate-spin text-[var(--accent-blue-light)]" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-[var(--text-muted)]" />
                    )}
                  </div>
                  <span className="text-xs font-semibold" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="glass-card p-6 flex items-center gap-4 border-l-4 border-l-[var(--accent-red)]">
          <AlertCircle className="text-[var(--accent-red)]" size={24} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Inspection Failed</h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          </div>
        </div>
      )}

      {/* Inspection Results Dashboard */}
      {inspectionResult && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {/* Severity & Metrics Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Overall Status & Severity Badge */}
            <div 
              className="glass-card p-6 flex flex-col items-center text-center space-y-4 relative overflow-hidden"
              style={{ borderTop: `4px solid ${severityCfg.color}` }}
            >
              <StatusBadge status={severityCfg.label} />

              {/* Circular Health progress ring */}
              <div className="relative flex items-center justify-center mt-2">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke="#161b22"
                    strokeWidth="10"
                    strokeDasharray="2 6"
                    className="opacity-20"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={severityCfg.color}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform="rotate(-90 80 80)"
                    style={{
                      transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
                    }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-black tracking-tight" style={{ color: severityCfg.color }}>
                    {formatHealthScore(displayScore)}
                    <span className="text-xs font-semibold text-slate-500 ml-0.5">/100</span>
                  </span>
                  <span className="text-[9px] uppercase font-bold text-[var(--text-muted)]">Health Score</span>
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">{inspectionResult.bridge_name}</h3>
                <p className="text-[10px] text-[var(--text-secondary)]">Bridge ID: {inspectionResult.bridge_id} • Alert Level: {severityCfg.label}</p>
              </div>
            </div>

            {/* 4 Sensor Telemetry Cards */}
            <div className="space-y-4">
              <h3 className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>
                Sensor Readings Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    name: 'Vibration',
                    val: inspectionResult.sensor_summary?.vibration,
                    unit: 'g',
                    limit: `${SENSOR_THRESHOLDS.vibration.crit}g`,
                    icon: Activity,
                    alert: inspectionResult.sensor_summary?.vibration > SENSOR_THRESHOLDS.vibration.warn
                  },
                  {
                    name: 'Strain',
                    val: inspectionResult.sensor_summary?.strain,
                    unit: 'MPa',
                    limit: `${SENSOR_THRESHOLDS.strain.crit}MPa`,
                    icon: Bot,
                    alert: inspectionResult.sensor_summary?.strain > SENSOR_THRESHOLDS.strain.warn
                  },
                  {
                    name: 'Crack Gap',
                    val: inspectionResult.sensor_summary?.crack_gap,
                    unit: 'mm',
                    limit: `${SENSOR_THRESHOLDS.crack_gap.crit}mm`,
                    icon: AlertTriangle,
                    alert: inspectionResult.sensor_summary?.crack_gap > SENSOR_THRESHOLDS.crack_gap.warn
                  },
                  {
                    name: 'Water Level',
                    val: inspectionResult.sensor_summary?.water_level,
                    unit: 'm',
                    limit: `${SENSOR_THRESHOLDS.water_level.crit}m`,
                    icon: Droplet,
                    alert: inspectionResult.sensor_summary?.water_level > SENSOR_THRESHOLDS.water_level.warn
                  }
                ].map((sensor) => {
                  const Icon = sensor.icon;
                  return (
                    <div 
                      key={sensor.name} 
                      className="glass-card p-4 flex flex-col justify-between"
                      style={{
                        borderLeft: sensor.alert 
                          ? `3px solid ${sensor.val > parseFloat(sensor.limit) ? '#EF4444' : '#F59E0B'}` 
                          : '1px solid var(--border-subtle)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] uppercase font-bold text-[var(--text-muted)]">{sensor.name}</span>
                        <Icon size={14} className={sensor.alert ? 'text-[var(--accent-yellow)]' : 'text-[var(--text-muted)]'} />
                      </div>
                      <div className="mt-2.5">
                        <span className="text-lg font-black">{sensor.val !== undefined ? sensor.val.toFixed(3) : 'N/A'}</span>
                        <span className="text-[10px] ml-0.5 text-[var(--text-secondary)]">{sensor.unit}</span>
                      </div>
                      <span className="text-[8px] font-mono text-[var(--text-muted)] block mt-1">Limit: {sensor.limit}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Issues Section */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-3">
                <AlertCircle className="text-[var(--accent-red)]" size={16} />
                <h3 className="text-xs uppercase tracking-wider font-bold">Issues Detected</h3>
              </div>
              {hasExceeded ? (
                <div className="space-y-2.5">
                  {displayIssues.map((issue, i) => (
                    <div 
                      key={i} 
                      className="p-3 rounded-lg text-xs leading-relaxed border flex items-start gap-2.5"
                      style={{
                        background: 'rgba(239, 68, 68, 0.05)',
                        borderColor: 'rgba(239, 68, 68, 0.2)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] shrink-0 mt-1.5" />
                      <p className="flex-1">{issue}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 text-center text-xs font-medium text-[var(--text-muted)]">
                  No critical issues detected
                </div>
              )}
            </div>
          </div>

          {/* AI PDF Report Column Right side (takes 2 span columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card p-6 flex flex-col justify-between min-h-[500px]">
              {/* Header and Download Button */}
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="text-[var(--accent-blue)]" size={18} />
                  <h2 className="text-sm font-extrabold uppercase tracking-wider">
                    Full AI Inspection Report (RAG + Llama 3.3)
                  </h2>
                </div>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloadingPDF}
                  className="h-9 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {downloadingPDF ? (
                    <Loader2 size={12} className="animate-spin text-[var(--text-secondary)]" />
                  ) : (
                    <Download size={12} />
                  )}
                  {downloadingPDF ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </div>

              {/* Inline Formatted Report Text */}
              <div className="flex-1 overflow-y-auto max-h-[600px] pr-2 space-y-3 font-sans">
                {inspectionResult.full_report && 
                  parseReportSections(inspectionResult.full_report).map((section, idx) => (
                    <CollapsibleSection
                      key={idx}
                      title={section.title}
                      content={section.content}
                    />
                  ))
                }
              </div>

              {/* Recommendations list */}
              {inspectionResult.recommendations?.length > 0 && (
                <div className="mt-6 border-t border-[var(--border-subtle)] pt-4 space-y-3">
                  <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-2 text-[var(--text-primary)]">
                    <FileText size={14} className="text-slate-600" />
                    Recommendations and actions summary
                  </h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    {inspectionResult.recommendations.map((rec, i) => (
                      <div 
                        key={i}
                        className="p-3 rounded-lg border text-xs flex items-start gap-3"
                        style={{
                          background: 'rgba(59,130,246,0.03)',
                          borderColor: 'var(--border-subtle)'
                        }}
                      >
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black font-mono" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--accent-blue-light)' }}>
                          {i + 1}
                        </span>
                        <p className="flex-1 mt-0.5 leading-relaxed text-[var(--text-secondary)]">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
