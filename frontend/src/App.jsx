import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import AuroraBackground from './components/AuroraBackground';
import Header from './components/Header';
import BridgeOverview from './components/BridgeOverview';
import MetricCards from './components/MetricCards';
import HealthScore from './components/HealthScore';
import MaintenancePanel from './components/MaintenancePanel';
import LiveCharts from './components/LiveCharts';
import RiskGauge from './components/RiskGauge';
import AlertPanel from './components/AlertPanel';
import HistoryChart from './components/HistoryChart';
import TrafficPanel from './components/TrafficPanel';
import ChatPanel from './components/ChatPanel';
import NavBar from './components/NavBar';
import IndiaNetwork from './pages/IndiaNetwork';
import AIIntelligenceCenter from './pages/AIIntelligenceCenter';
import Maintenance from './pages/Maintenance';
import InstallPrompt from './components/InstallPrompt';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import CrackDetection from './pages/CrackDetection';
import Dashboard from './pages/Dashboard';
import AgentInspector from './pages/AgentInspector';
import SurvivalAnalysis from './pages/SurvivalAnalysis';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/authContext';
import {
  fetchLive,
  fetchAlerts,
  fetchHistory,
  fetchHealthHistory,
  fetchBridges,
} from './api';

const MAX_CHART_POINTS = 30;

const KNOWN_PATHS = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/network': 'network',
  '/maintenance': 'maintenance',
  '/admin': 'admin',
  '/crack-detection': 'crack-detection',
  '/aiops': 'aiops',
  '/ai-inspector': 'ai-inspector',
  '/predictive': 'predictive',
};

const getInitialPage = () => {
  const path = window.location.pathname;
  if (KNOWN_PATHS[path]) {
    return KNOWN_PATHS[path];
  }
  // Catch-all: unknown path -> redirect to dashboard
  if (path !== '/' && path !== '') {
    window.history.replaceState({}, '', '/');
  }
  return 'dashboard';
};

export default function App() {
  const { token, loading } = useAuth();
  const location = useLocation();
  const [currentPage, setCurrentPage] = useState(getInitialPage);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const path = location.pathname;
    if (KNOWN_PATHS[path]) {
      setCurrentPage(KNOWN_PATHS[path]);
    } else {
      // Catch-all: unknown path -> redirect to / and display dashboard
      if (path !== '/' && path !== '') {
        window.history.replaceState({}, '', '/');
      }
      setCurrentPage('dashboard');
    }
  }, [location.pathname]);

  const [activeBridgeId, setActiveBridgeId] = useState(1);
  const [bridges, setBridges] = useState([]);
  const [liveData, setLiveData] = useState(null);
  const [chartData, setChartData] = useState({
    water_level: [],
    vibration: [],
    strain: [],
    crack_gap: [],
  });
  const [alerts, setAlerts] = useState([]);
  const [historyData, setHistoryData] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [unreadProactiveAlerts, setUnreadProactiveAlerts] = useState(0);

  const [toastMessage, setToastMessage] = useState(null);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const savedToast = sessionStorage.getItem('oauth_toast');
    if (savedToast) {
      setToastMessage(savedToast);
      setShowToast(true);
      sessionStorage.removeItem('oauth_toast');
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Find active bridge details
  const activeBridgeSafeId = Number(activeBridgeId) > 0 ? Number(activeBridgeId) : 1;
  const activeBridge = bridges.find((b) => Number(b.id) === activeBridgeSafeId);
  const activeBridgeName = activeBridge?.name || `Bridge ${activeBridgeSafeId}`;

  // ── Fetch bridges overview every 2 seconds ──────────────────
  const pollBridges = useCallback(async () => {
    try {
      const data = await fetchBridges();
      setBridges(data);
    } catch (err) {
      console.error('[bridges]', err);
    }
  }, []);

  // ── Fetch live data every 2 seconds ──────────────────────────
  const pollLive = useCallback(async () => {
    try {
      const data = await fetchLive(activeBridgeSafeId);
      setLiveData(data);
      setConnectionStatus('connected');

      // Extract time label
      const timeLabel =
        data.timestamp?.split('T')[1]?.slice(0, 8) ||
        data.timestamp?.split(' ')[1]?.slice(0, 8) ||
        '';

      setChartData((prev) => {
        const next = { ...prev };
        for (const sensor of ['water_level', 'vibration', 'strain', 'crack_gap']) {
          const arr = [...(prev[sensor] || []), { time: timeLabel, value: data[sensor] }];
          next[sensor] =
            arr.length > MAX_CHART_POINTS ? arr.slice(-MAX_CHART_POINTS) : arr;
        }
        return next;
      });
    } catch (err) {
      console.error('[live]', err);
      setConnectionStatus('error');
    }
  }, [activeBridgeSafeId]);

  // ── Fetch alerts every 5 seconds ─────────────────────────────
  const pollAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts(activeBridgeSafeId);
      setAlerts(data);
    } catch (err) {
      console.error('[alerts]', err);
    }
  }, [activeBridgeSafeId]);

  // ── Fetch health history every 10 seconds ────────────────────
  const pollHealthHistory = useCallback(async () => {
    try {
      const data = await fetchHealthHistory(activeBridgeSafeId);
      setHealthHistory(data);
    } catch (err) {
      console.error('[health-history]', err);
    }
  }, [activeBridgeSafeId]);

  // ── Reset rolling data and fetch history on bridge switch ────────────────
  useEffect(() => {
    if (!token) return;
    setChartData({
      water_level: [],
      vibration: [],
      strain: [],
      crack_gap: [],
    });
    setLiveData(null);

    fetchHistory(activeBridgeSafeId)
      .then(setHistoryData)
      .catch((err) => console.error('[history]', err));

    pollLive();
    pollAlerts();
    pollHealthHistory();
    pollBridges();
  }, [token, activeBridgeSafeId, pollLive, pollAlerts, pollHealthHistory, pollBridges]);

  // ── Start polling ────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const bridgesInterval = setInterval(pollBridges, 2000);
    const liveInterval = setInterval(pollLive, 2000);
    const alertsInterval = setInterval(pollAlerts, 5000);
    const healthInterval = setInterval(pollHealthHistory, 10000);

    return () => {
      clearInterval(bridgesInterval);
      clearInterval(liveInterval);
      clearInterval(alertsInterval);
      clearInterval(healthInterval);
    };
  }, [token, pollLive, pollAlerts, pollHealthHistory, pollBridges]);

  const floatingTools = (
    <>
      <ChatPanel 
        bridgeId={activeBridgeSafeId} 
        bridgeName={activeBridgeName} 
        isOpen={isChatOpen} 
        setIsOpen={setIsChatOpen} 
        onNewProactiveAlert={() => {
          if (!isChatOpen) {
            setUnreadProactiveAlerts(prev => prev + 1);
          }
        }}
        onClearProactiveAlerts={() => setUnreadProactiveAlerts(0)}
      />
      <InstallPrompt />
    </>
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    const targetPath = Object.keys(KNOWN_PATHS).find((k) => KNOWN_PATHS[k] === page) || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  if (loading) {
    return (
      <div style={{ position: 'relative', minHeight: '100vh', background: '#F8FAFA' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div 
            className="min-h-screen flex flex-col items-center justify-center space-y-3"
            style={{ color: '#1C1F26' }}
          >
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#0F6E56] animate-spin" />
            <p className="text-xs font-medium text-slate-500">
              Loading platform data...
            </p>
          </div>
          {floatingTools}
        </div>
      </div>
    );
  }

  if (!token) {
    return <Login />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFA', position: 'relative' }}>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: '100%', minHeight: '100vh' }}>
        {/* Toast Notification */}
        {showToast && toastMessage && (
          <div 
            className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-[6px] border flex items-center gap-2.5 animate-fade-in-up bg-white text-slate-900"
            style={{ 
              borderColor: '#E2E8F0', 
              borderLeft: '3px solid #0F6E56',
              boxShadow: 'none',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: '500', color: '#1C1F26' }}>{toastMessage.replace('✓ ', '')}</span>
          </div>
        )}

        {/* Sidebar */}
        <NavBar 
          currentPage={currentPage} 
          setCurrentPage={handlePageChange} 
          isChatOpen={isChatOpen} 
          setIsChatOpen={(open) => {
            setIsChatOpen(open);
            if (open) {
              setUnreadProactiveAlerts(0);
            }
          }} 
          unreadAlertsCount={unreadProactiveAlerts}
        />

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Connection status bar */}
          {connectionStatus === 'error' && (
            <div 
              className="px-8 py-2 flex items-center gap-2"
              style={{ background: '#FDF2F2', borderBottom: '1px solid #FECACA' }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#991B1B' }} />
              <span className="text-xs font-medium" style={{ color: '#991B1B' }}>
                Connection lost — retrying every 2s…
              </span>
            </div>
          )}

          <Header activeBridgeName={activeBridgeName} activeBridgeId={activeBridgeSafeId} currentPage={currentPage} />

          <main style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
            <div className="max-w-screen-2xl mx-auto space-y-6">
              <ErrorBoundary onNavigateDashboard={() => handlePageChange('dashboard')} onReset={() => handlePageChange('dashboard')}>
                {currentPage === 'dashboard' ? (
                  <Dashboard
                    onSelectBridge={setActiveBridgeId}
                    setCurrentPage={handlePageChange}
                  />
                ) : currentPage === 'maintenance' ? (
                  <Maintenance />
                ) : currentPage === 'admin' ? (
                  <AdminPanel />
                ) : currentPage === 'crack-detection' ? (
                  <CrackDetection />
                ) : currentPage === 'aiops' ? (
                  <AIIntelligenceCenter />
                ) : currentPage === 'ai-inspector' ? (
                  <AgentInspector activeBridgeId={activeBridgeSafeId} />
                ) : currentPage === 'predictive' ? (
                  <SurvivalAnalysis />
                ) : (
                  <IndiaNetwork onSelectBridge={setActiveBridgeId} setCurrentPage={handlePageChange} />
                )}
              </ErrorBoundary>
            </div>

            {/* Footer */}
            <footer className="text-center py-6 mt-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                Bridge Health Monitor SHM v1.0 — Real-time structural health monitoring powered by ML pipelines
              </p>
            </footer>
          </main>
        </div>
      </div>
      {floatingTools}
    </div>
  );
}
