import { MapPin, Activity, Zap, Maximize2, Droplets, Bot, AlertTriangle, Radio } from 'lucide-react';
import StatusBadge, { formatHealthScore } from './StatusBadge';
import { SENSOR_THRESHOLDS, getSensorStatus } from '../constants/thresholds';

export default function SelectedBridgePanel({
  bridge,
  isLive = false,
  onOpenInspector,
  onManageLive,
  topAlertText = '',
}) {
  if (!bridge) {
    return (
      <div 
        className="w-full h-full min-h-[420px] rounded-2xl p-6 flex flex-col items-center justify-center text-center select-none"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          <MapPin size={22} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No bridge selected</h3>
        <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
          Select a marker on the map or click any bridge card below to inspect telemetry and sensor health.
        </p>
      </div>
    );
  }

  const healthColor = bridge.health_score >= 75 ? '#0F6E56' : bridge.health_score >= 50 ? '#D97706' : '#991B1B';

  const hasRiver = bridge.river && !['none', 'null', 'n/a', ''].includes(String(bridge.river).trim().toLowerCase());
  const metaText = hasRiver
    ? `${bridge.type} • Built in ${bridge.year_built} • ${bridge.river}`
    : `${bridge.type} • Built in ${bridge.year_built}`;

  // Sensor specifications
  const sensors = [
    {
      id: 'vibration',
      label: 'Vibration',
      value: bridge.vibration != null ? Number(bridge.vibration).toFixed(2) : '--',
      unit: SENSOR_THRESHOLDS.vibration.unit,
      status: getSensorStatus('vibration', bridge.vibration),
      limit: 'Limit: 1.20 g',
      icon: Activity,
    },
    {
      id: 'strain',
      label: 'Strain',
      value: bridge.strain != null ? Number(bridge.strain).toFixed(1) : '--',
      unit: SENSOR_THRESHOLDS.strain.unit,
      status: getSensorStatus('strain', bridge.strain),
      limit: 'Limit: 210.0 MPa',
      icon: Zap,
    },
    {
      id: 'crack_gap',
      label: 'Crack gap',
      value: bridge.crack_gap != null ? Number(bridge.crack_gap).toFixed(2) : '--',
      unit: SENSOR_THRESHOLDS.crack_gap.unit,
      status: getSensorStatus('crack_gap', bridge.crack_gap),
      limit: 'Limit: 0.30 mm',
      icon: Maximize2,
    },
    {
      id: 'water_level',
      label: 'Water level',
      value: bridge.water_level != null ? Number(bridge.water_level).toFixed(2) : '--',
      unit: SENSOR_THRESHOLDS.water_level.unit,
      status: getSensorStatus('water_level', bridge.water_level),
      limit: 'Limit: 5.50 m',
      icon: Droplets,
    },
  ];

  const getPillStyles = (status) => {
    if (status === 'Critical') {
      return { bg: '#FDF2F2', border: '#FECACA', color: '#991B1B' };
    }
    if (status === 'Monitor') {
      return { bg: '#FFFBEB', border: '#FEF3C7', color: '#D97706' };
    }
    return { bg: '#F0FDF4', border: '#DCFCE7', color: '#0F6E56' };
  };

  return (
    <div 
      className="w-full h-full rounded-2xl flex flex-col justify-between overflow-y-auto"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        padding: '20px',
      }}
    >
      <div className="space-y-4">
        {/* ── Top Header Row ── */}
        <div className="flex items-center justify-between gap-2 border-b pb-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
            <Radio size={13} className="text-[#0F6E56]" />
            <span>Selected bridge</span>
          </div>

          {/* Live indicator or archive pill */}
          {isLive ? (
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold"
              style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', color: '#0F6E56' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live telemetry
            </div>
          ) : (
            <div 
              className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-medium"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
            >
              Historical snapshot
            </div>
          )}
        </div>

        {/* ── Bridge Identification ── */}
        <div>
          <h3 className="text-base font-extrabold tracking-tight leading-snug" style={{ color: 'var(--text-primary)' }}>
            {bridge.name}
          </h3>
          <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <MapPin size={12} className="text-slate-400 shrink-0" />
            <span className="font-medium">{bridge.city || 'State'}, {bridge.state}</span>
          </div>
          <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
            {metaText}
          </p>
        </div>

        {/* ── Health Score & Status Badge ── */}
        <div 
          className="rounded-xl p-3.5 space-y-2.5"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Structural health
            </span>
            <StatusBadge healthScore={bridge.health_score} size="md" />
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black font-mono tracking-tight tabular-nums" style={{ color: healthColor }}>
                {formatHealthScore(bridge.health_score)}
              </span>
              <span className="text-xs text-slate-400 font-normal">/100</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-500">
              {bridge.health_score >= 75 ? 'Optimal safety margin' : bridge.health_score >= 50 ? 'Requires observation' : 'Immediate action needed'}
            </span>
          </div>

          {/* Health Bar */}
          <div className="w-full h-2 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.max(0, bridge.health_score))}%`,
                backgroundColor: healthColor,
              }}
            />
          </div>
        </div>

        {/* ── The Four Sensor Readings ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Live sensor telemetry
            </h4>
            <span className="text-[9px] text-slate-400">IRC Standards</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {sensors.map((s) => {
              const pill = getPillStyles(s.status);
              const Icon = s.icon;
              return (
                <div 
                  key={s.id}
                  className="rounded-lg p-2.5 flex flex-col justify-between"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-medium text-slate-500 flex items-center gap-1">
                      <Icon size={11} className="text-slate-400 shrink-0" />
                      {s.label}
                    </span>
                    <span 
                      className="text-[8.5px] font-bold px-1.5 py-0.5 rounded-full border leading-none"
                      style={{ background: pill.bg, borderColor: pill.border, color: pill.color }}
                    >
                      {s.status}
                    </span>
                  </div>

                  <div className="mt-1.5">
                    <div className="text-sm font-extrabold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {s.value} <span className="text-[10px] font-normal text-slate-400">{s.unit}</span>
                    </div>
                    <div className="text-[8.5px] text-slate-400 font-sans mt-0.5">
                      {s.limit}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Alert Count & Description ── */}
        <div 
          className="rounded-lg p-2.5 flex items-start gap-2"
          style={{
            background: bridge.alert_count > 0 ? '#FDF2F2' : 'var(--bg-secondary)',
            border: bridge.alert_count > 0 ? '1px solid #FECACA' : '1px solid var(--border-subtle)',
          }}
        >
          {bridge.alert_count > 0 ? (
            <AlertTriangle size={14} className="text-red-600 mt-0.5 shrink-0" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
          )}
          <div className="text-[10.5px] leading-snug flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold" style={{ color: bridge.alert_count > 0 ? '#991B1B' : 'var(--text-primary)' }}>
                {bridge.alert_count > 0 ? `${bridge.alert_count} active alert${bridge.alert_count > 1 ? 's' : ''}` : 'No active alerts'}
              </span>
              <span 
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded border"
                style={{
                  background: bridge.alert_count > 0 ? '#FFFFFF' : '#FFFFFF',
                  borderColor: bridge.alert_count > 0 ? '#FECACA' : '#E2E8F0',
                  color: bridge.alert_count > 0 ? '#991B1B' : '#64748B',
                }}
              >
                <span className="tabular-nums font-mono">{bridge.alert_count || 0}</span>
              </span>
            </div>
            <p className="mt-0.5 text-[9.5px]" style={{ color: bridge.alert_count > 0 ? '#7F1D1D' : 'var(--text-secondary)' }}>
              {bridge.alert_count > 0 ? topAlertText : 'All sensors operate within IRC safety limits.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action Buttons ── */}
      <div className="pt-4 mt-2 space-y-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => onOpenInspector && onOpenInspector(bridge)}
          className="w-full h-10 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-all hover:opacity-95 active:scale-[0.99] cursor-pointer"
          style={{ background: '#0F6E56' }}
        >
          <Bot size={15} />
          <span>Open inspector</span>
        </button>

        {onManageLive && (
          <button
            type="button"
            onClick={() => onManageLive(bridge)}
            className="w-full h-8 px-3 rounded-lg text-[10px] font-semibold transition cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {isLive ? 'Manage live telemetry' : 'Configure live monitoring'}
          </button>
        )}
      </div>
    </div>
  );
}
