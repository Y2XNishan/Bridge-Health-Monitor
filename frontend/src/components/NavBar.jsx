import { useAuth } from '../context/authContext';
import { 
  LayoutGrid, 
  MapPin, 
  Brain, 
  Shield,
  Bot,
  Clock,
  Camera,
  Wrench,
  MessageSquare
} from 'lucide-react';

export default function NavBar({ currentPage, setCurrentPage, isChatOpen, setIsChatOpen, unreadAlertsCount = 0 }) {
  const { isAdmin, isEngineer } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Live dashboard', icon: LayoutGrid },
    { id: 'network', label: 'India network', icon: MapPin },
    { id: 'aiops', label: 'AI intelligence center', icon: Brain },
  ];

  if ((isEngineer && isEngineer()) || (isAdmin && isAdmin())) {
    menuItems.push({ id: 'ai-inspector', label: 'AI inspector', icon: Bot });
    menuItems.push({ id: 'predictive', label: 'Predictive maintenance', icon: Clock });
  }

  if (isEngineer && isEngineer()) {
    menuItems.push({ id: 'crack-detection', label: 'Crack detection', icon: Camera });
    menuItems.push({ id: 'maintenance', label: 'Maintenance assignments', icon: Wrench });
  }

  if (isAdmin && isAdmin()) {
    menuItems.push({ id: 'admin', label: 'Admin panel', icon: Shield });
  }

  return (
    <aside 
      style={{ 
        width: '64px', 
        backgroundColor: '#1C1F26',
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        paddingTop: '18px', 
        paddingBottom: '20px', 
        height: '100vh', 
        position: 'sticky', 
        top: 0, 
        zIndex: 50, 
        borderRight: '1px solid #2A2E39',
        boxSizing: 'border-box',
        flexShrink: 0
      }}
    >
      {/* Brand Bridge Logo */}
      <button 
        style={{ 
          width: '38px', 
          height: '38px', 
          borderRadius: '8px', 
          backgroundColor: '#0F6E56', 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: '24px', 
          boxShadow: 'none',
          cursor: 'pointer',
          padding: 0
        }}
        onClick={() => setCurrentPage('dashboard')}
        title="Bridge health monitor"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 18h16" />
          <path d="M4 18L8 8" />
          <path d="M20 18L16 8" />
          <path d="M8 8h8" />
        </svg>
      </button>

      {/* Nav Menu Items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, width: '100%', alignItems: 'center' }}>
        {menuItems.map((item) => {
          const isActive = currentPage === item.id;
          const IconComponent = item.icon;

          return (
            <div key={item.id} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              {isActive && (
                <div 
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: '8px',
                    bottom: '8px',
                    width: '3px',
                    backgroundColor: '#0F6E56',
                    borderRadius: '0 2px 2px 0'
                  }}
                />
              )}
              <button
                onClick={() => setCurrentPage(item.id)}
                title={item.label}
                aria-label={item.label}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? '#282D37' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#8B94A3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, color 0.15s ease',
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#FFFFFF';
                    e.currentTarget.style.backgroundColor = '#252932';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#8B94A3';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {IconComponent && <IconComponent size={19} strokeWidth={1.8} />}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Bottom controls: Chat & Status */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
        {/* Chat Assistant Button */}
        <button
          onClick={() => setIsChatOpen(!isChatOpen)}
          title="Bridge assistant"
          aria-label="Bridge assistant"
          style={{
            position: 'relative',
            width: '40px',
            height: '40px',
            borderRadius: '6px',
            border: isChatOpen ? '1px solid #0F6E56' : '1px solid #2A2E39',
            backgroundColor: isChatOpen ? '#282D37' : 'transparent',
            color: isChatOpen ? '#0F6E56' : '#8B94A3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: 'none'
          }}
          onMouseEnter={(e) => {
            if (!isChatOpen) {
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.backgroundColor = '#252932';
            }
          }}
          onMouseLeave={(e) => {
            if (!isChatOpen) {
              e.currentTarget.style.color = '#8B94A3';
              e.currentTarget.style.backgroundColor = 'transparent';
            }
          }}
        >
          <MessageSquare size={18} strokeWidth={1.8} />
          {unreadAlertsCount > 0 && !isChatOpen && (
            <span style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              backgroundColor: '#991B1B',
              color: 'white',
              fontSize: '9px',
              fontWeight: '600',
              borderRadius: '9999px',
              width: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #1C1F26'
            }}>
              {unreadAlertsCount}
            </span>
          )}
        </button>

        {/* Live Status indicator */}
        <div 
          title="Telemetry feed connected" 
          style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            backgroundColor: '#34D399' 
          }} 
        />
      </div>
    </aside>
  );
}
