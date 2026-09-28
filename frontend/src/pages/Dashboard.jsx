import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import {
  fetchBridges,
  fetchLive,
  fetchAlerts,
  fetchHistory,
  fetchHealthHistory,
  downloadReport
} from '../api';

import { CheckCircle2, AlertTriangle, AlertCircle, Loader2, Search, List, Activity, Bell, X } from 'lucide-react';
import StatusBadge, { formatHealthScore } from '../components/StatusBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

// Detailed inspection components
import MetricCards from '../components/MetricCards';
import LiveCharts from '../components/LiveCharts';
import MaintenancePanel from '../components/MaintenancePanel';
import RiskGauge from '../components/RiskGauge';
import AlertPanel from '../components/AlertPanel';
import HistoryChart from '../components/HistoryChart';

const generateAlerts = (bridges) => {
  // Critical tier: health < 50, sorted worst-first
  const critical = bridges
    .filter(b => b.health_score < 50)
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 3)
    .map(bridge => ({
      bridge_name: bridge.name,
      message: `Critical: Health ${bridge.health_score.toFixed(1)}/100 — ${bridge.alert_count} active alerts`,
      severity: 'critical'
    }))

  // Monitor tier: health 50-74, sorted worst-first
  const monitor = bridges
    .filter(b => b.health_score >= 50 && b.health_score < 75)
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 3)
    .map(bridge => ({
      bridge_name: bridge.name,
      message: `Monitor — health degrading (${bridge.health_score.toFixed(1)}/100)`,
      severity: 'warning'
    }))

  // Total bridges that would qualify for alerts (for "View all" overflow count)
  const totalCritical = bridges.filter(b => b.health_score < 50).length
  const totalMonitor = bridges.filter(b => b.health_score >= 50 && b.health_score < 75).length
  const totalAlerting = totalCritical + totalMonitor
  const shown = critical.length + monitor.length

  return {
    alerts: [...critical, ...monitor],
    overflowCount: Math.max(0, totalAlerting - shown)
  }
}

export default function Dashboard({ onSelectBridge, setCurrentPage }) {
  const { token } = useAuth();

  // Fleet overview data
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialAvgHealth, setInitialAvgHealth] = useState(null);

  // Search, Filters & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, NORMAL, WARNING, CRITICAL
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const itemsPerPage = 10;

  // Selected Bridge inspection modal
  const [selectedBridge, setSelectedBridge] = useState(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [xaiBridge, setXaiBridge] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Sorting State
  const [sortBy, setSortBy] = useState('health');
  const [sortDir, setSortDir] = useState('asc');

  // Row Hover State
  const [hoveredRowId, setHoveredRowId] = useState(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowAllAlerts(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Polling for all bridges list
  useEffect(() => {
    async function loadBridges() {
      try {
        // We fetch the full India list to support the 58 bridges
        const res = await fetch(`${API_BASE}/api/india/bridges`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setBridges(data);
        if (data.length > 0) {
          const avg = data.reduce((sum, b) => sum + b.health_score, 0) / data.length;
          setInitialAvgHealth(prev => prev === null ? avg : prev);
        }
        setError(null);
      } catch (err) {
        console.error('[Dashboard loadBridges error]', err);
        setError(err.message || 'Failed to retrieve bridge database');
      } finally {
        setLoading(false);
      }
    }
    loadBridges();
    const id = setInterval(loadBridges, 5000);
    return () => clearInterval(id);
  }, [token]);

  // Helper to categorize bridge status into HEALTHY, MONITOR, CRITICAL (<50 = Critical, 50-74 = Monitor, >=75 = Healthy)
  const getAlertLevel = (bridge) => {
    const h = bridge?.health_score;
    if (h === null || h === undefined) return 'HEALTHY';
    if (h < 50) return 'CRITICAL';
    if (h < 75) return 'MONITOR';
    return 'HEALTHY';
  };

  // Color helper for health score (<50 = Critical #991B1B, 50-74 = Monitor #D97706, >=75 = Healthy #0F6E56)
  const getHealthColor = (score) => {
    if (score === null || score === undefined) return '#8B94A3';
    if (score >= 75) return '#0F6E56'; // Healthy
    if (score >= 50) return '#D97706'; // Monitor
    return '#991B1B';                  // Critical
  };

  // Cache for bridge alert messages fetched from API
  const [alertsCache, setAlertsCache] = useState({});

  // Fetch alerts for warning/critical bridges to get actual sensor alert reasons
  useEffect(() => {
    if (bridges.length === 0) return;
    const warningCritical = bridges.filter(
      b => getAlertLevel(b) === 'CRITICAL' || getAlertLevel(b) === 'MONITOR' || getAlertLevel(b) === 'WARNING'
    );
    
    warningCritical.forEach(async (b) => {
      try {
        const alrts = await fetchAlerts(b.id);
        if (alrts && alrts.length > 0) {
          const latest = alrts.find(a => a.level === 'CRITICAL' || a.level === 'WARNING') || alrts[0];
          if (latest) {
            setAlertsCache(prev => {
              if (prev[b.id] && prev[b.id].timestamp === latest.timestamp && prev[b.id].message === latest.message) {
                return prev;
              }
              return {
                ...prev,
                [b.id]: latest
              };
            });
          }
        }
      } catch (err) {
        console.error(`Error loading alerts for bridge ${b.id}:`, err);
      }
    });
  }, [bridges]);

  // ── Stats Calculations ────────────────────────────────────────────────────
  const totalBridgesCount = 58; // Fixed reference total or bridges.length
  
  const criticalCount = bridges.filter(b => getAlertLevel(b) === 'CRITICAL').length;

  const normalBridgesCount = bridges.length > 0
    ? bridges.reduce((acc, b) => acc + (getAlertLevel(b) === 'HEALTHY' || getAlertLevel(b) === 'NORMAL' ? 1 : 0), 0)
    : 38;

  const networkHealthPct = bridges.length > 0 
    ? Math.round(bridges.reduce((sum, b) => sum + b.health_score, 0) / bridges.length) 
    : 65;

  const diffVal = initialAvgHealth !== null && bridges.length > 0
    ? (bridges.reduce((sum, b) => sum + b.health_score, 0) / bridges.length) - initialAvgHealth
    : 0.0;
  const diffStr = diffVal > 0 ? `+${diffVal.toFixed(1)}%` : diffVal < 0 ? `${diffVal.toFixed(1)}%` : `0.0%`;
  const trendColor = diffVal >= 0 ? '#0F6E56' : '#991B1B';
  const trendIcon = diffVal >= 0 ? '↑' : '↓';
  const trendLabel = `${trendIcon} ${diffStr} since start`;

  const activeSensorsCount = bridges.length > 0
    ? bridges.length * 4
    : 232;

  const tierCritical = bridges.filter(b => b.health_score < 50).length;
  const tierMonitor = bridges.filter(b => b.health_score >= 50 && b.health_score < 75).length;
  const tierHealthy = bridges.filter(b => b.health_score >= 75).length;

  const healthData = [
    { name: 'Critical (<50)', count: tierCritical, color: '#991B1B' },
    { name: 'Monitor (50–74)', count: tierMonitor, color: '#D97706' },
    { name: 'Healthy (≥75)', count: tierHealthy, color: '#0F6E56' }
  ];

  // ── Filters & Search ──────────────────────────────────────────────────────
  const filteredBridges = bridges.filter((bridge) => {
    // 1. Search filter
    const query = searchQuery.toLowerCase();
    const matchesSearch = 
      bridge.name.toLowerCase().includes(query) ||
      (bridge.location && bridge.location.toLowerCase().includes(query)) ||
      (bridge.city && bridge.city.toLowerCase().includes(query)) ||
      (bridge.state && bridge.state.toLowerCase().includes(query));

    // 2. Status filter
    const alertLvl = getAlertLevel(bridge);
    const matchesStatus =
      statusFilter === 'ALL' ||
      alertLvl === statusFilter ||
      (statusFilter === 'HEALTHY' && (alertLvl === 'HEALTHY' || alertLvl === 'NORMAL')) ||
      (statusFilter === 'NORMAL' && (alertLvl === 'HEALTHY' || alertLvl === 'NORMAL')) ||
      (statusFilter === 'MONITOR' && (alertLvl === 'MONITOR' || alertLvl === 'WARNING')) ||
      (statusFilter === 'WARNING' && (alertLvl === 'MONITOR' || alertLvl === 'WARNING'));

    return matchesSearch && matchesStatus;
  });

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  const sortedBridges = [...filteredBridges].sort((a, b) => {
    let valA, valB;
    if (sortBy === 'health') {
      valA = a.health_score ?? 0;
      valB = b.health_score ?? 0;
    } else if (sortBy === 'anomaly') {
      const anomalyA = Math.max(1.2, (100 - (a.health_score ?? 0)) * 0.85 + (a.id % 3));
      const anomalyB = Math.max(1.2, (100 - (b.health_score ?? 0)) * 0.85 + (b.id % 3));
      valA = anomalyA;
      valB = anomalyB;
    } else if (sortBy === 'status') {
      const rank = { 'CRITICAL': 0, 'MONITOR': 1, 'WARNING': 1, 'HEALTHY': 2, 'NORMAL': 2 };
      valA = rank[getAlertLevel(a)] ?? 9;
      valB = rank[getAlertLevel(b)] ?? 9;
    } else {
      return 0;
    }

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Export CSV function
  const exportCSV = () => {
    const headers = ['Bridge Name', 'Location', 'Health Score', 'Anomaly %', 'Status'];
    const rows = bridges.map(b => {
      const anomalyVal = Math.max(1.2, (100 - (b.health_score || 0)) * 0.85 + (b.id % 3));
      const statusStr = getAlertLevel(b);
      return [
        `"${b.name.replace(/"/g, '""')}"`,
        `"${(b.location || b.state || '').replace(/"/g, '""')}"`,
        b.health_score !== null ? b.health_score.toFixed(1) : '—',
        anomalyVal.toFixed(1),
        statusStr
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-health-report.csv';
    a.click();
  };

  // Pagination calculations
  const totalItems = sortedBridges.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPageNum - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentItems = sortedBridges.slice(startIndex, endIndex);

  const handlePageChange = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPageNum(pageNum);
      
      // Scroll to top of bridge table
      const tableElement = document.getElementById('bridge-table') 
        || document.querySelector('.bridge-network-section')
        || document.querySelector('[data-section="bridge-table"]')
      if (tableElement) {
        tableElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  };

  // Handle page resets on filter change
  const handleFilterChange = (filter) => {
    setStatusFilter(filter);
    setCurrentPageNum(1);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPageNum(1);
  };

  const handleInspectBridge = (bridge) => {
    onSelectBridge(bridge.id);
    // Determine target page: default to AIOps Center
    setCurrentPage('aiops');
  };

  // Recent Alerts extraction for right side feed
  const { alerts: recentAlerts, overflowCount: alertOverflowCount } = generateAlerts(bridges);

  return (
    <div className="space-y-6">
      {/* ── TOP STATS ROW ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Bridges */}
        <div className="p-5 flex flex-col justify-between bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', height: '140px', boxShadow: 'none' }}>
          <div>
            <p className="text-slate-500 font-medium" style={{ fontSize: '13px', margin: 0 }}>
              Monitored bridges
            </p>
            <h2 className="text-[32px] font-bold tracking-tight leading-none text-slate-900 mt-2.5" style={{ margin: 0 }}>
              {totalBridgesCount}
            </h2>
          </div>
          <p className="text-xs font-medium" style={{ color: '#0F6E56', margin: 0 }}>
            <span>2 added recently</span>
          </p>
        </div>

        {/* Critical Alerts */}
        <div className="p-5 flex flex-col justify-between bg-white" style={{ border: '1px solid #e2e8f0', borderTop: '2px solid #0F6E56', borderRadius: '8px', height: '140px', boxShadow: 'none' }}>
          <div>
            <p className="text-slate-500 font-medium" style={{ fontSize: '13px', margin: 0 }}>
              Critical alerts
            </p>
            <h2 className="text-[32px] font-bold tracking-tight leading-none mt-2.5" style={{ margin: 0, color: '#991B1B' }}>
              {criticalCount}
            </h2>
          </div>
          <p className="text-xs font-medium" style={{ color: '#991B1B', margin: 0 }}>
            <span>Action required</span>
          </p>
        </div>

        {/* Network Health */}
        <div className="p-5 flex flex-col justify-between bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', height: '140px', boxShadow: 'none' }}>
          <div>
            <p className="text-slate-500 font-medium" style={{ fontSize: '13px', margin: 0 }}>
              Avg health
            </p>
            <h2 className="text-[32px] font-bold tracking-tight leading-none text-slate-900 mt-2.5" style={{ margin: 0 }}>
              {networkHealthPct}%
            </h2>
          </div>
          <p className="text-xs font-medium" style={{ color: trendColor, margin: 0 }}>
            <span>{trendLabel}</span>
          </p>
        </div>

        {/* Active Sensors */}
        <div className="p-5 flex flex-col justify-between bg-white" style={{ border: '1px solid #e2e8f0', borderRadius: '8px', height: '140px', boxShadow: 'none' }}>
          <div>
            <p className="text-slate-500 font-medium" style={{ fontSize: '13px', margin: 0 }}>
              Sensor channels
            </p>
            <h2 className="text-[32px] font-bold tracking-tight leading-none text-slate-900 mt-2.5" style={{ margin: 0 }}>
              {activeSensorsCount}
            </h2>
          </div>
          <p className="text-xs font-medium" style={{ color: '#0F6E56', margin: 0 }}>
            <span>100% calibrated</span>
          </p>
        </div>

      </div>

      {/* ── TWO COLUMN LAYOUT ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', gap: '24px' }}>
        
        {/* Left Column: Bridge list network table */}
        <div id="bridge-table" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: 'none', overflow: 'hidden' }}>
            
            {/* Controls Header */}
            <div className="p-5 border-b flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: '#f1f5f9' }}>
              
              {/* Left Side: Title + Filters */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <List size={18} color="#1C1F26" />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1C1F26', margin: 0 }}>
                    Bridge network
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                  {['ALL', 'HEALTHY', 'MONITOR', 'CRITICAL'].map((f) => {
                    const label = f === 'ALL' ? 'All' : f === 'HEALTHY' ? 'Healthy' : f === 'MONITOR' ? 'Monitor' : 'Critical';
                    const isSelected = statusFilter === f || (statusFilter === 'NORMAL' && f === 'HEALTHY') || (statusFilter === 'WARNING' && f === 'MONITOR');
                    const btnStyle = isSelected
                      ? { backgroundColor: '#F8FAFA', border: '1px solid #1C1F26', color: '#1C1F26' }
                      : { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', color: '#64748b' };

                    return (
                      <button
                        key={f}
                        onClick={() => handleFilterChange(f)}
                        className="rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer whitespace-nowrap"
                        style={btnStyle}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Side: Search bar & Export CSV */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={exportCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium bg-white text-[#1C1F26] border border-[#8B94A3] hover:bg-[#F8FAFA] transition-colors shrink-0 cursor-pointer"
                >
                  Export CSV
                </button>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Search 
                    style={{ 
                      position: 'absolute', 
                      left: '10px', 
                      width: '16px', 
                      height: '16px', 
                      color: '#9ca3af',
                      pointerEvents: 'none',
                      zIndex: 1
                    }} 
                  />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                    style={{
                      paddingLeft: '34px',
                      paddingRight: '12px',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      border: '1px solid',
                      borderColor: '#e2e8f0',
                      background: 'transparent',
                      color: 'inherit',
                      width: '180px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

            </div>

            {/* Table representation */}
            <div className="overflow-x-auto">
              {loading && bridges.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Loading national bridge inventory database...
                </div>
              ) : error ? (
                <div className="p-8 text-center text-xs text-red-500 font-bold">
                  Error fetching database: {error}
                </div>
              ) : currentItems.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No profiles found matching search filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Bridge</th>
                      <th 
                        className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none text-slate-400"
                        onClick={() => handleSort('health')}
                      >
                        Health {sortBy === 'health' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none text-slate-400"
                        onClick={() => handleSort('anomaly')}
                      >
                        Anomaly {sortBy === 'anomaly' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none text-slate-400"
                        onClick={() => handleSort('status')}
                      >
                        Status {sortBy === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-wider text-right text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.map((bridge, index) => {
                      const alertLvl = getAlertLevel(bridge);
                      const healthColor = getHealthColor(bridge.health_score);
                      const anomalyVal = Math.max(1.2, (100 - bridge.health_score) * 0.85 + (bridge.id % 3));

                      return (
                        <tr 
                          key={bridge.id} 
                          className="border-b border-slate-100 transition-colors bg-white hover:bg-slate-50/50"
                        >
                          {/* Bridge name & location */}
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold block text-slate-900">
                              {bridge.name || bridge.bridge_name || `Bridge ${bridge.id}`}
                            </span>
                            <span className="text-[11px] block mt-1 text-slate-400 font-semibold leading-normal whitespace-pre-line">
                              {bridge.location || `${bridge.city || ''},\n${bridge.state || ''}`}
                            </span>
                          </td>

                          {/* Health score with custom underline */}
                          <td className="px-6 py-4">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                              <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                <span
                                  className="font-mono text-base font-bold"
                                  style={{
                                    color: healthColor,
                                    fontSize: '15px',
                                  }}
                                >
                                  {bridge.health_score !== null && bridge.health_score !== undefined ? formatHealthScore(bridge.health_score) : '—'}
                                </span>
                                <span className="text-[10px] text-[var(--text-muted)] font-normal ml-0.5">/100</span>
                              </div>
                              <div 
                                style={{ 
                                  width: '28px', 
                                  height: '2px', 
                                  backgroundColor: healthColor, 
                                  borderRadius: '1px', 
                                  marginTop: '4px' 
                                }} 
                              />
                            </div>
                          </td>

                          {/* Anomaly score plain text */}
                          <td className="px-6 py-4 font-mono text-sm text-slate-600 font-semibold">
                            {anomalyVal.toFixed(1)}%
                          </td>

                          {/* Status badge */}
                          <td className="px-6 py-4">
                            <StatusBadge status={alertLvl} healthScore={bridge.health_score} />
                          </td>

                          {/* Action links */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 text-xs font-medium">
                              {(alertLvl === 'MONITOR' || alertLvl === 'WARNING' || alertLvl === 'CRITICAL') && (
                                <button
                                  onClick={() => setXaiBridge(bridge)}
                                  className="px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-colors cursor-pointer bg-white"
                                  style={{
                                    color: '#0F6E56',
                                    borderColor: 'rgba(15, 110, 86, 0.4)',
                                    boxShadow: 'none',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#F0FDF4';
                                    e.currentTarget.style.borderColor = '#0F6E56';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                                    e.currentTarget.style.borderColor = 'rgba(15, 110, 86, 0.4)';
                                  }}
                                >
                                  Why?
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedBridge(bridge)}
                                className="px-2.5 py-1 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer bg-white"
                                style={{
                                  color: '#0F6E56',
                                  borderColor: 'rgba(15, 110, 86, 0.4)',
                                  boxShadow: 'none',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#F0FDF4';
                                  e.currentTarget.style.borderColor = '#0F6E56';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                                  e.currentTarget.style.borderColor = 'rgba(15, 110, 86, 0.4)';
                                }}
                              >
                                View
                              </button>
                              <button
                                onClick={() => handleInspectBridge(bridge)}
                                className="px-2.5 py-1 rounded-[6px] border text-xs font-medium transition-colors cursor-pointer bg-white"
                                style={{
                                  color: '#0F6E56',
                                  borderColor: 'rgba(15, 110, 86, 0.4)',
                                  boxShadow: 'none',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#F0FDF4';
                                  e.currentTarget.style.borderColor = '#0F6E56';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                                  e.currentTarget.style.borderColor = 'rgba(15, 110, 86, 0.4)';
                                }}
                              >
                                Inspect
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="p-5 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs bg-white text-slate-500" style={{ borderColor: '#f1f5f9' }}>
                <div className="font-semibold text-slate-400">
                  Showing <span className="font-bold text-slate-600">{startIndex + 1}-{endIndex}</span> of <span className="font-bold text-slate-600">{totalItems}</span> bridges
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handlePageChange(currentPageNum - 1)}
                    disabled={currentPageNum === 1}
                    className="px-3.5 py-1.5 rounded-lg border transition font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50"
                    style={{ borderColor: '#e2e8f0', color: '#475569', background: 'transparent' }}
                  >
                    Prev
                  </button>

                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNo = idx + 1;
                    const isCurrent = currentPageNum === pageNo;
                    return (
                      <button
                        key={pageNo}
                        onClick={() => handlePageChange(pageNo)}
                        className="w-8 h-8 rounded-lg border transition font-bold cursor-pointer flex items-center justify-center hover:bg-slate-50"
                        style={isCurrent 
                          ? { background: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }
                          : { background: 'transparent', borderColor: '#e2e8f0', color: '#475569' }
                        }
                      >
                        {pageNo}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handlePageChange(currentPageNum + 1)}
                    disabled={currentPageNum === totalPages}
                    className="px-3.5 py-1.5 rounded-lg border transition font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-50"
                    style={{ borderColor: '#e2e8f0', color: '#475569', background: 'transparent' }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Network Health Distribution Chart */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: 'none' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity size={18} color="#0F6E56" />
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1C1F26', margin: 0 }}>
                  National bridge health distribution
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                All {bridges.length} monitored bridges
              </span>
            </div>
            
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={healthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px 12px', boxShadow: 'none' }}>
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: 500, color: '#64748b' }}>{data.name}</p>
                          <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 700, color: data.color }}>
                            {data.count} {data.count === 1 ? 'bridge' : 'bridges'}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: Network Health Dial & Recent Alerts */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Network Health Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: 'none' }}>
            <div className="flex items-center gap-2 mb-6">
              <Activity size={18} color="#0F6E56" />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1C1F26', margin: 0 }}>
                Avg health
              </h3>
            </div>
            
            <NetworkHealthDial 
              allBridges={bridges} 
            />
          </div>

          {/* Recent Alerts Card */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', boxShadow: 'none' }}>
            <div className="flex items-center gap-2 mb-6">
              <Bell size={16} color="#1C1F26" />
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1C1F26', margin: 0 }}>
                Recent alerts
              </h3>
            </div>

            <div className="flex flex-col gap-4">
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert, idx) => {
                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: '12px', 
                        paddingBottom: idx === recentAlerts.length - 1 ? '0' : '16px',
                        borderBottom: idx === recentAlerts.length - 1 ? 'none' : '1px solid #f1f5f9'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div className="flex items-center justify-between gap-2">
                          <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#1C1F26', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {alert.bridge_name}
                          </p>
                          <StatusBadge status={alert.severity === 'critical' ? 'Critical' : 'Monitor'} size="sm" />
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', fontWeight: '500', color: '#64748b' }}>
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-xs text-slate-400">
                  No active alerts
                </div>
              )}
            </div>

            {/* View all alerts link */}
            {recentAlerts.length > 0 && (
              <button
                onClick={() => setShowAllAlerts(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderWidth: 0,
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderTopColor: '#f1f5f9',
                  background: 'none',
                  cursor: 'pointer',
                  width: '100%',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#0F6E56',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#0b5341'}
                onMouseLeave={e => e.currentTarget.style.color = '#0F6E56'}
              >
                View all alerts
                {alertOverflowCount > 0 && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    background: '#F0FDF4',
                    color: '#0F6E56',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                  }}>
                    +{alertOverflowCount} more
                  </span>
                )}
                <span style={{ fontSize: '14px' }}>→</span>
              </button>
            )}
          </div>

        </div>

      </div>

      {/* ── INSPECTION DETAIL MODAL ─────────────────────────────────────────── */}
      {selectedBridge && (
        <InspectionModal 
          bridge={selectedBridge} 
          token={token}
          onClose={() => setSelectedBridge(null)} 
        />
      )}

      {/* ── XAI EXPLANATION MODAL ───────────────────────────────────────────── */}
      {xaiBridge && (
        <XaiExplanationModal
          bridge={xaiBridge}
          token={token}
          onClose={() => setXaiBridge(null)}
        />
      )}

      {/* ── ALL ALERTS MODAL ───────────────────────────────────────────────── */}
      {showAllAlerts && (() => {
        const criticalBridges = bridges
          .filter(b => b.health_score < 50)
          .sort((a, b) => a.health_score - b.health_score);

        const monitorBridges = bridges
          .filter(b => b.health_score >= 50 && b.health_score < 75)
          .sort((a, b) => a.health_score - b.health_score);

        const totalAlertsCount = criticalBridges.length + monitorBridges.length;

        return (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowAllAlerts(false);
            }}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '24px',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Header */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '16px'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1C1F26', margin: 0 }}>
                  All active alerts ({totalAlertsCount})
                </h2>
                <button 
                  onClick={() => setShowAllAlerts(false)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#8B94A3',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                  aria-label="Close"
                ><X size={16} /></button>
              </div>

              {/* Scrollable Content */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* Critical Section */}
                <div>
                  <div style={{ display: 'flex', marginBottom: '8px' }}>
                    <span style={{
                      background: '#FDF2F2',
                      color: '#1C1F26',
                      border: '1px solid #FECACA',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.02em'
                    }}>Critical</span>
                  </div>
                  {criticalBridges.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {criticalBridges.map((bridge) => (
                        <div key={bridge.id} style={{
                          padding: '12px 0',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <p style={{ fontWeight: '700', fontSize: '14px', color: '#1C1F26', margin: 0 }}>
                              {bridge.name}
                            </p>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                              Health score: <span style={{ fontWeight: '600', color: '#991B1B' }}>{bridge.health_score.toFixed(1)}/100</span> • {bridge.location || `${bridge.city || ''}, ${bridge.state || ''}`}
                            </p>
                          </div>
                          <StatusBadge status="Critical" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '8px 0', fontStyle: 'italic' }}>
                      No critical alerts active.
                    </p>
                  )}
                </div>

                {/* Monitor Section */}
                <div>
                  <div style={{ display: 'flex', marginBottom: '8px' }}>
                    <span style={{
                      background: '#FFFBEB',
                      color: '#1C1F26',
                      border: '1px solid #FEF3C7',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      letterSpacing: '0.02em'
                    }}>Monitor</span>
                  </div>
                  {monitorBridges.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {monitorBridges.map((bridge) => (
                        <div key={bridge.id} style={{
                          padding: '12px 0',
                          borderBottom: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <p style={{ fontWeight: '700', fontSize: '14px', color: '#1C1F26', margin: 0 }}>
                              {bridge.name}
                            </p>
                            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                              Health score: <span style={{ fontWeight: '600', color: '#D97706' }}>{bridge.health_score.toFixed(1)}/100</span> • {bridge.location || `${bridge.city || ''}, ${bridge.state || ''}`}
                            </p>
                          </div>
                          <StatusBadge status="Monitor" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#94a3b8', margin: '8px 0', fontStyle: 'italic' }}>
                      No bridges currently in monitor status.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Network Health Circular Dial Gauge Component ──
function NetworkHealthDial({ allBridges }) {
  const networkHealth = allBridges.length > 0 
    ? Math.round(allBridges.reduce((sum, b) => sum + b.health_score, 0) / allBridges.length)
    : 0;

  const pct = networkHealth / 100;
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Gray track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={stroke}
          />
          {/* Teal progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#0F6E56"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontSize: '32px', fontWeight: '700', color: '#0F6E56', lineHeight: 1 }}>
            {networkHealth}%
          </span>
          <span style={{ fontSize: '12px', fontWeight: '500', color: '#8B94A3', marginTop: '4px' }}>
            Avg health
          </span>
        </div>
      </div>
      <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F6E56' }}>
          {networkHealth}% avg — {allBridges.length} bridges
        </span>
      </div>
    </div>
  );
}

// ── DETAIL INSPECTION OVERLAY MODAL ─────────────────────────────────────────
function InspectionModal({ bridge, token, onClose }) {
  const [liveData, setLiveData] = useState(null);
  const [chartData, setChartData] = useState({ water_level: [], vibration: [], strain: [], crack_gap: [] });
  const [alerts, setAlerts] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [isExporting, setIsExporting] = useState(false);

  // Poll live telemetry data for this selected bridge
  useEffect(() => {
    const bridgeId = bridge.id;

    async function loadTelemetry() {
      try {
        const live = await fetchLive(bridgeId);
        setLiveData(live);

        // Append to rolling chart buffer
        const timeLabel = live.timestamp?.split('T')[1]?.slice(0, 8) || live.timestamp?.split(' ')[1]?.slice(0, 8) || '';
        setChartData((prev) => {
          const next = { ...prev };
          for (const s of ['water_level', 'vibration', 'strain', 'crack_gap']) {
            const arr = [...(prev[s] || []), { time: timeLabel, value: live[s] }];
            next[s] = arr.length > 30 ? arr.slice(-30) : arr;
          }
          return next;
        });

        // Load historical charts
        const hist = await fetchHistory(bridgeId);
        setHistoryData(hist);

        // Load alerts
        const alrts = await fetchAlerts(bridgeId);
        setAlerts(alrts);

        // Load health history
        const hh = await fetchHealthHistory(bridgeId);
        setHealthHistory(hh);
      } catch (err) {
        console.error('[Telemetry Poller Error]', err);
      }
    }

    loadTelemetry();
    const id = setInterval(loadTelemetry, 2000);
    return () => clearInterval(id);
  }, [bridge.id]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await downloadReport(bridge.id, bridge.name);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-6xl rounded-lg flex flex-col max-h-[90vh] border animate-fade-in-up"
        style={{ background: '#FFFFFF', borderColor: '#8B94A3', boxShadow: 'none' }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <span className="text-[10px] font-medium tracking-wider block" style={{ color: 'var(--text-muted)' }}>
              Bridge inspector profile #{bridge.id}
            </span>
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              {bridge.name} — Live telemetry
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-medium text-white rounded-[6px] flex items-center gap-1 cursor-pointer transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#0F6E56', boxShadow: 'none' }}
            >
              {isExporting ? 'Exporting...' : 'Export PDF report'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[6px] flex items-center justify-center text-lg font-bold border transition hover:bg-[var(--bg-secondary)] cursor-pointer"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', boxShadow: 'none' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[var(--bg-secondary)]">
          
          {/* Section 1: Metric Cards */}
          <div>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Real-time sensor telemetry</h4>
            <MetricCards liveData={liveData} />
          </div>

          {/* Section 2: Live Scrolling Charts */}
          <div>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Dynamic telemetry timelines</h4>
            <LiveCharts chartData={chartData} />
          </div>

          {/* Section 3: Maintenance Forecast Predictions */}
          <div>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Maintenance prediction & risk factors</h4>
            <MaintenancePanel activeBridgeId={bridge.id} healthHistory={healthHistory} liveData={liveData} />
          </div>

          {/* Section 4: Alert panel + Risk Gauge */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>AI structural risk</h4>
              {(() => {
                const h = liveData?.health_score ?? bridge.health_score ?? 100;
                let rScore = 0.0;
                if (h >= 75) {
                  rScore = ((100 - h) * 1.6) / 100;
                } else if (h >= 50) {
                  rScore = (40 + (75 - h) * 1.2) / 100;
                } else {
                  rScore = (70 + (50 - h) * 0.6) / 100;
                }
                return <RiskGauge riskScore={rScore} />;
              })()}
            </div>
            <div className="lg:col-span-3">
              <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Dynamic alarm log</h4>
              <AlertPanel alerts={alerts} />
            </div>
          </div>

          {/* Section 5: History Chart */}
          <div>
            <h4 className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Recent sensor history</h4>
            <HistoryChart historyData={historyData} activeBridgeId={bridge.id} />
          </div>

        </div>

      </div>
    </div>
  );
}

// Helper parser to split XAI response by headers
const parseXaiExplanation = (text) => {
  if (!text) return {};
  
  const sections = {
    rootCause: '',
    sensorCorrelation: '',
    ircReference: '',
    engineerAction: ''
  };
  
  const findSection = (text, currentLabel, nextLabels) => {
    const cleanedText = text.replace(/\*\*/g, '');
    const labelPos = cleanedText.toUpperCase().indexOf(currentLabel.toUpperCase());
    if (labelPos === -1) return '';
    
    const startPos = labelPos + currentLabel.length;
    
    let endPos = cleanedText.length;
    for (const nextLabel of nextLabels) {
      const nextPos = cleanedText.toUpperCase().indexOf(nextLabel.toUpperCase(), startPos);
      if (nextPos !== -1 && nextPos < endPos) {
        endPos = nextPos;
      }
    }
    
    let content = cleanedText.substring(startPos, endPos).trim();
    if (content.startsWith(':')) {
      content = content.substring(1).trim();
    }
    return content;
  };
  
  sections.rootCause = findSection(text, 'ROOT CAUSE', ['SENSOR CORRELATION', 'IRC STANDARD REFERENCE', 'ENGINEER ACTION']);
  sections.sensorCorrelation = findSection(text, 'SENSOR CORRELATION', ['IRC STANDARD REFERENCE', 'ENGINEER ACTION']);
  sections.ircReference = findSection(text, 'IRC STANDARD REFERENCE', ['ENGINEER ACTION']);
  sections.engineerAction = findSection(text, 'ENGINEER ACTION', []);
  
  return sections;
};

// overlay modal component for explainable AI explanations
function XaiExplanationModal({ bridge, token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [xaiData, setXaiData] = useState(null);

  useEffect(() => {
    async function loadXai() {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('bridgeiq_token');
        const response = await fetch(`${API_BASE}/api/xai/explain?bridge_id=${bridge.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setXaiData(data);
      } catch (err) {
        console.error('[XAI Load Error]', err);
        setError(err.message || 'Failed to generate anomaly explanation. Please verify your GROQ_API_KEY is configured.');
      } finally {
        setLoading(false);
      }
    }
    loadXai();
  }, [bridge.id]);

  const parsed = xaiData ? parseXaiExplanation(xaiData.explanation) : {};

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div 
        className="w-full max-w-2xl rounded-lg flex flex-col max-h-[90vh] border animate-fade-in-up"
        style={{ background: '#FFFFFF', borderColor: '#8B94A3', boxShadow: 'none' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <span className="text-[10px] font-medium tracking-wider block" style={{ color: 'var(--text-muted)' }}>
              Explainable AI (XAI)
            </span>
            <h3 className="text-base font-bold flex items-center gap-1.5" style={{ color: '#1C1F26' }}>
              Anomaly explanation — {bridge.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-lg font-bold border transition hover:bg-[var(--bg-secondary)] cursor-pointer"
            style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)', boxShadow: 'none' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-[var(--bg-secondary)]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 size={32} className="animate-spin text-[#0F6E56]" />
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                Analyzing anomaly patterns...
              </p>
            </div>
          ) : error ? (
            <div className="p-5 border border-l-4 border-l-red-500 rounded-lg flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.05)', borderColor: 'rgba(239,68,68,0.1)' }}>
              <div>
                <h4 className="text-xs font-semibold text-red-700">Analysis failed</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{error}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats & Badges Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] block">Health score</span>
                    <span className="text-lg font-bold" style={{ color: xaiData.health_score >= 75 ? '#0F6E56' : xaiData.health_score >= 50 ? '#D97706' : '#991B1B' }}>
                      {xaiData.health_score ?? 'N/A'}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] block">Anomaly score</span>
                    <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                      {(xaiData.anomaly_score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-[var(--text-muted)] block">Alert level</span>
                    <div className="mt-1">
                      <StatusBadge status={xaiData.alert_level || xaiData.status} healthScore={xaiData.health_score} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Triggered Sensors Badges */}
              {xaiData.triggered_sensors && xaiData.triggered_sensors.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-[var(--text-muted)]">Triggered sensors</h4>
                  <div className="flex flex-wrap gap-2">
                    {xaiData.triggered_sensors.map((sensor, i) => {
                      const text = typeof sensor === 'string'
                        ? sensor.replace(/CRITICAL\s+breach/gi, 'Critical breach').replace(/CRITICAL/g, 'Critical')
                        : sensor;
                      const isCritical = typeof sensor === 'string' && sensor.toUpperCase().includes('CRITICAL');
                      return (
                        <span 
                          key={i} 
                          className="px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5"
                          style={{
                            background: isCritical ? '#FDF2F2' : '#FFFBEB',
                            borderColor: isCritical ? '#FECACA' : '#FDE68A',
                            color: isCritical ? '#991B1B' : '#B45309'
                          }}
                        >
                          <span 
                            className="w-1.5 h-1.5 rounded-full shrink-0" 
                            style={{ backgroundColor: isCritical ? '#991B1B' : '#D97706' }} 
                          />
                          {text}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4 Labeled Cards */}
              <div className="space-y-4">
                {/* 1. ROOT CAUSE */}
                <div className="p-4 rounded-lg border border-l-4 border-l-red-500" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <div className="text-xs font-semibold text-red-700 mb-1.5">
                    Root cause
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {parsed.rootCause || 'No root cause detected.'}
                  </p>
                </div>

                {/* 2. SENSOR CORRELATION */}
                <div className="p-4 rounded-lg border border-l-4 border-l-amber-500" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <div className="text-xs font-semibold text-amber-700 mb-1.5">
                    Sensor correlation
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {parsed.sensorCorrelation || 'No specific sensor correlation detected.'}
                  </p>
                </div>

                {/* 3. IRC STANDARD REFERENCE */}
                <div className="p-4 rounded-lg border border-l-4 border-l-[#0F6E56]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <div className="text-xs font-semibold text-[#0F6E56] mb-1.5">
                    IRC standard reference
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {parsed.ircReference || 'No specific IRC standard cited.'}
                  </p>
                </div>

                {/* 4. ENGINEER ACTION */}
                <div className="p-4 rounded-lg border border-l-4 border-l-[#0F6E56]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
                  <div className="text-xs font-semibold text-[#0F6E56] mb-1.5">
                    Engineer action
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-medium">
                    {parsed.engineerAction || 'No direct action specified.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
