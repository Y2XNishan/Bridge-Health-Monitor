import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Calendar, Wrench, AlertTriangle, TrendingUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const validItems = payload.filter((item) => item.value !== null && item.value !== undefined);
  if (!validItems.length) return null;
  return (
    <div 
      className="rounded-[6px] px-3 py-2 bg-white border border-slate-200 text-[11px]"
      style={{ boxShadow: 'none' }}
    >
      <p className="font-mono text-slate-500 mb-1">{label}</p>
      {validItems.map((item, idx) => (
        <p key={idx} style={{ color: item.color }} className="font-semibold m-0">
          {item.name}: {item.value?.toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export default function MaintenancePanel({ bridgeId, activeBridgeId, healthHistory, liveData }) {
  const bid = bridgeId || activeBridgeId || 1;
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Fetch maintenance prediction with live telemetry parameters ──
  const fetchPrediction = useCallback(() => {
    const params = new URLSearchParams({ bridge_id: String(bid) });
    if (liveData?.health_score !== undefined && liveData?.health_score !== null) {
      params.append('health_score', String(liveData.health_score));
    }
    if (liveData?.risk_score !== undefined && liveData?.risk_score !== null) {
      params.append('risk_score', String(liveData.risk_score));
    }
    if (liveData?.anomaly_score !== undefined && liveData?.anomaly_score !== null) {
      params.append('anomaly_score', String(liveData.anomaly_score));
    }

    fetch(`${API_BASE}/api/maintenance?${params.toString()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setPrediction(data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[maintenance-fetch-error]', err);
        setError(err.message);
        setLoading(false);
      });
  }, [bid, liveData?.health_score, liveData?.risk_score, liveData?.anomaly_score]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  useEffect(() => {
    const interval = setInterval(fetchPrediction, 5000);
    return () => clearInterval(interval);
  }, [fetchPrediction]);

  // Urgency color configurations using unified muted palette
  const urgencyColors = {
    IMMEDIATE: { text: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
    SOON:      { text: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
    SCHEDULED: { text: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
    GOOD:      { text: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  };

  const currentUrgency = prediction?.urgency || 'GOOD';
  const uCfg = urgencyColors[currentUrgency] || urgencyColors.GOOD;

  // ── Projected health trend line synchronized with live health & decline rate ──
  const regressionData = useMemo(() => {
    const currentHealth = liveData?.health_score ?? prediction?.current_health ?? 
      (healthHistory && healthHistory.length > 0 ? healthHistory[healthHistory.length - 1].health_score : 100);
    const declinePerDay = prediction?.decline_rate ?? 0.25;
    const hourlyDecline = declinePerDay / 24.0;

    const chartData = [];

    // 1. Historical actuals
    if (healthHistory && healthHistory.length > 0) {
      for (let i = 0; i < healthHistory.length; i++) {
        const timeLabel = healthHistory[i].timestamp?.split('T')[1]?.slice(0, 5) || 
                          healthHistory[i].timestamp?.split(' ')[1]?.slice(0, 5) || '';
        chartData.push({
          time: timeLabel,
          health: Math.round(healthHistory[i].health_score * 10) / 10,
          projected: null,
        });
      }
    }

    // 2. Transition anchor at "Now" connecting actual & projected
    chartData.push({
      time: 'Now',
      health: Math.round(currentHealth * 10) / 10,
      projected: Math.round(currentHealth * 10) / 10,
    });

    // 3. Projected points (next 30 hourly readings based on live degradation rate)
    for (let i = 1; i <= 30; i++) {
      const projVal = Math.max(0, Math.min(100, Math.round((currentHealth - hourlyDecline * i) * 10) / 10));
      chartData.push({
        time: `+${i}h`,
        health: null,
        projected: projVal,
      });
    }

    return chartData;
  }, [healthHistory, liveData?.health_score, prediction?.current_health, prediction?.decline_rate]);

  if (loading && !prediction) {
    return (
      <div 
        className="min-h-[160px] flex items-center justify-center bg-white border border-slate-200 rounded-[8px]"
        style={{ boxShadow: 'none' }}
      >
        <span className="text-xs text-slate-400">Generating maintenance forecast...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        className="p-5 text-center bg-white border border-slate-200 rounded-[8px]"
        style={{ boxShadow: 'none' }}
      >
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
          <AlertTriangle size={14} color="#991B1B" />
          Maintenance forecast offline
        </div>
        <p className="text-[11px] mt-1 text-slate-400 m-0">{error}</p>
      </div>
    );
  }

  return (
    <div 
      className="p-5 flex flex-col lg:flex-row gap-6 items-stretch bg-white border border-slate-200 rounded-[8px]"
      style={{ boxShadow: 'none' }}
      id="maintenance-prediction"
    >
      {/* Visual Prediction Panel */}
      <div className="lg:w-[45%] flex flex-col justify-between space-y-4">
        <div>
          {/* Header Title with Calendar icon */}
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
            <Calendar size={14} color="#1C1F26" />
            <h4 className="text-xs font-semibold text-slate-900 m-0">
              Maintenance forecast
            </h4>
          </div>

          {/* Countdown & Urgency Badges */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-slate-900 leading-tight m-0">
              {prediction?.days_until_maintenance <= 0
                ? 'Immediate maintenance required'
                : prediction?.days_until_maintenance >= 365
                ? '365+ days until maintenance'
                : `${prediction?.days_until_maintenance} day${prediction?.days_until_maintenance === 1 ? '' : 's'} until maintenance`}
            </h2>

            {/* Badges container */}
            <div className="flex flex-wrap gap-2 text-[10px] font-medium">
              <span 
                className="px-2 py-0.5 rounded-[4px] border"
                style={{ background: uCfg.bg, borderColor: uCfg.border, color: uCfg.text }}
              >
                Urgency: {currentUrgency.toLowerCase()}
              </span>
              <span 
                className="px-2 py-0.5 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600"
              >
                Confidence: {(prediction?.confidence || 'medium').toLowerCase()}
              </span>
              <span 
                className="px-2 py-0.5 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-600"
              >
                Decline: {prediction?.decline_rate} pts/day
              </span>
            </div>

            <p className="text-xs text-slate-500 m-0">
              Predicted maintenance deadline:{' '}
              <strong className="font-mono text-slate-800">{prediction?.predicted_maintenance_date}</strong>
            </p>
          </div>
        </div>

        {/* Highlighted Recommendation Box */}
        <div 
          className="p-3 rounded-[6px] text-xs leading-relaxed border border-slate-200 bg-slate-50"
        >
          <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
            <Wrench size={13} color="#0F6E56" />
            Recommendation
          </div>
          <p className="text-slate-600 m-0 text-[11px]">{prediction?.recommendation}</p>
        </div>
      </div>

      {/* Regression Forecast Line Chart */}
      <div className="flex-1 min-h-[200px] flex flex-col justify-between">
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <TrendingUp size={13} color="#1C1F26" />
            <h4 className="text-xs font-semibold text-slate-900 m-0">
              Projected health trend & threshold forecast (next 30 hours)
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-500">
            Threshold: 40%
          </span>
        </div>

        <div className="flex-1 min-h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={regressionData} margin={{ top: 5, right: 10, bottom: -10, left: -25 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="2 2" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 8, fill: '#8B94A3' }}
                tickLine={false}
                axisLine={false}
                interval={14}
              />
              <YAxis
                tick={{ fontSize: 8, fill: '#8B94A3' }}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Red Maintenance Threshold trigger line at y=40 */}
              <ReferenceLine
                y={40}
                stroke="#991B1B"
                strokeWidth={1}
                strokeDasharray="4 2"
                label={{
                  value: 'Threshold (40%)',
                  position: 'insideBottomLeft',
                  fill: '#991B1B',
                  fontSize: 8,
                  fontWeight: 500,
                  offset: 5,
                }}
              />

              {/* Historical health scores */}
              <Line
                type="monotone"
                dataKey="health"
                name="Actual health"
                stroke="#0F6E56"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />

              {/* Projected trend forecast line */}
              <Line
                type="monotone"
                dataKey="projected"
                name="Projected forecast"
                stroke="#D97706"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
