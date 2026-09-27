import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { History, RefreshCw } from 'lucide-react';
import { fetchHistory } from '../api';
import { WATER_LEVEL_LIMIT_M } from '../constants/thresholds';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[6px] px-3 py-2 bg-white border border-slate-200" style={{ boxShadow: 'none' }}>
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-900 m-0">
        {payload[0].value?.toFixed(2)} <span className="font-normal text-[11px] text-slate-400">m</span>
      </p>
    </div>
  );
}

export default function HistoryChart({ historyData: externalData, activeBridgeId = 1 }) {
  const [data, setData] = useState(externalData || []);
  const [loading, setLoading] = useState(!externalData || externalData.length === 0);
  const [error, setError] = useState(null);

  // Sync from parent prop if it arrives
  useEffect(() => {
    if (externalData && externalData.length > 0) {
      setData(externalData);
      setLoading(false);
      setError(null);
    }
  }, [externalData]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${API_BASE}/api/history?bridge_id=${activeBridgeId}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setError('Request timed out — server did not respond in 10 seconds.');
      } else {
        setError(`Unable to load history data — ${err.message}`);
      }
      setLoading(false);
    }
  }, [activeBridgeId]);

  useEffect(() => {
    if (!externalData || externalData.length === 0) {
      loadHistory();
    }
  }, [activeBridgeId, loadHistory, externalData]);

  if (loading) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="history-chart" style={{ boxShadow: 'none' }}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <History size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Water level history (3 hours)</h4>
        </div>
        <div className="h-44 flex items-center justify-center text-xs text-slate-400">
          Loading history data…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="history-chart" style={{ boxShadow: 'none' }}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <History size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Water level history (3 hours)</h4>
        </div>
        <div className="h-44 flex flex-col items-center justify-center gap-3">
          <p className="text-xs text-slate-500 m-0">{error}</p>
          <button
            onClick={loadHistory}
            className="px-3 py-1.5 bg-[#1C1F26] text-white text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="history-chart" style={{ boxShadow: 'none' }}>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <History size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Water level history (3 hours)</h4>
        </div>
        <div className="h-44 flex flex-col items-center justify-center gap-3 text-xs text-slate-400">
          No history data recorded
          <button
            onClick={loadHistory}
            className="px-3 py-1.5 bg-[#1C1F26] text-white text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5 hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const chartData = data.map((row) => ({
    time: row.timestamp?.split(' ')[1]?.slice(0, 5) || '',
    value: row.water_level,
  }));

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="history-chart" style={{ boxShadow: 'none' }}>
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Water level history (3 hours)</h4>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-600 font-medium">
          {chartData.length} samples
        </span>
      </div>
      <div style={{ width: '100%', minHeight: '200px' }}>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0F6E56" stopOpacity={0.15} />
                <stop offset="100%" stopColor="#0F6E56" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: '#8B94A3' }}
              interval={29}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#8B94A3' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={WATER_LEVEL_LIMIT_M}
              stroke="#991B1B"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{
                value: `Critical limit (${WATER_LEVEL_LIMIT_M}m)`,
                position: 'right',
                fill: '#991B1B',
                fontSize: 10,
                fontWeight: 500,
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0F6E56"
              strokeWidth={1.5}
              fill="url(#histGrad)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
