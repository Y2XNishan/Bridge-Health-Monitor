import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';

const CHART_CONFIG = {
  water_level: { label: 'Water level', unit: 'm',   color: '#0F6E56' },
  vibration:   { label: 'Vibration',   unit: 'g',   color: '#475569' },
  strain:      { label: 'Strain',      unit: 'MPa', color: '#D97706' },
  crack_gap:   { label: 'Crack gap',   unit: 'mm',  color: '#991B1B' },
};

function CustomTooltip({ active, payload, label, sensor }) {
  if (!active || !payload?.length) return null;
  const cfg = CHART_CONFIG[sensor];
  return (
    <div className="rounded-[6px] px-3 py-2 bg-white border border-slate-200" style={{ boxShadow: 'none' }}>
      <p className="text-[10px] text-slate-500 mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-900 m-0">
        {payload[0].value?.toFixed(4)} <span className="font-normal text-[11px] text-slate-400">{cfg.unit}</span>
      </p>
    </div>
  );
}

function SensorChart({ sensor, data }) {
  const cfg = CHART_CONFIG[sensor];

  if (!data || data.length === 0) {
    return (
      <div 
        className="p-4 bg-white border border-slate-200 rounded-[8px] flex items-center justify-center text-xs text-slate-400"
        style={{ width: '100%', height: '180px', boxShadow: 'none' }}
      >
        Waiting for telemetry stream...
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-[8px]" id={`chart-${sensor}`} style={{ boxShadow: 'none' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-700 m-0">
          {cfg.label}
        </h3>
        <span className="text-[10px] font-mono text-slate-400">
          {data.length} telemetry points
        </span>
      </div>
      <div style={{ width: '100%', height: '160px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="#E2E8F0" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: '#8B94A3' }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#8B94A3' }}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip sensor={sensor} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={cfg.color}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: cfg.color }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function LiveCharts({ chartData }) {
  const sensors = ['water_level', 'vibration', 'strain', 'crack_gap'];

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Activity size={15} color="#1C1F26" />
        <h4 className="text-xs font-semibold text-slate-900 m-0">Live sensor trends</h4>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sensors.map((sensor) => (
          <SensorChart key={sensor} sensor={sensor} data={chartData[sensor] || []} />
        ))}
      </div>
    </div>
  );
}
