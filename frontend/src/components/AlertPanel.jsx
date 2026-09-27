import { Bell, CheckCircle2 } from 'lucide-react';

export default function AlertPanel({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="alert-panel" style={{ boxShadow: 'none' }}>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Bell size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Active alerts</h4>
        </div>
        <div className="flex flex-col items-center justify-center py-6 text-slate-400">
          <CheckCircle2 size={32} strokeWidth={1.5} className="mb-2 text-slate-300" />
          <p className="text-xs font-medium text-slate-600 m-0">No active alerts</p>
          <p className="text-[11px] mt-0.5 text-slate-400 m-0">All channels operating within calibrated baseline</p>
        </div>
      </div>
    );
  }

  const criticalAndWarningCount = alerts.filter(
    (a) => a.alert_level === 'CRITICAL' || a.alert_level === 'WARNING' || a.alert_level === 'MONITOR'
  ).length;

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-[8px]" id="alert-panel" style={{ boxShadow: 'none' }}>
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Bell size={15} color="#1C1F26" />
          <h4 className="text-xs font-semibold text-slate-900 m-0">Active alerts</h4>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-slate-100 text-slate-600 font-medium">
          {criticalAndWarningCount} active
        </span>
      </div>
      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
        {alerts.map((alert, idx) => {
          const isCritical = alert.alert_level === 'CRITICAL';
          const isWarning = alert.alert_level === 'WARNING' || alert.alert_level === 'MONITOR';

          const cardStyle = {
            border: '1px solid #E2E8F0',
            borderLeft: isCritical ? '3px solid #991B1B' : isWarning ? '3px solid #D97706' : '3px solid #0F6E56',
            borderRadius: '6px',
            padding: '10px 12px',
            backgroundColor: '#FFFFFF',
            boxShadow: 'none'
          };

          const badgeBg = isCritical ? '#FDF2F2' : isWarning ? '#FFFBEB' : '#F0FDF4';
          const badgeBorder = isCritical ? '#FECACA' : isWarning ? '#FEF3C7' : '#DCFCE7';
          const badgeDot = isCritical ? '#991B1B' : isWarning ? '#D97706' : '#0F6E56';
          const badgeLabel = isCritical ? 'Critical' : isWarning ? 'Monitor' : 'Healthy';

          const barColor = isCritical ? '#991B1B' : isWarning ? '#D97706' : '#0F6E56';

          return (
            <div
              key={`${alert.timestamp}-${idx}`}
              style={cardStyle}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono text-slate-500">
                  {alert.timestamp}
                </span>
                <span 
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                  style={{ backgroundColor: badgeBg, borderColor: badgeBorder, color: '#1C1F26' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badgeDot }} />
                  {badgeLabel}
                </span>
              </div>

              {/* Triggering sensor message */}
              {alert.message && (
                <p className="text-xs font-semibold text-slate-900 mb-2 leading-relaxed">
                  {alert.message}
                </p>
              )}

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700">
                  Risk score: {(alert.combined_score * 100).toFixed(1)}%
                </span>
                {/* Score bar */}
                <div className="flex-1 h-[2px] overflow-hidden bg-slate-100">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, alert.combined_score * 100)}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
