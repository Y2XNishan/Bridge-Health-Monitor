import { useState, useEffect } from 'react';
import { fetchBridges, downloadReport } from '../api';
import { useAuth } from '../context/authContext';
import { MapPin, Download, AlertTriangle } from 'lucide-react';

const GRADE_CONFIG = {
  A: { color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  B: { color: '#0F6E56', bg: '#F0FDF4', border: '#DCFCE7' },
  C: { color: '#D97706', bg: '#FFFBEB', border: '#FEF3C7' },
  D: { color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
  F: { color: '#991B1B', bg: '#FDF2F2', border: '#FECACA' },
};

export default function BridgeOverview({ activeBridgeId, onSelectBridge }) {
  const { token } = useAuth();
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exportingIds, setExportingIds] = useState({});

  async function handleExportCard(e, bridgeId, bridgeName) {
    e.stopPropagation();
    setExportingIds(prev => ({ ...prev, [bridgeId]: true }));
    try {
      await downloadReport(bridgeId, bridgeName);
    } catch (err) {
      console.error(err);
    } finally {
      setExportingIds(prev => ({ ...prev, [bridgeId]: false }));
    }
  }

  useEffect(() => {
    async function loadBridges() {
      try {
        const data = await fetchBridges();
        setBridges(data);
        setError(null);
      } catch (err) {
        console.error('[BridgeOverview fetch error]', err);
        setError(err.message || 'Unknown fetch error');
      } finally {
        setLoading(false);
      }
    }

    loadBridges();
    const interval = setInterval(loadBridges, 2000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-5 text-center bg-white border border-slate-200 rounded-[8px]" style={{ boxShadow: 'none' }}>
        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700">
          <AlertTriangle size={14} color="#991B1B" />
          Connection failed
        </div>
        <p className="text-[11px] mt-1 text-slate-500 m-0">Unable to fetch bridge monitoring profiles: {error}</p>
      </div>
    );
  }

  if (loading && bridges.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((id) => (
          <div key={id} className="p-5 min-h-[100px] flex items-center justify-center bg-white border border-slate-200 rounded-[8px]" style={{ boxShadow: 'none' }}>
            <span className="text-xs text-slate-400">Loading bridge monitoring profile #{id}…</span>
          </div>
        ))}
      </div>
    );
  }

  const isScrollable = bridges.length > 3;

  return (
    <div 
      className={`${
        isScrollable 
          ? 'flex flex-row overflow-x-auto pb-3 gap-4' 
          : 'grid grid-cols-1 md:grid-cols-3 gap-4'
      }`} 
      id="bridge-overview"
    >
      {bridges.map((bridge) => {
        const isActive = bridge.id === activeBridgeId;
        const score = bridge.health_score;
        const grade = bridge.health_grade || '—';
        const status = bridge.status || 'Loading…';
        const cfg = GRADE_CONFIG[grade] || GRADE_CONFIG.F;

        return (
          <div
            key={bridge.id}
            onClick={() => onSelectBridge(bridge.id)}
            className={`p-4 sm:p-5 cursor-pointer relative bg-white transition-colors ${
              isScrollable ? 'w-[300px] shrink-0' : ''
            }`}
            style={{
              border: isActive ? '1px solid #0F6E56' : '1px solid #E2E8F0',
              borderRadius: '8px',
              boxShadow: 'none'
            }}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-medium text-slate-400 mb-0.5">
                  Profile #{bridge.id}
                </p>
                <h3 className="text-sm font-bold text-slate-900 leading-tight m-0">
                  {bridge.name}
                </h3>
                {bridge.location && (
                  <p className="text-[11px] mt-1 text-slate-500 flex items-center gap-1 m-0">
                    <MapPin size={11} color="#8B94A3" />
                    {bridge.location}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div
                  className="w-7 h-7 rounded-[6px] flex items-center justify-center text-xs font-bold shrink-0 border"
                  style={{
                    background: cfg.bg,
                    borderColor: cfg.border,
                    color: cfg.color,
                  }}
                >
                  {grade}
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between mt-4">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <span
                  className="text-xs font-medium"
                  style={{ color: cfg.color }}
                >
                  {status}
                </span>
                {bridge.alert_count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-medium ml-1" style={{ background: '#FDF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                    {bridge.alert_count} active
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 text-right shrink-0">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium m-0">Health score</p>
                  <p className="text-lg font-bold font-mono tracking-tight m-0" style={{ color: cfg.color }}>
                    {score !== null ? `${score.toFixed(1)}` : '—'}
                    <span className="text-[10px] font-normal text-slate-400 ml-0.5">/100</span>
                  </p>
                </div>
                <button
                  onClick={(e) => handleExportCard(e, bridge.id, bridge.name)}
                  disabled={!token || exportingIds[bridge.id]}
                  className="flex items-center gap-1 px-2 py-0.5 text-white text-[11px] font-medium rounded-[4px] bg-[#1C1F26] hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  <Download size={11} />
                  <span>Export</span>
                </button>
              </div>
            </div>

            {/* Active indicator dot */}
            {isActive && (
              <div className="absolute top-2.5 left-2.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0F6E56' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
