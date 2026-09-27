import { Gauge } from 'lucide-react';

export default function RiskGauge({ riskScore = 0 }) {
  const pct = Math.round(riskScore * 100);

  // Color based on risk level
  let color, label;
  if (pct < 40) {
    color = '#0F6E56';
    label = 'Low risk';
  } else if (pct <= 70) {
    color = '#D97706';
    label = 'Moderate risk';
  } else {
    color = '#991B1B';
    label = 'High risk';
  }

  // Semicircle arc math
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="risk-gauge" style={{ boxShadow: 'none' }}>
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
        <Gauge size={15} color="#1C1F26" />
        <h4 className="text-xs font-semibold text-slate-900 m-0">Structural risk index</h4>
      </div>
      <div className="flex flex-col items-center">
        <svg className="w-[180px] h-[105px]" viewBox="0 0 200 115">
          {/* Background arc */}
          <path
            d="M 10 100 A 80 80 0 0 1 190 100"
            fill="none"
            stroke="#F1F5F9"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <path
            d="M 10 100 A 80 80 0 0 1 190 100"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          {/* Center value */}
          <text
            x="100"
            y="80"
            textAnchor="middle"
            fill="#1C1F26"
            style={{ fontSize: '32px', fontWeight: 700 }}
          >
            {pct}%
          </text>
          <text
            x="100"
            y="98"
            textAnchor="middle"
            fill={color}
            style={{ fontSize: '11px', fontWeight: 600 }}
          >
            {label}
          </text>
        </svg>

        {/* Scale labels */}
        <div className="flex justify-between w-[180px] mt-1 px-1 font-mono text-[10px] text-slate-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>

        {/* Risk level indicators */}
        <div className="flex gap-4 mt-3">
          {[
            { label: 'Low (< 40%)', color: '#0F6E56' },
            { label: 'Moderate (40–70%)', color: '#D97706' },
            { label: 'High (> 70%)', color: '#991B1B' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] text-slate-500 font-medium">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
