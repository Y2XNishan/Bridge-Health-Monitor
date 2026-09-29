import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatHealthScore } from '../components/StatusBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
import ReactMarkdown from 'react-markdown';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, 
         Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { 
  Clock, 
  Search, 
  TrendingDown, 
  AlertTriangle, 
  RefreshCw,
  Sparkles,
  Clock3,
  BarChart2,
  Activity,
  MousePointerClick,
  Play,
  HardHat,
  Check
} from 'lucide-react';

const loadingSteps = [
  "Fetching live sensor data...",
  "Calculating degradation rate...",
  "Running survival model...",
  "Generating maintenance schedule..."
];

const URGENCY_CONFIG = {
  CRITICAL: { color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
  HIGH: { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
  MEDIUM: { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
  LOW: { color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' }
};

export default function SurvivalAnalysis() {
  const navigate = useNavigate();
  const [allBridges, setAllBridges] = useState([]);
  const [selectedDropdownId, setSelectedDropdownId] = useState(null);
  const [selectedBridgeId, setSelectedBridgeId] = useState(null);
  const [selectedBridgeData, setSelectedBridgeData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTop10Only, setShowTop10Only] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [repairDay, setRepairDay] = useState(0);
  const [repairType, setRepairType] = useState('full');
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(true);

  // Load bridges list on mount
  useEffect(() => {
    loadBridges();
  }, []);

  const loadBridges = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const token = localStorage.getItem('bridgeiq_token');
      const response = await fetch(`${API_BASE}/api/survival/all`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAllBridges(data.bridges || []);
      
      // Auto-select first bridge if nothing is selected
      if (data.bridges && data.bridges.length > 0 && !selectedBridgeId) {
        const firstId = data.bridges[0].bridge_id;
        setSelectedDropdownId(firstId);
        setSelectedBridgeId(firstId);
        fetchDetailedAnalysis(firstId);
      }
    } catch (err) {
      console.error('[Fetch All Bridges Error]', err);
      setError('Failed to fetch bridges survival overview. Make sure backend is running.');
    } finally {
      setRefreshing(false);
    }
  };

  const fetchDetailedAnalysis = async (bridgeId) => {
    if (!bridgeId) return;
    setLoading(true);
    setError(null);
    setSelectedBridgeData(null);
    setLoadingStep(0);
    setRepairDay(0);
    setRepairType('full');

    // Cycle through steps
    const stepInterval = setInterval(() => {
      setLoadingStep(prev => {
        if (prev >= loadingSteps.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    try {
      const token = localStorage.getItem('bridgeiq_token');
      const response = await fetch(`${API_BASE}/api/survival/predict?bridge_id=${bridgeId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.status === 401) {
        throw new Error("Session expired. Please re-login.");
      }
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const result = await response.json();
      
      // small final pause for visual transition
      await new Promise(resolve => setTimeout(resolve, 600));
      setSelectedBridgeData(result);
      
      // Smooth scroll animation to schedule
      setTimeout(() => {
        document.getElementById('maintenance-schedule')?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }, 800);
    } catch (err) {
      console.error('[fetch-detailed-analysis-error]', err);
      setError(err.message || 'Advanced survival analysis failed. Please verify your GROQ_API_KEY is configured.');
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const handleAnalyzeBridge = (bridgeId) => {
    setSelectedDropdownId(bridgeId);
    setSelectedBridgeId(bridgeId);
    fetchDetailedAnalysis(bridgeId);
  };


  const handleRunAnalysis = () => {
    if (selectedDropdownId) {
      setSelectedBridgeId(selectedDropdownId);
      fetchDetailedAnalysis(selectedDropdownId);
    }
  };

  // Filter and sort bridges list based on search and toggle
  const filteredBridges = allBridges
    .filter(b => b.bridge_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => a.days_to_critical - b.days_to_critical);

  const displayBridges = showTop10Only ? filteredBridges.slice(0, 10) : filteredBridges;

  // Compute overall network statistics for priority counts
  const stats = {
    CRITICAL: allBridges.filter(b => b.urgency === 'CRITICAL').length,
    HIGH: allBridges.filter(b => b.urgency === 'HIGH').length,
    MEDIUM: allBridges.filter(b => b.urgency === 'MEDIUM').length,
    LOW: allBridges.filter(b => b.urgency === 'LOW').length,
  };

  // Calculate exact future date helper
  const getExactFutureDate = (days) => {
    if (days === 999) return 'Never';
    if (days === 0) return 'Immediate';
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDaysToCritical = (days) => {
    if (days === 0) return <span style={{color: '#ef4444', fontWeight: 700, fontSize: '10px'}}>Already Critical</span>;
    if (days > 365) return <span style={{color: '#22c55e', fontWeight: 600}}>365+ days</span>;
    return <span style={{color: days <= 14 ? '#ef4444' : days <= 30 ? '#f97316' : '#22c55e', fontWeight: 600}}>{days} days</span>;
  };

  const formatDaysToFailure = (days) => {
    if (days === 0) return <span style={{color: '#ef4444', fontWeight: 700, fontSize: '10px'}}>Already Failed</span>;
    if (days > 500) return <span style={{color: '#64748b', fontWeight: 600}}>500+ days</span>;
    return <span style={{color: days <= 7 ? '#ef4444' : days <= 30 ? '#f97316' : '#64748b', fontWeight: 600}}>{days} days</span>;
  };

  // Helper to parse maintenance schedule text into sections
  const parseMaintenanceSchedule = (text) => {
    if (!text) return { immediate: '', scheduled: '', longTerm: '' };

    const immediateRegex = /\*\*IMMEDIATE ACTIONS\*\*/i;
    const scheduledRegex = /\*\*SCHEDULED MAINTENANCE\*\*/i;
    const longTermRegex = /\*\*LONG-TERM MONITORING\*\*/i;

    const posImm = text.search(immediateRegex);
    const posSch = text.search(scheduledRegex);
    const posLt = text.search(longTermRegex);

    let immediate = '';
    let scheduled = '';
    let longTerm = '';

    if (posImm !== -1 && posSch !== -1 && posLt !== -1) {
      immediate = text.substring(posImm, posSch).trim();
      scheduled = text.substring(posSch, posLt).trim();
      longTerm = text.substring(posLt).trim();
    } else {
      // fallback line split
      const lines = text.split('\n');
      let currentSection = '';
      lines.forEach(line => {
        if (line.match(/immediate/i)) currentSection = 'imm';
        else if (line.match(/scheduled/i)) currentSection = 'sch';
        else if (line.match(/long-term|long term/i)) currentSection = 'lt';
        else {
          if (currentSection === 'imm') immediate += line + '\n';
          else if (currentSection === 'sch') scheduled += line + '\n';
          else if (currentSection === 'lt') longTerm += line + '\n';
        }
      });
    }

    const clean = (str, regex) => {
      return str.replace(regex, '').replace(/^[:\s\-*]+/, '').trim();
    };

    return {
      immediate: clean(immediate, immediateRegex),
      scheduled: clean(scheduled, scheduledRegex),
      longTerm: clean(longTerm, longTermRegex)
    };
  };

  // What-If Simulator calculations
  const renderWhatIfSimulator = () => {
    if (!selectedBridgeData) return null;

    const currentHealth = Number(selectedBridgeData.health_score) || 100;
    const degradationRate = Number(selectedBridgeData.degradation_rate) || 0.1;
    const daysToFailure = Math.max(0, (currentHealth - 20) / degradationRate);

    // Get health boost based on type
    let healthBoost = 60;
    if (repairType === 'crack') {
      healthBoost = 25;
    } else if (repairType === 'load') {
      healthBoost = 10;
    }

    const calcSurvival = (repairDayVal, currentHealthVal, degradationRateVal, healthBoostVal) => {
      const healthAtRepairVal = Math.max(20, currentHealthVal - (degradationRateVal * repairDayVal));
      
      if (healthAtRepairVal <= 20) {
        return { failed: true, healthAfter: 0, totalDays: 0 };
      }
      
      const healthAfterRepairVal = Math.min(100, healthAtRepairVal + healthBoostVal);
      const daysAfterRepairVal = Math.max(0, (healthAfterRepairVal - 20) / degradationRateVal);
      const totalDays = Math.round(repairDayVal + daysAfterRepairVal);
      
      return { 
        failed: false, 
        healthAfter: parseFloat(healthAfterRepairVal.toFixed(1)),
        totalDays 
      };
    };

    const repairInfo = calcSurvival(repairDay, currentHealth, degradationRate, healthBoost);
    const healthAtRepairTime = Math.max(20, currentHealth - (degradationRate * repairDay));
    const healthAfterRepair = repairInfo.healthAfter;
    const totalSurvivalDays = repairInfo.totalDays;
    const isFailedBeforeRepair = repairInfo.failed;
    const costSaved = totalSurvivalDays * 45000;

    const getSliderDate = (days) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const nextInspectionDate = getSliderDate(Math.round(totalSurvivalDays));

    const daysWithoutRepair = Math.round((currentHealth - 20) / degradationRate);
    const chartMax = Math.min(120, Math.max(daysWithoutRepair + 5, totalSurvivalDays + 10));

    // Generate Chart Data
    const generateChartData = () => {
      console.log("[generateChartData] repairDay =", repairDay);
      const data = [];
      const chartMaxVal = chartMax;
      
      for (let day = 0; day <= chartMaxVal; day++) {
        // Without repair
        const woHealth = currentHealth - (degradationRate * day);
        const withoutRepairValue = woHealth >= 20 ? 
          parseFloat(woHealth.toFixed(1)) : null;
        
        // With repair
        let withRepairValue = null;
        
        if (day < repairDay) {
          // Before repair: show degrading health (same as without)
          const h = currentHealth - (degradationRate * day);
          withRepairValue = h >= 20 ? parseFloat(h.toFixed(1)) : null;
        } else if (day === repairDay) {
          // AT repair day: show the REPAIRED health (jump up)
          withRepairValue = parseFloat(healthAfterRepair.toFixed(1));
        } else {
          // After repair: degrade from repaired health
          const h = healthAfterRepair - (degradationRate * (day - repairDay));
          withRepairValue = h >= 20 ? parseFloat(h.toFixed(1)) : null;
        }
        
        data.push({ day, withRepair: withRepairValue, withoutRepair: withoutRepairValue });
      }
      
      // CRITICAL: Insert an extra point just before repair day
      // to make the jump visible in recharts
      const preRepairHealth = currentHealth - (degradationRate * repairDay);
      const preRepairIndex = data.findIndex(d => d.day === repairDay);
      if (preRepairIndex >= 0) {
        data.splice(preRepairIndex, 0, {
          day: repairDay,
          withRepair: parseFloat(preRepairHealth.toFixed(1)),
          withoutRepair: data[preRepairIndex].withoutRepair
        });
      }
      
      return data;
    };
    
    const chartData = generateChartData();

    // Generate scenarios for comparison table
    const scenarios = [0, 7, 15].map(day => {
      const res = calcSurvival(day, currentHealth, degradationRate, healthBoost);
      return {
        repairDay: day,
        healthAfter: res.failed ? null : res.healthAfter,
        totalDays: res.failed ? 0 : res.totalDays,
        failed: res.failed
      };
    });

    console.log("[WhatIfSimulator] scenarios totalDays:", scenarios.map(s => `Day ${s.repairDay}: ${s.totalDays} days`));

    return (
      <div 
        style={{ 
          backgroundColor: '#ffffff', 
          borderWidth: '0.5px', 
          borderColor: 'var(--border-subtle)', 
          borderRadius: '10px',
          overflow: 'hidden'
        }} 
        className="mt-6 flex flex-col transition-all"
      >
        {/* Header (Collapsible) */}
        <div 
          onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
          style={{ 
            backgroundColor: isSimulatorOpen ? '#0f172a' : '#f8fafc',
            color: isSimulatorOpen ? '#ffffff' : 'var(--text-primary)',
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            transition: 'all 0.2s ease'
          }}
          className="border-b"
        >
          <div>
            <h3 className="text-xs font-bold tracking-wider flex items-center gap-1.5">
              <span>What-if repair simulator</span>
            </h3>
            <p className="text-[10px] opacity-80 mt-0.5">Simulate the impact of repair timing and type</p>
          </div>
          <span className="text-xs">{isSimulatorOpen ? '▼' : '▲'}</span>
        </div>

        {isSimulatorOpen && (
          <div className="p-4 space-y-4 bg-white text-slate-800 text-xs">
            
            {/* 2. CURRENT STATE CARD (read-only) */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Current Health:</span>
                <span className="font-black text-slate-700">{currentHealth.toFixed(1)}/100</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-slate-500">Degradation Rate:</span>
                <span className="font-black text-slate-700">{degradationRate.toFixed(3)} pts/day</span>
              </div>
              <div className="text-red-700 font-bold mt-1 text-center">
                Without any repair → fails in {Math.round(daysToFailure)} days
              </div>
            </div>

            {/* 3. REPAIR DATE SLIDER */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-bold tracking-wider text-[10px] text-slate-500">Repair date</label>
                <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Day {repairDay} — {getSliderDate(repairDay)}
                </span>
              </div>
              <input 
                type="range"
                min="0"
                max="30"
                value={repairDay}
                onChange={(e) => setRepairDay(Number(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: repairDay > daysToFailure ? '#FEE2E2' : '#E2E8F0',
                  outline: 'none',
                }}
              />
              {repairDay > daysToFailure && (
                <p className="text-red-700 font-semibold text-[10px]">
                  Bridge may fail before this repair date
                </p>
              )}
            </div>

            {/* 4. REPAIR TYPE SELECTOR */}
            <div className="space-y-1.5">
              <label className="font-black tracking-wider text-[10px] text-slate-500">Repair type</label>
              <div className="flex flex-col gap-1.5">
                {[
                  { id: 'full', label: 'Full Structural Repair (+60)' },
                  { id: 'crack', label: 'Crack Sealing Only (+25)' },
                  { id: 'load', label: 'Load Restriction Only (+10)' }
                ].map((type) => {
                  const isSelected = repairType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setRepairType(type.id)}
                      className="w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? '#1C1F26' : '#ffffff',
                        borderColor: isSelected ? '#1C1F26' : '#cbd5e1',
                        color: isSelected ? '#ffffff' : '#334155',
                        fontWeight: isSelected ? '600' : '400'
                      }}
                    >
                      <span>{type.label}</span>
                      {isSelected && <Check size={14} color="#ffffff" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. PREDICTION RESULT CARD */}
            {isFailedBeforeRepair ? (
              <div className="p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-700 font-bold space-y-1">
                <p className="text-center text-xs">
                  Critical: Bridge will fail before day {repairDay}. Immediate action required.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-lg border border-green-200 bg-green-50 space-y-2 text-slate-700">
                <div className="flex justify-between border-b border-green-200/50 pb-1.5">
                  <span>Health at repair time:</span>
                  <span className="font-bold">{healthAtRepairTime.toFixed(1)}/100</span>
                </div>
                <div className="flex justify-between border-b border-green-200/50 pb-1.5">
                  <span>Health after repair:</span>
                  <span className="font-bold text-green-600">{healthAfterRepair.toFixed(1)}/100</span>
                </div>
                <div className="text-center py-1.5 border-b border-green-200/50">
                  <span className="block text-[10px] font-bold tracking-wider text-green-700">Extended lifetime</span>
                  <span className="text-lg font-black text-green-700">{totalSurvivalDays} more days</span>
                </div>
                <div className="flex justify-between pt-1 text-[10px]">
                  <span>Next Inspection:</span>
                  <span className="font-bold">{nextInspectionDate}</span>
                </div>
                <div className="flex justify-between text-[10px] text-green-700 font-bold">
                  <span>Emergency Cost Saved:</span>
                  <span>₹{(costSaved/100000).toFixed(1)} Lac</span>
                </div>
              </div>
            )}

            {/* 6. COMPARISON CHART */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="font-black tracking-wider text-[10px] text-slate-500">Repair trajectory graph</label>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="day" 
                      type="number"
                      domain={[0, chartMax]} 
                      tick={{ fontSize: 9 }}
                      stroke="#94a3b8"
                      label={{ value: 'Days from today', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fontSize: 9 }}
                      stroke="#94a3b8"
                    />
                    <Tooltip 
                      contentStyle={{ fontSize: 10, borderRadius: 6, borderColor: '#e2e8f0' }}
                      labelFormatter={(label) => `Day ${label}`}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={20} 
                      iconSize={8}
                      wrapperStyle={{ fontSize: 9 }}
                    />
                    <ReferenceLine 
                      y={40} 
                      stroke="#EF4444" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Critical threshold', fill: '#EF4444', fontSize: 8, position: 'insideBottomRight' }} 
                    />
                    <ReferenceLine 
                      y={20} 
                      stroke="#EF4444" 
                      strokeDasharray="3 3" 
                      label={{ value: 'Failure', fill: '#EF4444', fontSize: 8, position: 'insideBottomRight' }} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="withoutRepair" 
                      name="Without Repair"
                      stroke="#ef4444" 
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="withRepair" 
                      name="With Repair"
                      stroke="#10b981" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 7. QUICK COMPARISON TABLE */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="font-black tracking-wider text-[10px] text-slate-500">Timing comparison table</label>
              <table className="w-full text-left text-[11px] border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5 font-bold border-b border-slate-200">Repair Time</th>
                    <th className="px-2 py-1.5 font-bold border-b border-slate-200 text-center">Health After</th>
                    <th className="px-2 py-1.5 font-bold border-b border-slate-200 text-center">Survives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {scenarios.map(sc => (
                    <tr key={sc.repairDay}>
                      <td className="px-2 py-1.5 font-semibold">
                        {sc.repairDay === 0 ? 'Today (Day 0)' : `Day ${sc.repairDay}`}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {sc.failed ? (
                          <span className="text-red-500 font-bold">Failed</span>
                        ) : (
                          <span className="text-green-600 font-semibold">{sc.healthAfter}/100</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-center font-bold">
                        {sc.failed ? (
                          <span className="text-red-500 font-bold">0 days</span>
                        ) : (
                          <span className="text-green-600 font-bold">{sc.totalDays} days</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
            <Clock className="text-slate-700" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Predictive maintenance</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Survival analysis — time-to-failure predictions for all bridges
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={loadBridges} 
            disabled={refreshing}
            className="px-4 py-2 rounded-lg border text-xs font-bold flex items-center gap-2 transition-all hover:bg-white/5 disabled:opacity-50 cursor-pointer"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Network Urgency Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: 'CRITICAL', label: 'Critical Priority', count: stats.CRITICAL, style: URGENCY_CONFIG.CRITICAL },
          { key: 'HIGH', label: 'High Priority', count: stats.HIGH, style: URGENCY_CONFIG.HIGH },
          { key: 'MEDIUM', label: 'Medium Priority', count: stats.MEDIUM, style: URGENCY_CONFIG.MEDIUM },
          { key: 'LOW', label: 'Low Priority', count: stats.LOW, style: URGENCY_CONFIG.LOW },
        ].map((item) => (
          <div key={item.key} className="rounded-xl border p-4 transition-all hover:scale-[1.01]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: item.style.color }} />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{item.count}</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>bridges</span>
            </div>
          </div>
        ))}
      </div>

      {/* Two Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Pane: Priority Overview List */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl border flex flex-col h-full" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}>
            
            {/* Table Header Controls */}
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <TrendingDown className="text-orange-400" size={16} />
                <span className="text-xs font-black tracking-wider" style={{ color: 'var(--text-primary)' }}>Bridges health degradation priority</span>
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {/* Search */}
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" size={14} />
                  <input 
                    type="text"
                    placeholder="Search bridge..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full sm:w-44 pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none bg-[var(--bg-secondary)]"
                    style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  />
                </div>
                {/* Top 10 Toggle */}
                <button
                  onClick={() => setShowTop10Only(!showTop10Only)}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all hover:bg-white/5 whitespace-nowrap"
                  style={{ background: showTop10Only ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)', borderColor: showTop10Only ? 'rgba(59, 130, 246, 0.3)' : 'var(--border-subtle)', color: showTop10Only ? '#60a5fa' : 'var(--text-primary)' }}
                >
                  {showTop10Only ? 'Show All' : 'Show Top 10'}
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  <tr>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest">Bridge Name</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center">Health</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center">Days to Critical</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center">Days to Failure</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center">Urgency</th>
                    <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBridges.map((bridge) => {
                    const isSelected = selectedBridgeId === bridge.bridge_id;
                    const urgencyConf = URGENCY_CONFIG[bridge.urgency] || URGENCY_CONFIG.LOW;
                    
                    return (
                      <tr 
                        key={bridge.bridge_id} 
                        onClick={() => handleAnalyzeBridge(bridge.bridge_id)}
                        className={`border-t transition-all duration-200 cursor-pointer hover:bg-white/5 ${isSelected ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}`}
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <td className="px-4 py-3 font-bold" style={{ color: isSelected ? '#60a5fa' : 'var(--text-primary)' }}>
                          {bridge.bridge_name}
                          <span className="block text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>ID: #{bridge.bridge_id}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold" style={{ color: 'var(--text-primary)' }}>
                          {typeof bridge.health_score === 'number' ? bridge.health_score.toFixed(1) : bridge.health_score}/100
                        </td>
                        <td className="px-4 py-3 text-center font-black">
                          {formatDaysToCritical(bridge.days_to_critical)}
                        </td>
                        <td className="px-4 py-3 text-center font-black">
                          {formatDaysToFailure(bridge.days_to_failure)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span 
                            className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border" 
                            style={{ 
                              color: urgencyConf.color, 
                              backgroundColor: urgencyConf.bg, 
                              borderColor: `${urgencyConf.color}44` 
                            }}
                          >
                            {bridge.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnalyzeBridge(bridge.bridge_id);
                              }}
                              className="px-3 py-1 rounded border text-[10px] font-bold transition-all hover:bg-blue-500/20 cursor-pointer whitespace-nowrap"
                              style={{ background: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}
                            >
                              Analyze
                            </button>
                            {(bridge.urgency === 'CRITICAL' || bridge.urgency === 'HIGH') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/maintenance', { 
                                    state: { 
                                      preselectedBridge: { 
                                        id: bridge.bridge_id, 
                                        name: bridge.bridge_name 
                                      } 
                                    } 
                                  });
                                }}
                                className="flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
                                style={{
                                  border: '0.5px solid #fed7aa',
                                  backgroundColor: '#fff7ed',
                                  color: '#c2410c',
                                  fontSize: '10px',
                                  padding: '3px 8px',
                                  borderRadius: '5px',
                                  fontWeight: 'bold',
                                }}
                              >
                                <HardHat size={10} />
                                Assign Crew
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {displayBridges.length === 0 && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        No bridges found matching search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Pane: Detailed Analysis & Maintenance Planning */}
        <div className="lg:col-span-1" style={{ transition: 'all 0.3s ease-in-out' }}>
          <div className="rounded-xl border p-5 flex flex-col min-h-[500px]" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)', transition: 'all 0.3s ease-in-out' }}>
            
            {/* Control selector */}
            <div className="mb-4 space-y-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              <div>
                <span className="block text-[10px] font-bold tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Select bridge to analyze</span>
                <select
                  className="w-full rounded-lg border bg-[var(--bg-secondary)] px-3 py-2 text-xs font-bold outline-none cursor-pointer"
                  style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  value={selectedDropdownId || ''}
                  onChange={(e) => setSelectedDropdownId(Number(e.target.value))}
                >
                  <option value="" disabled>-- Select bridge --</option>
                  {allBridges.map((b) => (
                    <option key={b.bridge_id} value={b.bridge_id}>{b.bridge_name} (#{b.bridge_id})</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleRunAnalysis}
                disabled={!selectedDropdownId || loading}
                className="w-full py-2 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                style={(!selectedDropdownId || loading) ? {
                  backgroundColor: '#ffffff',
                  borderColor: '#e2e8f0',
                  color: '#cbd5e1',
                } : {
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  borderColor: 'rgba(59, 130, 246, 0.2)',
                  color: '#3b82f6',
                }}
              >
                <Play size={10} fill={(!selectedDropdownId || loading) ? "#cbd5e1" : "#3b82f6"} stroke="none" />
                Run survival analysis
              </button>
            </div>

            {/* Error State */}
            {error && (
              <div className="p-4 rounded-lg border border-red-500/30 text-xs text-red-400 bg-red-950/20 flex gap-2.5 mb-4 items-start">
                <AlertTriangle className="shrink-0" size={16} />
                <div>{error}</div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px',
                gap: '16px'
              }}>
                <div style={{
                  width: '36px', height: '36px',
                  border: '3px solid #E2E8F0',
                  borderTop: '3px solid #0F6E56',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <div style={{color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500}}>
                  {loadingSteps[loadingStep]}
                </div>
                <div style={{display: 'flex', gap: '6px'}}>
                  {loadingSteps.map((_, i) => (
                    <div key={i} style={{
                      width: '7px', height: '7px',
                      borderRadius: '50%',
                      background: i <= loadingStep ? '#0F6E56' : '#E2E8F0',
                      transition: 'background 0.2s ease'
                    }} />
                  ))}
                </div>
              </div>
            )}

            {!loading && selectedBridgeData ? (
              
              /* Details Content */
              <div className="space-y-5 flex-1 overflow-y-auto max-h-[85vh] pr-1">
                
                {/* Bridge Detail Header */}
                <div className="border-b pb-3.5" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h2 className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{selectedBridgeData.bridge_name}</h2>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Status: {selectedBridgeData.alert_level} | Health: {formatHealthScore(selectedBridgeData.health_score)}/100</span>
                    </div>
                    <span 
                      className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shrink-0"
                      style={{ 
                        color: URGENCY_CONFIG[selectedBridgeData.urgency]?.color || 'var(--text-primary)',
                        backgroundColor: URGENCY_CONFIG[selectedBridgeData.urgency]?.bg || 'transparent',
                        border: `1px solid ${URGENCY_CONFIG[selectedBridgeData.urgency]?.color}33`
                      }}
                    >
                      {selectedBridgeData.urgency} Urgency
                    </span>
                  </div>
                </div>

                {/* Predictions Grid */}
                <div className="space-y-2">
                  <span className="text-[9px] font-black tracking-widest text-[var(--text-secondary)]">Survival forecast (days remaining)</span>
                  <div className="grid grid-cols-3 gap-2">
                    
                    {(() => {
                      const prediction = selectedBridgeData.survival_predictions?.days_to_warning;
                      return (
                        <div className="p-3 rounded-lg border text-center border-amber-500/20" style={{ background: 'var(--bg-secondary)' }}>
                          <span className="block text-[8px] font-black tracking-widest text-amber-500 mb-1">To warning</span>
                          <span className="text-sm font-black block" style={{ color: prediction === 0 ? '#ef4444' : prediction > 365 ? '#10b981' : '#f59e0b' }}>
                            {prediction === 0 ? 'Immediate' : prediction > 365 ? '365+ days' : `${prediction} days`}
                          </span>
                          <span className="block text-[8px] font-bold text-amber-500/80 mt-1">{getExactFutureDate(prediction)}</span>
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      const prediction = selectedBridgeData.survival_predictions?.days_to_critical;
                      return (
                        <div className="p-3 rounded-lg border text-center border-orange-500/20" style={{ background: 'var(--bg-secondary)' }}>
                          <span className="block text-[8px] font-black tracking-widest text-orange-500 mb-1">To critical</span>
                          <span className="text-sm font-black block" style={{ color: prediction === 0 ? '#ef4444' : prediction > 365 ? '#10b981' : '#f59e0b' }}>
                            {prediction === 0 ? 'Immediate' : prediction > 365 ? '365+ days' : `${prediction} days`}
                          </span>
                          <span className="block text-[8px] font-bold text-orange-500/80 mt-1">{getExactFutureDate(prediction)}</span>
                        </div>
                      );
                    })()}
                    
                    {(() => {
                      const prediction = selectedBridgeData.survival_predictions?.days_to_failure;
                      return (
                        <div className="p-3 rounded-lg border text-center border-red-500/20" style={{ background: 'var(--bg-secondary)' }}>
                          <span className="block text-[8px] font-black tracking-widest text-red-500 mb-1">To failure</span>
                          <span className="text-sm font-black block" style={{ color: prediction === 0 ? '#ef4444' : prediction > 500 ? '#10b981' : '#ef4444' }}>
                            {prediction === 0 ? 'Immediate' : prediction > 500 ? '500+ days' : `${prediction} days`}
                          </span>
                          <span className="block text-[8px] font-bold text-red-500/80 mt-1">{getExactFutureDate(prediction)}</span>
                        </div>
                      );
                    })()}

                  </div>
                </div>

                {/* Degradation Details */}
                <div className="p-3 rounded-lg border space-y-3 bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold tracking-widest text-[var(--text-secondary)]">Degradation rate dynamics</span>
                    <TrendingDown size={14} className="text-slate-500" />
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xl font-bold text-[var(--text-primary)]">{selectedBridgeData.degradation_rate.toFixed(3)}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>points / day decline</span>
                  </div>

                  {/* Trajectory Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[9px]" style={{ color: 'var(--text-secondary)' }}>
                      <span>Health trajectory (Current: {formatHealthScore(selectedBridgeData.health_score)}/100)</span>
                      <span className="font-medium">Estimated decline</span>
                    </div>
                    <div className="relative w-full h-2.5 rounded-full bg-slate-200 border border-slate-300 overflow-visible">
                      {/* Marker representing current health score */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-800 shadow-sm flex items-center justify-center cursor-default"
                        style={{ left: `${selectedBridgeData.health_score}%` }}
                        title={`Current Health: ${formatHealthScore(selectedBridgeData.health_score)}/100`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                      </div>
                    </div>
                    <div className="flex justify-between text-[8px]" style={{ color: 'var(--text-muted)' }}>
                      <span>0 (Failure)</span>
                      <span>40 (Critical)</span>
                      <span>60 (Warning)</span>
                      <span>100 (Excellent)</span>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-2 space-y-1 text-[10px]" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Base score rate:</span>
                      <span className="font-semibold text-[var(--text-primary)]">{selectedBridgeData.degradation_breakdown?.base_rate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Anomaly penalty:</span>
                      <span className="font-semibold text-[var(--text-primary)]">x{selectedBridgeData.degradation_breakdown?.anomaly_multiplier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Alert level multiplier:</span>
                      <span className="font-semibold text-[var(--text-primary)]">x{selectedBridgeData.degradation_breakdown?.alert_multiplier}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-secondary)' }}>Structural age multiplier:</span>
                      <span className="font-semibold text-[var(--text-primary)]">x{selectedBridgeData.degradation_breakdown?.age_factor}</span>
                    </div>
                  </div>
                </div>

                {/* Sensor Risk Predictions */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold tracking-widest text-[var(--text-secondary)]">Telemetry sensor defect risks</span>
                  {selectedBridgeData.sensor_risks?.length === 0 ? (
                    <div className="p-3 rounded-lg border border-dashed text-center text-xs" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                      No sensors at immediate failure risk
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedBridgeData.sensor_risks.map((sensorRisk, i) => (
                        <div key={i} className="p-3 rounded-lg border space-y-2 bg-[var(--bg-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="block font-bold text-xs" style={{ color: 'var(--text-primary)' }}>{sensorRisk.sensor}</span>
                              <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Current: {sensorRisk.current} / Safe limit: {sensorRisk.threshold}</span>
                            </div>
                            <span 
                              className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider uppercase"
                              style={{ 
                                color: sensorRisk.priority === 'CRITICAL' ? '#991B1B' : sensorRisk.priority === 'HIGH' ? '#D97706' : '#0F6E56',
                                backgroundColor: sensorRisk.priority === 'CRITICAL' ? '#FDF2F2' : sensorRisk.priority === 'HIGH' ? '#FFFBEB' : '#F0FDF4'
                              }}
                            >
                              {sensorRisk.priority}
                            </span>
                          </div>
                          
                          {/* Usage Progress Bar */}
                          <div>
                            <div className="flex justify-between text-[9px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                              <span>Operating wear</span>
                              <span>{sensorRisk.usage_pct}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded bg-[var(--border-subtle)] overflow-hidden">
                              <div 
                                className="h-full rounded transition-all"
                                style={{ 
                                  width: `${Math.min(sensorRisk.usage_pct, 100)}%`,
                                  backgroundColor: sensorRisk.usage_pct > 80 ? '#991B1B' : sensorRisk.usage_pct > 60 ? '#D97706' : '#0F6E56'
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] font-medium text-red-700 bg-red-50 p-1.5 rounded border border-red-100">
                            <span>Failure prediction:</span>
                            <span>~{sensorRisk.days_to_failure} days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Groq AI Maintenance Plan Sections */}
                <div id="maintenance-schedule" className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
                    <HardHat className="text-slate-600" size={15} />
                    <span className="text-[10px] font-bold tracking-wider text-[var(--text-primary)]">AI-generated maintenance schedule</span>
                  </div>

                  {(() => {
                    const { immediate, scheduled, longTerm } = parseMaintenanceSchedule(selectedBridgeData.maintenance_schedule);
                    
                    return (
                      <div className="space-y-3 font-sans">
                        {/* IMMEDIATE ACTIONS */}
                        <div 
                          className="p-3.5 rounded-lg border transition-all hover:scale-[1.01]" 
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.03)', 
                            borderColor: 'rgba(239, 68, 68, 0.25)' 
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                            <h3 className="text-xs font-black text-red-400 tracking-wider">Immediate actions (within 7 days)</h3>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="my-1">{children}</p>,
                                li: ({ children }) => <li className="ml-3 list-disc my-0.5">{children}</li>
                              }}
                            >
                              {immediate || "No immediate actions required."}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {/* SCHEDULED MAINTENANCE */}
                        <div 
                          className="p-3.5 rounded-lg border transition-all hover:scale-[1.01]" 
                          style={{ 
                            background: 'rgba(245, 158, 11, 0.03)', 
                            borderColor: 'rgba(245, 158, 11, 0.25)' 
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                            <h3 className="text-xs font-black text-orange-400 tracking-wider">Scheduled maintenance (7-30 days)</h3>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="my-1">{children}</p>,
                                li: ({ children }) => <li className="ml-3 list-disc my-0.5">{children}</li>
                              }}
                            >
                              {scheduled || "No scheduled maintenance tasks."}
                            </ReactMarkdown>
                          </div>
                        </div>

                        {/* LONG-TERM MONITORING */}
                        <div 
                          className="p-3.5 rounded-lg border transition-all hover:scale-[1.01]" 
                          style={{ 
                            background: 'rgba(16, 185, 129, 0.03)', 
                            borderColor: 'rgba(16, 185, 129, 0.25)' 
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <h3 className="text-xs font-black text-emerald-400 tracking-wider">Long-term monitoring (30+ days)</h3>
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                            <ReactMarkdown
                              components={{
                                p: ({ children }) => <p className="my-1">{children}</p>,
                                li: ({ children }) => <li className="ml-3 list-disc my-0.5">{children}</li>
                              }}
                            >
                              {longTerm || "No long-term monitoring actions specified."}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                {renderWhatIfSimulator()}
              </div>
            ) : !loading ? (
              /* Network Survival Overview (Default State when no bridge selected) */
              <div className="flex-1 flex flex-col space-y-4 pr-1">
                {/* Title */}
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="text-blue-500" size={16} />
                  <span className="text-xs font-black tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Network survival overview
                  </span>
                </div>

                {/* Urgency Summary 2x2 Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Critical */}
                  <div className="p-3.5 flex flex-col justify-between animate-fade-in-up" style={{ backgroundColor: '#fef2f2', borderRadius: '8px' }}>
                    <span className="text-2xl font-black" style={{ color: '#ef4444' }}>{stats.CRITICAL}</span>
                    <span className="text-[11px] font-bold mt-1" style={{ color: '#ef4444' }}>Critical priority</span>
                  </div>
                  {/* High */}
                  <div className="p-3.5 flex flex-col justify-between animate-fade-in-up" style={{ backgroundColor: '#fffbeb', borderRadius: '8px' }}>
                    <span className="text-2xl font-black" style={{ color: '#d97706' }}>{stats.HIGH}</span>
                    <span className="text-[11px] font-bold mt-1" style={{ color: '#d97706' }}>High priority</span>
                  </div>
                  {/* Medium */}
                  <div className="p-3.5 flex flex-col justify-between animate-fade-in-up" style={{ backgroundColor: '#fff7ed', borderRadius: '8px' }}>
                    <span className="text-2xl font-black" style={{ color: '#ea580c' }}>{stats.MEDIUM}</span>
                    <span className="text-[11px] font-bold mt-1" style={{ color: '#ea580c' }}>Medium priority</span>
                  </div>
                  {/* Low */}
                  <div className="p-3.5 flex flex-col justify-between animate-fade-in-up" style={{ backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                    <span className="text-2xl font-black" style={{ color: '#16a34a' }}>{stats.LOW}</span>
                    <span className="text-[11px] font-bold mt-1" style={{ color: '#16a34a' }}>Low priority</span>
                  </div>
                </div>

                {/* Most Urgent - Act Now Card */}
                <div style={{ backgroundColor: '#ffffff', borderWidth: '0.5px', borderColor: 'var(--border-subtle)', borderRadius: '10px' }} className="border overflow-hidden flex flex-col animate-fade-in-up">
                  <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: '#ffffff' }}>
                    <AlertTriangle className="text-red-500" size={14} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Most urgent — act now</span>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                    {(() => {
                      const urgent = [...allBridges]
                        .sort((a, b) => a.days_to_critical - b.days_to_critical)
                        .slice(0, 4);
                      
                      if (urgent.length === 0) {
                        return (
                          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                            No bridges registered.
                          </div>
                        );
                      }

                      return urgent.map((b) => {
                        const isCritical = b.urgency === 'CRITICAL';
                        return (
                          <div key={b.bridge_id} className="p-3 flex justify-between items-center" style={{ backgroundColor: '#ffffff' }}>
                            <div>
                              <div className="font-bold text-xs text-[var(--text-primary)]">{b.bridge_name}</div>
                              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{b.location || 'India'}</div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-bold text-xs" style={{ color: isCritical ? '#ef4444' : '#d97706' }}>
                                {b.days_to_failure} days
                              </div>
                              <div className="mt-1">
                                <span 
                                  className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider"
                                  style={{
                                    color: isCritical ? '#b91c1c' : '#b45309',
                                    backgroundColor: isCritical ? '#fee2e2' : '#fef3c7',
                                  }}
                                >
                                  {isCritical ? 'Critical' : 'High'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Network Health Stats Card */}
                <div style={{ backgroundColor: '#ffffff', borderWidth: '0.5px', borderColor: 'var(--border-subtle)', borderRadius: '10px' }} className="border overflow-hidden flex flex-col animate-fade-in-up">
                  <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: '#ffffff' }}>
                    <Activity className="text-purple-500" size={14} />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Network health stats</span>
                  </div>
                  <div className="p-3 space-y-2.5 text-xs" style={{ backgroundColor: '#ffffff' }}>
                    <div className="flex justify-between items-start py-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>Avg health score</span>
                      <span className="font-bold text-right text-[var(--text-primary)] leading-tight text-xs">
                        {allBridges.length > 0 
                          ? (allBridges.reduce((sum, b) => sum + (b.health_score || 0), 0) / allBridges.length).toFixed(1) 
                          : '0.0'} /<br />100
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>Avg days to critical</span>
                      <span className="font-bold" style={{ color: '#d97706' }}>
                        {(() => {
                          const validDays = allBridges.map(b => b.days_to_critical).filter(d => typeof d === 'number' && d !== 999);
                          return validDays.length > 0 ? Math.round(validDays.reduce((sum, d) => sum + d, 0) / validDays.length) : 0;
                        })()} days
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>Bridges needing action</span>
                      <span className="font-bold" style={{ color: '#ef4444' }}>
                        {stats.CRITICAL + stats.HIGH} bridges
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-0.5">
                      <span style={{ color: 'var(--text-secondary)' }}>Safe bridges (365+ days)</span>
                      <span className="font-bold" style={{ color: '#16a34a' }}>
                        {stats.LOW} bridges
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hint Box */}
                <div className="p-4 rounded-lg text-center text-xs text-blue-800 bg-blue-50/50 border border-blue-100/80 animate-fade-in-up" style={{ borderRadius: '8px' }}>
                  Click any bridge row or select from dropdown above to run detailed survival analysis.
                </div>
              </div>
            ) : null}

          </div>
        </div>

      </div>
    </div>
  );
}
