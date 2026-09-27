import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Header({ currentPage = 'dashboard', activeBridgeId, activeBridgeName }) {
  const { user, logout, switchRoleDemo } = useAuth();
  const [time, setTime] = useState(new Date());
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setShowRoles(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format Wed Jun 10 · 06:55 PM
  const formatted =
    time.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) +
    ' · ' +
    time.toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

  const initials =
    user?.avatar ||
    user?.name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    '??';

  const getPageTitle = (page) => {
    switch (page) {
      case 'dashboard':
        return 'Live dashboard';
      case 'network':
        return 'India network';
      case 'ai-inspector':
        return 'AI inspector';
      case 'predictive':
        return 'Predictive maintenance';
      case 'crack-detection':
        return 'AI crack detection';
      case 'maintenance':
        return 'Maintenance assignments';
      case 'aiops':
        return 'AI intelligence center';
      case 'admin':
        return 'Admin panel';
      default:
        return 'Live dashboard';
    }
  };

  const getPageSubtitle = (page) => {
    switch (page) {
      case 'dashboard':
        return 'Real-time structural monitoring — India network';
      case 'network':
        return 'National structural health overview and mapping';
      case 'ai-inspector':
        return 'Multi-agent AI inspection and structural health validation';
      case 'predictive':
        return 'Degradation rate forecasting and survival analysis';
      case 'crack-detection':
        return 'Vision AI model analysis and crack width estimation';
      case 'maintenance':
        return 'Engineering dispatch plans and maintenance history';
      case 'aiops':
        return 'AIOps operations, federated learning, and model performance';
      case 'admin':
        return 'Security logs, demo role switching, and database config';
      default:
        return 'Real-time structural monitoring — India network';
    }
  };

  return (
    <header
      className="flex items-center justify-between px-8 py-5 z-40"
      style={{
        backgroundColor: '#1C1F26',
        borderBottom: '1px solid #2A2E39',
        boxShadow: 'none',
      }}
    >
      <div>
        <div
          style={{
            fontSize: '11px',
            fontWeight: '600',
            color: '#8B94A3',
            marginBottom: '4px',
          }}
        >
          Bridge health monitor
        </div>
        <h1
          className="text-xl font-semibold tracking-tight text-white"
          style={{ margin: 0, color: '#FFFFFF' }}
        >
          {getPageTitle(currentPage)}
        </h1>
        <p className="text-xs font-normal mt-1" style={{ margin: 0, color: '#8B94A3' }}>
          {getPageSubtitle(currentPage)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Live status badge */}
        <span
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            backgroundColor: 'rgba(15, 110, 86, 0.15)',
            color: '#0F6E56',
            border: '1px solid #0F6E56',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0F6E56' }} />
          Live
        </span>

        {/* System Time */}
        <div
          className="px-3 py-1 rounded-[6px] text-xs font-medium"
          style={{
            backgroundColor: '#252932',
            color: '#8B94A3',
            border: '1px solid #333945',
          }}
        >
          {formatted}
        </div>

        {/* User initials / dropdown */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <div
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setShowRoles(false);
              }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#252932',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                border: '1px solid #8B94A3',
                boxShadow: 'none',
                userSelect: 'none',
              }}
              title={user.name}
            >
              {initials}
            </div>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-[8px] z-50 py-2 text-left text-xs font-medium bg-white text-slate-900"
                style={{
                  border: '1px solid #8B94A3',
                  boxShadow: 'none',
                }}
              >
                {!showRoles ? (
                  <>
                    {/* User profile details header */}
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="font-semibold text-slate-900 truncate">{user.name}</p>
                      <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{user.email}</p>
                      <p className="text-[10px] font-medium mt-1 text-[#0F6E56]">{user.org}</p>
                    </div>

                    {/* Actions list */}
                    <div className="py-1">
                      <div
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-xs text-slate-700"
                        onClick={() =>
                          alert(
                            `Personnel Clearance Profile:\nName: ${user.name}\nEmail: ${user.email}\nOrganization: ${user.org}\nRole: ${user.role}`
                          )
                        }
                      >
                        Profile details
                      </div>
                      <div
                        className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between gap-2 text-xs text-slate-700"
                        onClick={() => setShowRoles(true)}
                      >
                        <span>Switch clearance role</span>
                        <span className="text-slate-400 font-normal">→</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100" />

                    <div className="py-1">
                      <button
                        onClick={logout}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 cursor-pointer flex items-center gap-2 text-xs font-medium text-red-700"
                      >
                        Log out
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Role-switching sub-menu */}
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2">
                      <span
                        className="cursor-pointer text-slate-400 hover:text-slate-900 text-xs"
                        onClick={() => setShowRoles(false)}
                      >
                        ←
                      </span>
                      <p className="font-semibold text-slate-900">Select clearance role</p>
                    </div>

                    <div className="py-1">
                      {['Admin', 'Engineer', 'Viewer'].map((role) => {
                        const isCurrent = user.role.toLowerCase() === role.toLowerCase();
                        return (
                          <div
                            key={role}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs"
                            onClick={() => {
                              switchRoleDemo(role.toLowerCase());
                              setShowRoles(false);
                              setDropdownOpen(false);
                            }}
                          >
                            <span className={isCurrent ? 'font-semibold text-slate-900' : 'text-slate-700'}>{role}</span>
                            {isCurrent && <span className="text-[#0F6E56] font-semibold">Active</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
