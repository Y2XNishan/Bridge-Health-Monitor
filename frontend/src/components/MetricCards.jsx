import { Waves, Activity, Gauge, ScanLine } from 'lucide-react';
import { SENSOR_THRESHOLDS, getSensorStatus } from '../constants/thresholds';
import StatusBadge from './StatusBadge';

const THRESHOLDS = SENSOR_THRESHOLDS;
const getStatus = getSensorStatus;

const SENSOR_META = {
  water_level: { label: SENSOR_THRESHOLDS.water_level.label, unit: SENSOR_THRESHOLDS.water_level.unit, icon: Waves },
  vibration:   { label: SENSOR_THRESHOLDS.vibration.label,   unit: SENSOR_THRESHOLDS.vibration.unit,   icon: Activity },
  strain:      { label: SENSOR_THRESHOLDS.strain.label,      unit: SENSOR_THRESHOLDS.strain.unit,      icon: Gauge },
  crack_gap:   { label: SENSOR_THRESHOLDS.crack_gap.label,   unit: SENSOR_THRESHOLDS.crack_gap.unit,   icon: ScanLine },
};

export default function MetricCards({ liveData }) {
  const sensors = ['water_level', 'vibration', 'strain', 'crack_gap'];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {sensors.map((sensor) => {
        const meta = SENSOR_META[sensor];
        const IconComponent = meta.icon;
        const value = liveData?.[sensor];
        const status = getStatus(sensor, value);

        const barColor =
          status === 'Critical' ? '#991B1B' : status === 'Monitor' ? '#D97706' : '#0F6E56';

        return (
          <div
            key={sensor}
            className="p-4 sm:p-5 bg-white border border-slate-200 rounded-[8px]"
            style={{ boxShadow: 'none' }}
            id={`metric-card-${sensor}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <IconComponent size={15} color="#8B94A3" />
                <span className="text-xs font-semibold text-slate-700">
                  {meta.label}
                </span>
              </div>
              <StatusBadge status={status} />
            </div>

            <div>
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {value != null ? value.toFixed(2) : '—'}
              </span>
              <span className="text-xs font-medium text-slate-500 ml-1">
                {meta.unit}
              </span>
            </div>

            {/* Threshold bar */}
            <div className="mt-3">
              <div className="h-[2px] w-full overflow-hidden bg-slate-100">
                <div
                  className="h-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(100, (value / THRESHOLDS[sensor].crit) * 100)}%`,
                    background: barColor,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-slate-400 font-mono">
                <span>0</span>
                <span>
                  {THRESHOLDS[sensor].crit} {meta.unit} threshold
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
