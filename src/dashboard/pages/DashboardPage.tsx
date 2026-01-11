// Admin Dashboard - Main Dashboard Page
import { useState, useEffect } from 'react';

interface User {
  email: string;
  role: 'admin' | 'manager' | 'viewer';
}

export interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onNavigate?: (page: string) => void;
}

interface KioskStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  inventory: number;
  todayPlays: number;
  todayWins: number;
}

interface DashboardStats {
  totalKiosks: number;
  onlineKiosks: number;
  totalPlaysToday: number;
  totalWinsToday: number;
  winRate: number;
  totalRevenue: number;
}

export function DashboardPage({ user, onLogout, onNavigate }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [kiosks, setKiosks] = useState<KioskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load dashboard data
    const loadData = async () => {
      setIsLoading(true);

      // TODO: Replace with actual Convex queries
      // Simulate loading
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data for MVP
      setStats({
        totalKiosks: 5,
        onlineKiosks: 4,
        totalPlaysToday: 156,
        totalWinsToday: 47,
        winRate: 30.1,
        totalRevenue: 312,
      });

      setKiosks([
        {
          id: 'KIOSK-001',
          name: 'Main Entrance',
          status: 'online',
          lastSeen: new Date(),
          inventory: 85,
          todayPlays: 42,
          todayWins: 13,
        },
        {
          id: 'KIOSK-002',
          name: 'Checkout Area',
          status: 'online',
          lastSeen: new Date(),
          inventory: 92,
          todayPlays: 38,
          todayWins: 11,
        },
        {
          id: 'KIOSK-003',
          name: 'Food Court',
          status: 'online',
          lastSeen: new Date(),
          inventory: 67,
          todayPlays: 51,
          todayWins: 15,
        },
        {
          id: 'KIOSK-004',
          name: 'Electronics',
          status: 'online',
          lastSeen: new Date(Date.now() - 300000),
          inventory: 78,
          todayPlays: 25,
          todayWins: 8,
        },
        {
          id: 'KIOSK-005',
          name: 'Parking Lot',
          status: 'offline',
          lastSeen: new Date(Date.now() - 3600000),
          inventory: 45,
          todayPlays: 0,
          todayWins: 0,
        },
      ]);

      setIsLoading(false);
    };

    loadData();
  }, []);

  const getStatusBadge = (status: KioskStatus['status']) => {
    const badges = {
      online: 'status-badge online',
      offline: 'status-badge offline',
      error: 'status-badge error',
    };
    return badges[status];
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Kiosk Dashboard</h1>
          <nav className="header-nav">
            <button className="nav-button active">Monitoring</button>
            <button className="nav-button" onClick={() => onNavigate?.('config')}>
              Configuration
            </button>
            <button className="nav-button" onClick={() => onNavigate?.('ads')}>
              Ads
            </button>
            <button className="nav-button" onClick={() => onNavigate?.('questions')}>
              Questions
            </button>
          </nav>
        </div>
        <div className="header-right">
          <span className="user-email">{user.email}</span>
          <button className="logout-button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <section className="stats-section">
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Kiosks</h3>
            <p className="stat-value">{stats?.totalKiosks}</p>
            <p className="stat-detail">
              {stats?.onlineKiosks} online
            </p>
          </div>
          <div className="stat-card">
            <h3>Today's Plays</h3>
            <p className="stat-value">{stats?.totalPlaysToday}</p>
          </div>
          <div className="stat-card">
            <h3>Today's Wins</h3>
            <p className="stat-value">{stats?.totalWinsToday}</p>
            <p className="stat-detail">
              {stats?.winRate.toFixed(1)}% win rate
            </p>
          </div>
          <div className="stat-card">
            <h3>Revenue</h3>
            <p className="stat-value">€{stats?.totalRevenue}</p>
          </div>
        </div>
      </section>

      {/* Kiosk List */}
      <section className="kiosks-section">
        <h2>Kiosk Status</h2>
        <table className="kiosks-table">
          <thead>
            <tr>
              <th>Kiosk</th>
              <th>Location</th>
              <th>Status</th>
              <th>Inventory</th>
              <th>Plays</th>
              <th>Wins</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {kiosks.map((kiosk) => (
              <tr key={kiosk.id}>
                <td>{kiosk.id}</td>
                <td>{kiosk.name}</td>
                <td>
                  <span className={getStatusBadge(kiosk.status)}>
                    {kiosk.status}
                  </span>
                </td>
                <td>{kiosk.inventory}</td>
                <td>{kiosk.todayPlays}</td>
                <td>{kiosk.todayWins}</td>
                <td>{kiosk.lastSeen.toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
