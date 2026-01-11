// Admin Dashboard - Main Dashboard Page (Overview)
import { useState, useEffect } from 'react';
import { UserRole } from '../components/Sidebar';

interface User {
  email: string;
  name?: string;
  role: UserRole;
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

export function DashboardPage({ user }: DashboardPageProps) {
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

      // Mock kiosk data for MVP
      const mockKiosks: KioskStatus[] = [
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
      ];

      // Calculate stats from kiosk data to ensure counts match
      const onlineCount = mockKiosks.filter((k) => k.status === 'online').length;
      const totalPlays = mockKiosks.reduce((sum, k) => sum + k.todayPlays, 0);
      const totalWins = mockKiosks.reduce((sum, k) => sum + k.todayWins, 0);

      setKiosks(mockKiosks);
      setStats({
        totalKiosks: mockKiosks.length,
        onlineKiosks: onlineCount,
        totalPlaysToday: totalPlays,
        totalWinsToday: totalWins,
        winRate: totalPlays > 0 ? (totalWins / totalPlays) * 100 : 0,
        totalRevenue: totalPlays * 2, // €2 per play
      });

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
      <div className="page-loading">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, {user.name || user.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Kiosks</h3>
          <p className="stat-value">{stats?.totalKiosks}</p>
          <p className="stat-detail">{stats?.onlineKiosks} online</p>
        </div>
        <div className="stat-card">
          <h3>Today's Plays</h3>
          <p className="stat-value">{stats?.totalPlaysToday}</p>
        </div>
        <div className="stat-card">
          <h3>Today's Wins</h3>
          <p className="stat-value">{stats?.totalWinsToday}</p>
          <p className="stat-detail">{stats?.winRate.toFixed(1)}% win rate</p>
        </div>
        <div className="stat-card">
          <h3>Revenue</h3>
          <p className="stat-value">€{stats?.totalRevenue}</p>
        </div>
      </div>

      {/* Kiosk Status Overview */}
      <div className="table-container">
        <h2>Kiosk Status</h2>
        <table className="data-table">
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
                  <span className={getStatusBadge(kiosk.status)}>{kiosk.status}</span>
                </td>
                <td>{kiosk.inventory}</td>
                <td>{kiosk.todayPlays}</td>
                <td>{kiosk.todayWins}</td>
                <td>{kiosk.lastSeen.toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
