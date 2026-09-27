import { useState, useEffect, useMemo } from 'react';
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
  return (
    <div 
      className="rounded-[6px] px-3 py-2 bg-white border border-slate-200 text-[11px]"
      style={{ boxShadow: 'none' }}
    >
      <p className="font-mono text-slate-500 mb-1">{label}</p>
      {payload.map((item, idx) => (
        <p key={idx} style={{ color: item.color }} className="font-semibold m-0">
          {item.name}: {item.value?.toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export default function MaintenancePanel({ bridgeId, activeBridgeId, healthHistory }) {
  const bid = bridgeId || activeBridgeId || 1;
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Fetch maintenance prediction ──
  const fetchPrediction = () => {
    fetch(`${API_BASE}/api/maintenance?bridge_id=${bid}`)
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
  };

  useEffect(() => {
    setLoading(true);
    fetchPrediction();
    const interval = setInterval(fetchPrediction, 30000);
    return () => clearInterval(interval);
  }, [bid]);

  // Urgency color configurations using unified muted palette
  const urgencyColors = {
    IMMEDIATE: { text: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
    SOON:      { text: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
    SCHEDULED: { text: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
    GOOD:      { text: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  };

  const currentUrgency = prediction?.urgency || 'GOOD';
  const uCfg = urgencyColors[currentUrgency] || urgencyColors.GOOD;

  // ── Polyfit Linear Regression logic on the historical points ──
  const regressionData = useMemo(() => {
    if (!healthHistory || healthHistory.length < 2) return [];

    const n = healthHistory.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += healthHistory[i].health_score;
      sumXY += i * healthHistory[i].health_score;
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const chartData = [];

    // 1. Historical actuals + fitted trend line
    for (let i = 0; i < n; i++) {
      const timeLabel = healthHistory[i].timestamp?.split('T')[1]?.slice(0, 5) || 
                        healthHistory[i].timestamp?.split(' ')[1]?.slice(0, 5) || '';
      chartData.push({
        time: timeLabel,
        health: healthHistory[i].health_score,
        trend: Math.max(0, Math.min(100, slope * i + intercept)),
        projected: null,
      });
    }

    // 2. Projected points (next 30 hourly readings)
    if (n > 0) {
      const lastFit = chartData[n - 1].trend;
      chartData.push({
        time: 'Now',
        health: null,
        trend: null,
        projected: lastFit,
      });

      for (let i = 1; i <= 30; i++) {
        const idx = n - 1 + i;
        const projVal = Math.max(0, Math.min(100, slope * idx + intercept));
        chartData.push({
          time: `+${i}h`,
          health: null,
          trend: null,
          projected: projVal,
        });
      }
    }

    return chartData;
  }, [healthHistory]);

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
              {prediction?.days_until_maintenance >= 365
                ? '365+ days until maintenance'
                : `${prediction?.days_until_maintenance} days until maintenance`}
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
