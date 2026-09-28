import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { MapPin, Activity, AlertTriangle, Search } from 'lucide-react';
import { SENSOR_THRESHOLDS } from '../constants/thresholds';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Approximation coordinates of India border for linear projection SVG path
const BORDER_POINTS = [
  { lat: 37.0, lng: 74.5 },
  { lat: 36.2, lng: 75.8 },
  { lat: 35.5, lng: 77.0 },
  { lat: 35.6, lng: 78.8 },
  { lat: 34.5, lng: 79.2 },
  { lat: 32.5, lng: 78.6 },
  { lat: 31.0, lng: 79.5 },
  { lat: 30.2, lng: 81.0 },
  { lat: 28.8, lng: 80.2 },
  { lat: 27.5, lng: 83.0 },
  { lat: 26.5, lng: 85.0 },
  { lat: 27.2, lng: 88.0 },
  { lat: 28.0, lng: 88.6 },
  { lat: 27.1, lng: 88.9 },
  { lat: 27.3, lng: 90.0 },
  { lat: 27.8, lng: 91.5 },
  { lat: 28.0, lng: 92.0 },
  { lat: 28.5, lng: 94.5 },
  { lat: 29.3, lng: 96.0 },
  { lat: 29.5, lng: 97.2 },
  { lat: 28.2, lng: 97.5 },
  { lat: 27.2, lng: 97.0 },
  { lat: 26.2, lng: 95.2 },
  { lat: 25.3, lng: 94.5 },
  { lat: 24.0, lng: 94.3 },
  { lat: 22.8, lng: 93.3 },
  { lat: 21.9, lng: 92.8 },
  { lat: 22.5, lng: 92.2 },
  { lat: 23.5, lng: 91.8 },
  { lat: 24.0, lng: 92.3 },
  { lat: 24.8, lng: 91.8 },
  { lat: 25.2, lng: 92.0 },
  { lat: 25.2, lng: 89.8 },
  { lat: 22.0, lng: 89.0 },
  { lat: 21.6, lng: 89.0 },
  { lat: 21.8, lng: 88.0 },
  { lat: 22.2, lng: 87.5 },
  { lat: 21.5, lng: 86.9 },
  { lat: 20.0, lng: 86.3 },
  { lat: 19.3, lng: 84.8 },
  { lat: 17.5, lng: 83.3 },
  { lat: 16.5, lng: 82.2 },
  { lat: 16.1, lng: 81.1 },
  { lat: 15.8, lng: 80.3 },
  { lat: 13.5, lng: 80.2 },
  { lat: 11.8, lng: 79.8 },
  { lat: 10.3, lng: 79.9 },
  { lat: 9.2, lng: 79.0 },
  { lat: 9.3, lng: 78.1 },
  { lat: 8.08, lng: 77.54 }, // Kanyakumari (Southern Tip)
  { lat: 8.5, lng: 76.9 },
  { lat: 9.8, lng: 76.2 },
  { lat: 11.2, lng: 75.8 },
  { lat: 12.8, lng: 74.8 },
  { lat: 15.0, lng: 74.0 },
  { lat: 16.0, lng: 73.4 },
  { lat: 19.0, lng: 72.8 }, // Mumbai
  { lat: 20.1, lng: 72.7 },
  { lat: 20.8, lng: 72.9 },
  { lat: 21.1, lng: 72.6 },
  { lat: 20.8, lng: 71.0 },
  { lat: 21.5, lng: 69.5 },
  { lat: 22.2, lng: 69.0 },
  { lat: 22.8, lng: 70.1 },
  { lat: 23.0, lng: 70.3 },
  { lat: 23.3, lng: 68.5 },
  { lat: 23.8, lng: 68.1 }, // Western Tip
  { lat: 24.3, lng: 68.9 },
  { lat: 24.5, lng: 70.5 },
  { lat: 25.5, lng: 70.2 },
  { lat: 27.0, lng: 69.8 },
  { lat: 28.0, lng: 71.5 },
  { lat: 29.8, lng: 73.8 },
  { lat: 31.0, lng: 74.5 },
  { lat: 32.5, lng: 75.5 },
  { lat: 33.5, lng: 74.2 },
  { lat: 34.8, lng: 73.9 }
];

// Major Indian cities for map geographical context
const GEOGRAPHIC_CITIES = [
  { name: 'New Delhi', lat: 28.61, lng: 77.21 },
  { name: 'Mumbai', lat: 19.07, lng: 72.87 },
  { name: 'Kolkata', lat: 22.57, lng: 88.36 },
  { name: 'Chennai', lat: 13.08, lng: 80.27 },
  { name: 'Guwahati', lat: 26.14, lng: 91.73 },
  { name: 'Bengaluru', lat: 12.97, lng: 77.59 },
  { name: 'Hyderabad', lat: 17.38, lng: 78.48 }
];

// Coordinate projection parameters - Adjusted to cleanly center India from top to bottom
const LAT_MIN = 5.0;   // Lowered to include Kanyakumari perfectly
const LAT_MAX = 38.5;  // Raised to include Kashmir perfectly
const LNG_MIN = 66.5;  // Widened to fit west Gujarat
const LNG_MAX = 98.5;  // Widened to fit east Assam
const MAP_W = 600;
const MAP_H = 650;

function project(lat, lng) {
  const x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * MAP_W;
  const y = MAP_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * MAP_H;
  return { x, y };
}

// Consistent deterministic offset based on bridge id to de-clutter overlapping nodes
function getPinOffset(id) {
  const x = ((id * 17) % 7) - 3; // returns -3 to 3
  const y = ((id * 31) % 7) - 3; // returns -3 to 3
  return { x, y };
}

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
  
  // Hover state for pin tooltip
  const [hoveredBridge, setHoveredBridge] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Zoom & Pan states
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredBadgeId, setHoveredBadgeId] = useState(null);

  const handleMouseDown = (e) => {
    if (zoom === 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (zoom === 1) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  // Live bridges state list
  const [liveBridgeIds, setLiveBridgeIds] = useState(new Set());

  // Interactive Overlays
  const [showModal, setShowModal] = useState(false);
  const [modalBridge, setModalBridge] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
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

  // Map outline path string
  const borderPathD = useMemo(() => {
    if (BORDER_POINTS.length === 0) return '';
    const projected = BORDER_POINTS.map((pt) => project(pt.lat, pt.lng));
    return `M ${projected[0].x} ${projected[0].y} ` +
      projected.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ' Z';
  }, []);

  // Grid background grid lines for the map
  const gridLines = useMemo(() => {
    const lines = [];
    // Latitudes lines (10, 15, 20, 25, 30, 35)
    for (let lat = 10; lat <= 35; lat += 5) {
      const pStart = project(lat, LNG_MIN);
      const pEnd = project(lat, LNG_MAX);
      lines.push(
        <line
          key={`lat-${lat}`}
          x1={pStart.x}
          y1={pStart.y}
          x2={pEnd.x}
          y2={pEnd.y}
          stroke="rgba(15,23,42,0.06)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      );
      lines.push(
        <text
          key={`lat-text-${lat}`}
          x={10}
          y={pStart.y - 4}
          fill="rgba(15,23,42,0.3)"
          className="text-[7px] font-mono tracking-widest font-bold pointer-events-none"
        >
          {lat}°N
        </text>
      );
    }
    // Longitudes lines (70, 75, 80, 85, 90, 95)
    for (let lng = 70; lng <= 95; lng += 5) {
      const pStart = project(LAT_MIN, lng);
      const pEnd = project(LAT_MAX, lng);
      lines.push(
        <line
          key={`lng-${lng}`}
          x1={pStart.x}
          y1={pStart.y}
          x2={pEnd.x}
          y2={pEnd.y}
          stroke="rgba(15,23,42,0.06)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      );
      lines.push(
        <text
          key={`lng-text-${lng}`}
          x={pStart.x + 4}
          y={MAP_H - 10}
          fill="rgba(15,23,42,0.3)"
          className="text-[7px] font-mono tracking-widest font-bold pointer-events-none"
        >
          {lng}°E
        </text>
      );
    }
    return lines;
  }, []);

  const getPinColor = (healthScore) => {
    if (healthScore >= 75) return '#0F6E56'; // Healthy teal
    if (healthScore >= 50) return '#D97706'; // Monitor amber
    return '#991B1B'; // Critical red
  };

  const getTierLabel = (healthScore) => {
    if (healthScore >= 75) return 'Healthy';
    if (healthScore >= 50) return 'Monitor';
    return 'Critical';
  };

  const getStatusBadgeClass = (healthScore) => {
    if (healthScore >= 75) return 'badge-normal';
    if (healthScore >= 50) return 'badge-warning';
    return 'badge-critical';
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
      
      {/* ── LIVE BRIDGES NOTIFICATION BANNER ── */}
      {liveBridgeIds.size > 0 && (
        <div 
          className="px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-medium animate-fade-in-up"
          style={{ background: 'var(--status-healthy-bg)', border: '1px solid var(--status-healthy-border)', color: 'var(--status-healthy)' }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#0F6E56' }} />
            <span>{liveBridgeIds.size} {liveBridgeIds.size === 1 ? 'bridge is' : 'bridges are'} currently active for live telemetry stream monitoring.</span>
          </div>
        </div>
      )}

      {/* ── SECTION 1: MAP WITH INTEGRATED LEGEND ── */}
      <section className="relative">
        <div 
          className="w-full rounded-2xl p-4 flex flex-col justify-between overflow-hidden relative h-[500px]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
        >
          {/* Header Title info */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <h2 className="text-sm font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              India bridge monitoring network
              <span 
                className="text-[9px] font-normal font-sans px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
              >
                <span className="tabular-nums font-mono">{bridges.length}</span> bridges
              </span>
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Geographic structural status index. Select pin to review bridge metrics.
            </p>
          </div>

          {/* Zoom & Pan Controls (Top-Right Corner) */}
          <div 
            className="absolute top-4 right-4 z-20 flex items-center gap-1 p-1 rounded-lg"
            style={{ 
              background: '#1C1F26', 
              border: '1px solid #2A2E39'
            }}
          >
            <button
              onClick={() => setZoom(prev => Math.min(5, prev + 0.5))}
              title="Zoom In"
              className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs transition cursor-pointer hover:bg-white/10 active:scale-95"
              style={{ color: '#F8FAFA', border: 'none', background: 'none' }}
            >
              ＋
            </button>
            <button
              onClick={() => {
                setZoom(prev => {
                  const nextZoom = Math.max(1, prev - 0.5);
                  if (nextZoom === 1) {
                    setPan({ x: 0, y: 0 });
                  }
                  return nextZoom;
                });
              }}
              title="Zoom Out"
              className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs transition cursor-pointer hover:bg-white/10 active:scale-95"
              style={{ color: '#F8FAFA', border: 'none', background: 'none' }}
            >
              －
            </button>

            {/* Divider */}
            <div className="w-[1px] h-4 mx-0.5" style={{ backgroundColor: '#2A2E39' }} />

            <button
              type="button"
              onClick={() => {
                setZoom(2.2);
                setPan({ x: 210, y: -430 });
              }}
              title="Focus South India Cluster"
              className="px-2.5 h-7 rounded flex items-center justify-center text-[9.5px] font-medium tracking-wide transition cursor-pointer hover:bg-white/10 active:scale-95 border"
              style={{ 
                color: '#CBD5E1', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                borderColor: '#2A2E39' 
              }}
            >
              South India
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              title="Reset Map View"
              className="px-2.5 h-7 rounded flex items-center justify-center text-[9.5px] font-medium tracking-wide transition cursor-pointer hover:bg-white/10 active:scale-95 border"
              style={{ 
                color: '#CBD5E1', 
                backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                borderColor: '#2A2E39' 
              }}
            >
              Reset View
            </button>
          </div>

          {/* Interactive Map Visualisation */}
          <div className="w-full h-full flex items-center justify-center relative">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full max-w-[480px] h-full max-h-[480px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)] relative overflow-hidden select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUp}
              style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              <g
                transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
                style={{
                  transformOrigin: '300px 325px',
                  transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {/* Geopolitical Border Area - Stylized Dark Blue-Grey */}
                <path
                  d={borderPathD}
                  fill="#f1f5f9"
                  stroke="#cbd5e1"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-300 hover:fill-[#e2e8f0]"
                />

                {/* High-Tech Grid lines */}
                {gridLines}

                {/* Major Cities Markers */}
                {GEOGRAPHIC_CITIES.map((city) => {
                  const pt = project(city.lat, city.lng);
                  return (
                    <g key={`city-${city.name}`} className="opacity-30 pointer-events-none select-none">
                      <circle cx={pt.x} cy={pt.y} r="2" fill="rgba(15,23,42,0.4)" />
                      <text
                        x={pt.x + 4}
                        y={pt.y + 2.5}
                        fill="rgba(15,23,42,0.5)"
                        className="text-[7px] font-medium tracking-wide font-sans"
                      >
                        {city.name}
                      </text>
                    </g>
                  );
                })}

                {/* Pins (Plotted Bridge coordinates) */}
                {filteredBridges.map((bridge) => {
                  // Apply deterministic spacing offset to avoid overlapping stacks
                  const rawPt = project(bridge.lat, bridge.lng);
                  const offset = getPinOffset(bridge.id);
                  const pt = { x: rawPt.x + offset.x, y: rawPt.y + offset.y };

                  const isHovered = hoveredBridge?.id === bridge.id;
                  const isSelected = selectedPinBridgeId === bridge.id;
                  const pinColor = getPinColor(bridge.health_score);
                  const isLive = liveBridgeIds.has(bridge.id);
                  
                  return (
                    <g
                      key={bridge.id}
                      className="cursor-pointer"
                      onClick={() => handlePinClick(bridge)}
                      onMouseEnter={(e) => {
                        setHoveredBridge(bridge);
                        setTooltipPos({ x: pt.x, y: pt.y - 10 });
                      }}
                      onMouseLeave={() => setHoveredBridge(null)}
                    >
                      {/* Pulsing ring for live bridges using native SVG animations to prevent coordinate drift */}
                      {isLive && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          fill="none"
                          stroke={pinColor}
                          strokeWidth="1.5"
                        >
                          <animate
                            attributeName="r"
                            values={isHovered || isSelected ? "8;22" : "6;16"}
                            dur="1.8s"
                            repeatCount="indefinite"
                          />
                          <animate
                            attributeName="opacity"
                            values="0.8;0"
                            dur="1.8s"
                            repeatCount="indefinite"
                          />
                        </circle>
                      )}

                      {/* Circle Pin - Solid filled with white border and drop shadow */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered || isSelected ? 8 : 6}
                        fill={pinColor}
                        stroke={isLive ? "#16a34a" : "#ffffff"}
                        strokeWidth={isHovered || isSelected ? 1.8 : 1}
                        style={{
                          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                    </g>
                  );
                })}

                {/* Tooltip Popup rendering inside SVG */}
                {hoveredBridge && (
                  <g transform={`translate(${tooltipPos.x}, ${tooltipPos.y})`} className="pointer-events-none select-none">
                    {/* Glass Box Background */}
                    <rect
                      x="-75"
                      y="-55"
                      width="150"
                      height="48"
                      rx="6"
                      fill="#ffffff"
                      stroke="#cbd5e1"
                      strokeWidth="1"
                      style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.4))' }}
                    />
                    {/* Arrow marker */}
                    <polygon points="0,0 -5,-6 5,-6" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                    <polygon points="0,0 -5,-6 5,-6" fill="#ffffff" />
                    
                    {/* Title Text */}
                    <text
                      x="-68"
                      y="-43"
                      fill="var(--text-primary)"
                      className="text-[8px] font-extrabold font-sans leading-none"
                    >
                      {hoveredBridge.name.length > 25 ? hoveredBridge.name.slice(0, 23) + '...' : hoveredBridge.name}
                    </text>
                    
                    {/* Details line 1 */}
                    <text
                      x="-68"
                      y="-32"
                      fill="#475569"
                      className="text-[7.5px] font-medium font-sans"
                    >
                      {hoveredBridge.city || 'State'}, {hoveredBridge.state}
                    </text>

                    {/* Details line 2 */}
                    <text
                      x="-68"
                      y="-21"
                      fill="#475569"
                      className="text-[7.5px] font-medium font-sans"
                    >
                      Score:{' '}
                      <tspan fill={getPinColor(hoveredBridge.health_score)} className="font-extrabold font-mono">
                        {hoveredBridge.health_score}%
                      </tspan>{' '}
                      • Grade:{' '}
                      <tspan fill={getPinColor(hoveredBridge.health_score)} className="font-extrabold font-mono">
                        {hoveredBridge.health_grade}
                      </tspan>
                    </text>

                    <text
                      x="-68"
                      y="-12"
                      fill="#94a3b8"
                      className="text-[6.5px] font-medium tracking-wide font-sans"
                    >
                      Status: {getTierLabel(hoveredBridge.health_score)} {liveBridgeIds.has(hoveredBridge.id) && "• (Live)"}
                    </text>
                  </g>
                )}
              </g>
            </svg>
          </div>

          {/* Compact Integrated Legend in Bottom-Right Corner */}
          <div 
            className="absolute bottom-4 right-4 p-2.5 rounded-lg flex flex-col gap-1.5 text-[9px] pointer-events-none select-none z-10 w-28"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0F6E56' }} />
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Healthy</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#D97706' }} />
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Monitor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#991B1B' }} />
              <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Critical</span>
            </div>
          </div>
        </div>
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
                    <span className="text-[10px] font-medium font-sans min-w-[32px] text-right shrink-0" style={{ color: pinColor }}>
                      <span className="tabular-nums font-mono">{bridge.health_score}</span>%
                    </span>
                  </div>
                </div>

                {/* Status badge + Alerts count row */}
                <div className="flex items-center justify-between pt-2 gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  {/* Status Badge */}
                  <span className={`badge ${getStatusBadgeClass(bridge.health_score)} shrink-0`} style={{ fontSize: '8.5px' }}>
                    {getTierLabel(bridge.health_score)}
                  </span>

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
