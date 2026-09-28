import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Activity, AlertTriangle, Search } from 'lucide-react';
import StatusBadge, { formatHealthScore } from '../components/StatusBadge';
import { SENSOR_THRESHOLDS } from '../constants/thresholds';
import IndiaMapLeaflet from '../components/IndiaMapLeaflet';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function IndiaNetwork({ onSelectBridge, setCurrentPage }) {
  const { isEngineer } = useAuth();
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState('All');
  
  // Selected interactive pin
  const [selectedPinBridgeId, setSelectedPinBridgeId] = useState(null);

  // Live bridges state list
  const [liveBridgeIds, setLiveBridgeIds] = useState(new Set());

  // Interactive Overlays
  const [showModal, setShowModal] = useState(false);
  const [modalBridge, setModalBridge] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [hoveredBadgeId, setHoveredBadgeId] = useState(null);
  const [toastType, setToastType] = useState('success');

  // Loading & Error states for activation
  const [activating, setActivating] = useState(false);
  const [modalError, setModalError] = useState('');

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // ── Fetch Bridges on Mount ──────────────────
  useEffect(() => {
    fetch(`${API_BASE}/api/india/bridges`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setBridges(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[india-bridges-fetch-error]', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // ── Fetch and Poll live bridge activations ──
  const fetchLiveBridges = () => {
    fetch(`${API_BASE}/api/bridges`)
      .then((res) => res.json())
      .then((data) => {
        setLiveBridgeIds(new Set(data.map((b) => b.id)));
      })
      .catch((err) => console.error('[fetch-live-bridges-error]', err));
  };

  useEffect(() => {
    fetchLiveBridges();
    const interval = setInterval(fetchLiveBridges, 10000);
    return () => clearInterval(interval);
  }, []);

  // Extract unique states list for filter dropdown
  const statesList = useMemo(() => {
    const states = new Set(bridges.map((b) => b.state));
    return ['All', ...Array.from(states).sort()];
  }, [bridges]);

  // Filter and sort bridges logic
  const filteredBridges = useMemo(() => {
    let result = [...bridges];

    // Search query filter (by name or state)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.state.toLowerCase().includes(q) ||
          (b.city && b.city.toLowerCase().includes(q))
      );
    }

    // State filter
    if (selectedState !== 'All') {
      result = result.filter((b) => b.state === selectedState);
    }

    // Grade/Tier filter
    if (selectedGrade !== 'All') {
      if (selectedGrade === 'Critical') {
        result = result.filter((b) => b.health_score < 50);
      } else if (selectedGrade === 'Monitor') {
        result = result.filter((b) => b.health_score >= 50 && b.health_score < 75);
      } else if (selectedGrade === 'Healthy') {
        result = result.filter((b) => b.health_score >= 75);
      }
    }

    // Default sort: health score ascending (worst first)
    return result.sort((a, b) => a.health_score - b.health_score);
  }, [bridges, searchTerm, selectedState, selectedGrade]);

  const getPinColor = (healthScore) => {
    if (healthScore >= 75) return '#0F6E56'; // Healthy teal
    if (healthScore >= 50) return '#D97706'; // Monitor amber
    return '#991B1B'; // Critical red
  };

  const getTopAlertText = (bridge) => {
    if (!bridge.alert_count || bridge.alert_count === 0) {
      return "No active alerts";
    }

    const sensorStatuses = [];

    // Vibration
    if (bridge.vibration > 1.2) {
      sensorStatuses.push({ sensor: "Vibration", level: "CRITICAL", severity: 3 });
    } else if (bridge.vibration > 0.9) {
      sensorStatuses.push({ sensor: "Vibration", level: "WARNING", severity: 2 });
    } else if (bridge.vibration > 0.6) {
      sensorStatuses.push({ sensor: "Vibration", level: "WATCH", severity: 1 });
    }

    // Strain
    if (bridge.strain > 210) {
      sensorStatuses.push({ sensor: "Strain", level: "CRITICAL", severity: 3 });
    } else if (bridge.strain > 190) {
      sensorStatuses.push({ sensor: "Strain", level: "WARNING", severity: 2 });
    } else if (bridge.strain > 170) {
      sensorStatuses.push({ sensor: "Strain", level: "WATCH", severity: 1 });
    }

    // Crack Gap per IRC:112-2011 Table 12.1
    const crackCrit = SENSOR_THRESHOLDS.crack_gap.crit; // 0.30 mm
    const crackWarn = SENSOR_THRESHOLDS.crack_gap.warn; // 0.20 mm
    const crackMid = (crackCrit + crackWarn) / 2;       // 0.25 mm
    if (bridge.crack_gap > crackCrit) {
      sensorStatuses.push({ sensor: "Crack Gap", level: "CRITICAL", severity: 3 });
    } else if (bridge.crack_gap > crackMid) {
      sensorStatuses.push({ sensor: "Crack Gap", level: "WARNING", severity: 2 });
    } else if (bridge.crack_gap > crackWarn) {
      sensorStatuses.push({ sensor: "Crack Gap", level: "WATCH", severity: 1 });
    }

    // Water Level
    const waterCrit = SENSOR_THRESHOLDS.water_level.crit;
    const waterWarn = SENSOR_THRESHOLDS.water_level.warn;
    if (bridge.water_level > waterCrit) {
      sensorStatuses.push({ sensor: "Water Level", level: "CRITICAL", severity: 3 });
    } else if (bridge.water_level > 5.0) {
      sensorStatuses.push({ sensor: "Water Level", level: "WARNING", severity: 2 });
    } else if (bridge.water_level > waterWarn) {
      sensorStatuses.push({ sensor: "Water Level", level: "WATCH", severity: 1 });
    }

    if (sensorStatuses.length > 0) {
      sensorStatuses.sort((a, b) => b.severity - a.severity);
      const top = sensorStatuses[0];
      return `Top alert: ${top.sensor} — ${top.level}`;
    }

    // Fallback based on relative threshold ratio if alert_count > 0
    const ratios = [
      { name: "Vibration", ratio: (bridge.vibration || 0) / SENSOR_THRESHOLDS.vibration.crit },
      { name: "Strain", ratio: (bridge.strain || 0) / SENSOR_THRESHOLDS.strain.crit },
      { name: "Crack Gap", ratio: (bridge.crack_gap || 0) / SENSOR_THRESHOLDS.crack_gap.crit },
      { name: "Water Level", ratio: (bridge.water_level || 0) / SENSOR_THRESHOLDS.water_level.crit }
    ];
    ratios.sort((a, b) => b.ratio - a.ratio);

    const topRatio = ratios[0];
    const level = topRatio.ratio > 0.8 ? "WARNING" : "WATCH";
    return `Top alert: ${topRatio.name} — ${level}`;
  };

  // Card click navigates or triggers modal
  const handleCardClick = (bridge) => {
    setModalBridge(bridge);
    setModalError('');
    setActivating(false);
    setShowModal(true);
  };

  // Map pin click scrolls or highlights card below
  const handlePinClick = (bridge) => {
    setSelectedPinBridgeId(bridge.id);
    const element = document.getElementById(`bridge-card-${bridge.id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-1', 'ring-cyan-500/50');
      setTimeout(() => {
        element.classList.remove('ring-1', 'ring-cyan-500/50');
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 rounded-full border-4 border-t-2 animate-spin" style={{ borderColor: 'rgba(15, 110, 86, 0.2)', borderTopColor: '#0F6E56' }} />
        <p className="font-medium text-xs tracking-wide animate-pulse" style={{ color: 'var(--text-secondary)' }}>
          Loading India network mapping data…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center max-w-sm mx-auto">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: '#FDF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>Failed to load map</h3>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 text-[10px] font-medium tracking-wide px-4 py-2 rounded-lg transition"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up" style={{ color: 'var(--text-primary)' }}>
      
      {/* ── Status text line ── */}
      <p className="text-xs text-slate-500 font-medium m-0">58 bridges monitored</p>

      {/* ── SECTION 1: INTERACTIVE LEAFLET MAP WITH SURVEY OF INDIA BOUNDARY & CLUSTERING ── */}
      <section className="relative w-full">
        <IndiaMapLeaflet
          bridges={bridges}
          filteredBridges={filteredBridges}
          selectedPinBridgeId={selectedPinBridgeId}
          onSelectBridge={handlePinClick}
          onOpenDetails={handleCardClick}
          liveBridgeIds={liveBridgeIds}
        />
      </section>

      {/* Thin divider line between map and search bar */}
      <div className="w-full h-[1px] my-2" style={{ background: 'var(--border-subtle)' }} />

      {/* ── SECTION 2: CLEAN SINGLE ROW SEARCH & FILTER BAR ── */}
      <div className="max-w-[1200px] mx-auto w-full py-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 w-full text-[10px]">
          
          {/* Search Input takes 40% width */}
          <div className="w-full md:w-[40%] h-10 relative flex items-center">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#8B94A3]"
            />
            <input
              type="text"
              placeholder="Search bridges by name, state, city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full rounded-lg text-[10px] focus:outline-none focus:border-[#0F6E56] transition-all font-sans"
              style={{ 
                paddingLeft: '36px', 
                paddingRight: '12px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border-subtle)', 
                color: 'var(--text-primary)' 
              }}
            />
          </div>

          {/* State Filter dropdown takes 20% width */}
          <div className="w-full md:w-[20%] h-10">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full h-full rounded-lg px-3 text-[10px] focus:outline-none focus:border-[#0F6E56] cursor-pointer transition font-sans"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="All">All states</option>
              {statesList.filter(s => s !== 'All').map((state) => (
                <option key={state} value={state} style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter dropdown takes 20% width */}
          <div className="w-full md:w-[20%] h-10">
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full h-full rounded-lg px-3 text-[10px] focus:outline-none focus:border-[#0F6E56] cursor-pointer transition font-sans"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <option value="All" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>All statuses</option>
              <option value="Critical" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Critical</option>
              <option value="Monitor" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Monitor</option>
              <option value="Healthy" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}>Healthy</option>
            </select>
          </div>

          {/* Results Count takes remaining space (20%), right aligned */}
          <div className="w-full md:w-[20%] h-10 flex items-center justify-end">
            <span 
              className="w-full h-full flex items-center justify-end text-[10px] font-sans tracking-wide px-3 rounded-lg"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Showing <span className="tabular-nums font-mono mx-1">{filteredBridges.length}</span> of <span className="tabular-nums font-mono mx-1">{bridges.length}</span>
            </span>
          </div>

        </div>
      </div>

      {/* ── SECTION 3: BRIDGE CARDS LIST GRID ── */}
      <section className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredBridges.map((bridge) => {
            const pinColor = getPinColor(bridge.health_score);
            const isLive = liveBridgeIds.has(bridge.id);
            
            return (
              <div
                id={`bridge-card-${bridge.id}`}
                key={bridge.id}
                onClick={() => handleCardClick(bridge)}
                className="rounded-xl flex flex-col justify-between cursor-pointer group hover:-translate-y-0.5 relative transition-all duration-200"
                style={{
                  padding: '16px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {/* Pulsing Live Badge top right */}
                {isLive && (
                  <div 
                    className="absolute right-0 top-0 px-2 py-0.5 rounded-bl-lg rounded-tr-xl text-[7px] font-medium tracking-wide flex items-center gap-1"
                    style={{ background: 'var(--status-healthy-bg)', borderBottom: '1px solid var(--border-subtle)', borderLeft: '1px solid var(--border-subtle)', color: 'var(--status-healthy)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--status-healthy)' }} />
                    Live
                  </div>
                )}

                {/* Top metadata info */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xs font-bold group-hover:text-[#0F6E56] transition leading-tight truncate pr-6" style={{ color: 'var(--text-primary)' }}>
                      {bridge.name}
                    </h3>
                  </div>
                  
                  {/* Location (City + State) */}
                  <div className="text-[9.5px] font-sans flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <MapPin size={11} className="text-slate-400 shrink-0" />
                    <span className="truncate">{bridge.city || 'State'}, {bridge.state}</span>
                  </div>

                  {/* River, Type, Year (Hide river if empty or 'None', show only type and year) */}
                  {(() => {
                    const hasRiver = bridge.river && !['none', 'null', 'n/a', ''].includes(String(bridge.river).trim().toLowerCase());
                    const metaText = hasRiver
                      ? `${bridge.river} • ${bridge.type} • `
                      : `${bridge.type} • `;
                    return (
                      <div className="text-[9px] font-sans tracking-tight pt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                        {metaText}
                        <span className="tabular-nums font-mono">{bridge.year_built}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Health progress bar and percent indicator */}
                <div className="space-y-1.5 my-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(0, bridge.health_score))}%`,
                          backgroundColor: pinColor
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold font-sans tabular-nums shrink-0 text-right" style={{ color: pinColor }}>
                      <span className="tabular-nums font-mono font-bold">{formatHealthScore(bridge.health_score)}</span>
                      <span className="text-[9px] text-[var(--text-muted)] font-normal ml-0.5">/100</span>
                    </span>
                  </div>
                </div>

                {/* Status badge + Alerts count row */}
                <div className="flex items-center justify-between pt-2 gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {/* Status Badge */}
                  <StatusBadge healthScore={bridge.health_score} size="sm" />

                   {/* Alert Counter (Compact) */}
                  <div className="shrink-0" style={{ position: 'relative', display: 'inline-block' }}>
                    <div 
                      onMouseEnter={() => setHoveredBadgeId(bridge.id)}
                      onMouseLeave={() => setHoveredBadgeId(null)}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1.5 text-[9px] font-sans cursor-help" 
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span>Alerts</span>
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0"
                        style={{
                          background: bridge.alert_count > 0 ? '#FDF2F2' : '#F1F5F9',
                          borderColor: bridge.alert_count > 0 ? '#FECACA' : '#E2E8F0',
                          color: bridge.alert_count > 0 ? '#991B1B' : '#64748B',
                        }}
                      >
                        <span className="tabular-nums font-mono">{bridge.alert_count}</span>
                      </span>
                    </div>
                    {hoveredBadgeId === bridge.id && (
                      <div 
                        className="alert-tooltip animate-fade-in"
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: '8px',
                          background: '#1C1F26',
                          color: '#ffffff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          whiteSpace: 'nowrap',
                          zIndex: 1000,
                          border: '1px solid #2A2E39',
                          pointerEvents: 'none',
                          fontWeight: '500',
                          fontFamily: 'var(--font-sans)'
                        }}
                      >
                        {getTopAlertText(bridge)}
                        {/* Downward pointing arrow */}
                        <div 
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: 0,
                            height: 0,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '5px solid #1e293b'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Non-live bridge cards have an Activate button at the bottom */}
                {!isLive && (
                  <button
                    disabled={!isEngineer()}
                    title={!isEngineer() ? "Requires engineer access" : ""}
                    onClick={(e) => {
                      e.stopPropagation(); // prevent card click direct navigation
                      setModalBridge(bridge);
                      setModalError('');
                      setActivating(false);
                      setShowModal(true);
                    }}
                    className="mt-3 w-full text-[8.5px] font-medium tracking-wide transition py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                  >
                    Activate live stream
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {filteredBridges.length === 0 && (
          <div 
            className="p-10 text-center rounded-xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <p className="text-xs font-medium tracking-wide" style={{ color: 'var(--text-secondary)' }}>
              No bridges match your current filter parameters.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedState('All');
                setSelectedGrade('All');
              }}
              className="mt-3 text-[10px] font-medium tracking-wide px-4 py-2 rounded-lg transition cursor-pointer"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      {/* ── LIVE INTERACTIVE TELEMETRY CONTROL MODAL ── */}
      {showModal && modalBridge && (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300" style={{ background: 'rgba(241, 245, 249, 0.85)' }}>
          <div 
            className="p-6 rounded-2xl w-full max-w-sm shadow-2xl space-y-4 animate-fade-in-up text-left relative"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Activity size={16} color="#0F6E56" />
              Live telemetry control
            </h3>
            <div className="h-[1px]" style={{ background: 'var(--border-subtle)' }} />
            
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {liveBridgeIds.has(modalBridge.id) ? (
                <>
                  Live monitoring is currently <strong>active</strong> for <span style={{ color: '#0F6E56', fontWeight: 'bold' }}>{modalBridge.name}</span>. Would you like to view the dashboard telemetry stream or deactivate the simulator?
                </>
              ) : (
                <>
                  Activate real-time simulated live sensor feeds and anomaly alert stream monitoring for <span style={{ color: '#1C1F26', fontWeight: 'bold' }}>{modalBridge.name}</span>?
                </>
              )}
            </p>

            {/* Error Message inside the Modal */}
            {modalError && (
              <div 
                className="px-3.5 py-2 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 leading-relaxed animate-fade-in-up"
                style={{ background: '#FDF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
              >
                <AlertTriangle size={13} color="#991B1B" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 text-[10px]">
              {liveBridgeIds.has(modalBridge.id) ? (
                <>
                  <button
                    disabled={activating}
                    onClick={() => {
                      onSelectBridge(modalBridge.id);
                      setCurrentPage('dashboard');
                      setShowModal(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`w-full font-semibold py-2.5 rounded-lg transition-all cursor-pointer hover:opacity-90 ${
                      activating ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    style={{ background: '#1C1F26', color: '#ffffff' }}
                  >
                    Go to dashboard
                  </button>
                  <button
                    disabled={activating || !isEngineer()}
                    title={!isEngineer() ? "Requires engineer access" : ""}
                    onClick={async () => {
                      try {
                        setActivating(true);
                        setModalError('');
                        const res = await fetch(`${API_BASE}/api/bridges/deactivate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bridge_id: modalBridge.id })
                        });
                        if (res.ok) {
                          setLiveBridgeIds(prev => {
                            const next = new Set(prev);
                            next.delete(modalBridge.id);
                            return next;
                          });
                          showToast(`Deactivated monitoring for ${modalBridge.name}`, 'success');
                          setShowModal(false);
                        } else {
                          throw new Error('Deactivation failed — please try again');
                        }
                      } catch (e) {
                        console.error(e);
                        showToast('Deactivation failed — please try again', 'error');
                        setActivating(false);
                      }
                    }}
                    className="w-full font-semibold py-2.5 rounded-lg transition-all cursor-pointer hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={
                      !isEngineer()
                        ? { background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
                        : { background: '#FDF2F2', border: '1px solid #FECACA', color: '#991B1B' }
                    }
                  >
                    {activating ? 'Deactivating...' : 'Deactivate monitoring'}
                  </button>
                </>
              ) : (
                <button
                  disabled={activating || !isEngineer()}
                  title={!isEngineer() ? "Requires engineer access" : ""}
                  onClick={async () => {
                    setActivating(true);
                    setModalError('');
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    try {
                      const res = await fetch(`${API_BASE}/api/bridges/activate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bridge_id: modalBridge.id }),
                        signal: controller.signal
                      });
                      
                      clearTimeout(timeoutId);
                      
                      if (!res.ok) {
                        throw new Error(`Server returned status: ${res.status}`);
                      }
                      
                      const data = await res.json();
                      if (data.status === 'activated') {
                        setLiveBridgeIds(prev => {
                          const next = new Set(prev);
                          next.add(modalBridge.id);
                          return next;
                        });
                        
                        showToast("Bridge activated successfully", "success");
                        setShowModal(false);
                        
                        // Navigate automatically to Live Dashboard with that bridge selected
                        onSelectBridge(modalBridge.id);
                        setCurrentPage('dashboard');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      } else {
                        throw new Error(data.message || 'Activation failed');
                      }
                    } catch (e) {
                      clearTimeout(timeoutId);
                      console.error('[activation-error]', e);
                      
                      let errorMsg = 'Activation failed — please try again';
                      if (e.name === 'AbortError') {
                        errorMsg = 'Connection timeout — try again';
                      }
                      
                      // Show visible error message inside the modal
                      setModalError(errorMsg);
                      setActivating(false);
                      
                      // Close modal and trigger red toast
                      setShowModal(false);
                      showToast("Activation failed — please try again", "error");
                    }
                  }}
                  className="w-full font-semibold py-2.5 rounded-lg transition-all cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={
                    !isEngineer()
                      ? { background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }
                      : { background: '#0F6E56', color: '#ffffff' }
                  }
                >
                  {!isEngineer() ? 'Requires engineer access' : activating ? 'Activating...' : 'Activate live monitoring'}
                </button>
              )}
              <button
                disabled={activating}
                onClick={() => setShowModal(false)}
                className={`w-full font-semibold py-2.5 rounded-lg transition-all cursor-pointer hover:bg-slate-100 ${
                  activating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST MESSAGES POPUP ── */}
      {toastMessage && (
        <div 
          className="fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-lg text-xs shadow-lg flex items-center gap-2 animate-fade-in-up font-medium"
          style={{ 
            background: 'var(--bg-card)', 
            border: toastType === 'success' ? '1px solid #DCFCE7' : '1px solid #FECACA', 
            color: toastType === 'success' ? '#0F6E56' : '#991B1B' 
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: toastType === 'success' ? '#0F6E56' : '#991B1B' }} />
          {toastMessage}
        </div>
      )}

    </div>
  );
}
