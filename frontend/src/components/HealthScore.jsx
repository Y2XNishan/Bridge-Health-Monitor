import { useState, useEffect, useRef } from 'react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import StatusBadge, { formatHealthScore } from './StatusBadge';

const GRADE_CONFIG = {
  A: { color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  B: { color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  C: { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
  D: { color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
  F: { color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
};

function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-1.5 shadow-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{payload[0].value}</p>
    </div>
  );
}

export default function HealthScore({ liveData, healthHistory }) {
  const score = liveData?.health_score ?? null;
  const grade = liveData?.health_grade ?? '—';
  const status = liveData?.health_status ?? 'Loading…';

  const cfg = GRADE_CONFIG[grade] || GRADE_CONFIG.F;

  // Animated score display
  const [displayScore, setDisplayScore] = useState(0);
  const animRef = useRef(null);
  const prevScore = useRef(0);

  useEffect(() => {
    if (score === null) return;

    const from = prevScore.current;
    const to = score;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(from + (to - from) * eased);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevScore.current = to;
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [score]);

  // Progress ring math
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const pct = score !== null ? score / 100 : 0;
  const offset = circumference - pct * circumference;

  // Sparkline data
  const sparkData = (healthHistory || []).map((d, i) => ({
    idx: i,
    value: d.health_score,
  }));

  return (
    <div
      className="p-6 relative overflow-hidden animate-fade-in-up"
      id="health-score-panel"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}
    >
      <p className="section-title relative z-10 flex items-center gap-2">
        <Activity size={16} color="#0F6E56" />
        Bridge health score
      </p>

      <div className="flex flex-col lg:flex-row items-center gap-8 relative z-10">
        {/* === Circular Progress Ring === */}
        <div className="relative flex-shrink-0">
          <svg width="220" height="220" viewBox="0 0 220 220">
            {/* Track */}
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="var(--border-subtle)"
              strokeWidth="14"
            />
            {/* Decorative dashes */}
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke="#161b22"
              strokeWidth="14"
              strokeDasharray="2 8"
            />
            {/* Progress arc */}
            <circle
              cx="110"
              cy="110"
              r={radius}
              fill="none"
              stroke={cfg.color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 110 110)"
              style={{
                transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease',
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-5xl font-black tracking-tight leading-none"
              style={{ color: cfg.color }}
            >
              {score !== null ? formatHealthScore(displayScore) : '—'}
            </span>
            <span className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>/ 100</span>

            {/* Grade badge */}
            <div
              className="mt-3 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black"
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
              }}
            >
              {grade}
            </div>
          </div>
        </div>

        {/* === Info + Sparkline === */}
        <div className="flex-1 min-w-0 w-full">
          {/* Status */}
          <div className="mb-5">
            <StatusBadge status={status} healthScore={score} />
          </div>

          {/* Score breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Health', value: score !== null ? `${formatHealthScore(score)}/100` : '—', sub: 'Score' },
              { label: 'Grade', value: grade, sub: 'Rating' },
              { label: 'Status', value: status, sub: 'Condition' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl p-3"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {item.label}
                </p>
                <p
                  className="text-lg font-extrabold mt-0.5"
                  style={{ color: cfg.color }}
                >
                  {item.value}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
              </div>
            ))}
          </div>

          {/* Sparkline */}
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              Health Trend (Last {sparkData.length} readings)
            </p>
            <div className="h-16 rounded-xl overflow-hidden" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              {sparkData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <defs>
                      <linearGradient id="healthSparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cfg.color} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip content={<SparkTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={cfg.color}
                      strokeWidth={1.5}
                      fill="url(#healthSparkGrad)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Collecting data…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
