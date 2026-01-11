// Admin Dashboard - Sidebar Navigation Component
import { ReactNode } from 'react';

export type UserRole = 'chain_hq' | 'regional_manager' | 'store_owner' | 'brand_advertiser';

interface User {
  email: string;
  name?: string;
  role: UserRole;
}

interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  roles: UserRole[]; // Which roles can see this item
}

export interface SidebarProps {
  user: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

// SVG Icons as components
const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const KiosksIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <line x1="8" y1="6" x2="16" y2="6" />
    <rect x="8" y="10" width="8" height="6" rx="1" />
  </svg>
);

const CampaignsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </svg>
);

const AnalyticsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ConfigIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const QuestionsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

// Navigation items with role-based access
const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    roles: ['chain_hq', 'regional_manager', 'store_owner', 'brand_advertiser'],
  },
  {
    id: 'kiosks',
    label: 'Kiosks',
    icon: <KiosksIcon />,
    roles: ['chain_hq', 'regional_manager', 'store_owner'],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: <CampaignsIcon />,
    roles: ['chain_hq', 'regional_manager', 'brand_advertiser'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <AnalyticsIcon />,
    roles: ['chain_hq', 'regional_manager', 'store_owner'],
  },
  {
    id: 'users',
    label: 'Users',
    icon: <UsersIcon />,
    roles: ['chain_hq'],
  },
  {
    id: 'config',
    label: 'Configuration',
    icon: <ConfigIcon />,
    roles: ['chain_hq', 'regional_manager', 'store_owner'],
  },
  {
    id: 'questions',
    label: 'Questions',
    icon: <QuestionsIcon />,
    roles: ['chain_hq', 'regional_manager'],
  },
];

// Get role display name
const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    chain_hq: 'Chain HQ Admin',
    regional_manager: 'Regional Manager',
    store_owner: 'Store Owner',
    brand_advertiser: 'Brand Advertiser',
  };
  return roleNames[role];
};

export function Sidebar({ user, currentPage, onNavigate, onLogout }: SidebarProps) {
  // Filter nav items based on user role
  const visibleNavItems = navItems.filter((item) => item.roles.includes(user.role));

  return (
    <aside className="sidebar" data-testid="sidebar">
      {/* Logo/Brand */}
      <div className="sidebar-brand">
        <div className="brand-logo">🎰</div>
        <span className="brand-name">Kiosk Admin</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" data-testid="sidebar-nav">
        <ul className="nav-list">
          {visibleNavItems.map((item) => (
            <li key={item.id}>
              <button
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                data-testid={`nav-${item.id}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* User Profile & Logout */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
          </div>
          <div className="user-info">
            <span className="user-name">{user.name || user.email}</span>
            <span className="user-role">{getRoleDisplayName(user.role)}</span>
          </div>
        </div>
        <button className="logout-btn" onClick={onLogout} data-testid="logout-button">
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
