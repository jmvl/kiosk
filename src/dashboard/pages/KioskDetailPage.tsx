// Admin Dashboard - Kiosk Detail Page
import { useState, useEffect } from 'react';

interface KioskConfig {
  winRate: number;
  dailyBudget: number;
  language: 'fr' | 'nl';
}

interface KioskDetail {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  inventory: number;
  todayPlays: number;
  todayWins: number;
  config: KioskConfig;
  recentActivity: {
    timestamp: Date;
    type: 'play' | 'win' | 'error';
    details: string;
  }[];
}

export interface KioskDetailPageProps {
  kioskId: string;
  onBack: () => void;
}

export function KioskDetailPage({ kioskId, onBack }: KioskDetailPageProps) {
  const [kiosk, setKiosk] = useState<KioskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadKiosk = async () => {
      setIsLoading(true);
      setError(null);

      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock kiosk data based on ID
      const mockKiosks: Record<string, KioskDetail> = {
        'KIOSK-001': {
          id: 'KIOSK-001',
          name: 'Main Entrance',
          location: 'Brussels - Central',
          status: 'online',
          lastSeen: new Date(),
          inventory: 85,
          todayPlays: 42,
          todayWins: 13,
          config: {
            winRate: 30,
            dailyBudget: 100,
            language: 'fr',
          },
          recentActivity: [
            { timestamp: new Date(), type: 'play', details: 'Quiz passed, slot played' },
            { timestamp: new Date(Date.now() - 60000), type: 'win', details: 'Prize: 5€ coupon' },
            { timestamp: new Date(Date.now() - 120000), type: 'play', details: 'Quiz failed' },
          ],
        },
        'KIOSK-002': {
          id: 'KIOSK-002',
          name: 'Checkout Area',
          location: 'Brussels - Central',
          status: 'online',
          lastSeen: new Date(),
          inventory: 92,
          todayPlays: 38,
          todayWins: 11,
          config: {
            winRate: 30,
            dailyBudget: 100,
            language: 'fr',
          },
          recentActivity: [
            { timestamp: new Date(), type: 'win', details: 'Prize: Free product' },
            { timestamp: new Date(Date.now() - 30000), type: 'play', details: 'Quiz passed, slot played' },
          ],
        },
        'KIOSK-003': {
          id: 'KIOSK-003',
          name: 'Food Court',
          location: 'Antwerp - Mall',
          status: 'online',
          lastSeen: new Date(),
          inventory: 67,
          todayPlays: 51,
          todayWins: 15,
          config: {
            winRate: 30,
            dailyBudget: 150,
            language: 'nl',
          },
          recentActivity: [
            { timestamp: new Date(), type: 'play', details: 'Quiz passed, slot played' },
          ],
        },
        'KIOSK-004': {
          id: 'KIOSK-004',
          name: 'Electronics',
          location: 'Ghent - Station',
          status: 'online',
          lastSeen: new Date(Date.now() - 300000),
          inventory: 78,
          todayPlays: 25,
          todayWins: 8,
          config: {
            winRate: 25,
            dailyBudget: 80,
            language: 'nl',
          },
          recentActivity: [],
        },
        'KIOSK-005': {
          id: 'KIOSK-005',
          name: 'Parking Lot',
          location: 'Bruges - Center',
          status: 'offline',
          lastSeen: new Date(Date.now() - 3600000),
          inventory: 45,
          todayPlays: 0,
          todayWins: 0,
          config: {
            winRate: 30,
            dailyBudget: 50,
            language: 'fr',
          },
          recentActivity: [],
        },
      };

      const foundKiosk = mockKiosks[kioskId];
      if (foundKiosk) {
        setKiosk(foundKiosk);
      } else {
        setError(`Kiosk ${kioskId} not found`);
      }

      setIsLoading(false);
    };

    loadKiosk();
  }, [kioskId]);

  const getStatusBadge = (status: KioskDetail['status']) => {
    const badges = {
      online: 'status-badge online',
      offline: 'status-badge offline',
      error: 'status-badge error',
    };
    return badges[status];
  };

  const getActivityIcon = (type: 'play' | 'win' | 'error') => {
    switch (type) {
      case 'play':
        return '🎮';
      case 'win':
        return '🏆';
      case 'error':
        return '⚠️';
    }
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading kiosk details...</p>
      </div>
    );
  }

  if (error || !kiosk) {
    return (
      <div className="page-content">
        <div className="page-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Kiosks
          </button>
          <h1>Kiosk Not Found</h1>
        </div>
        <div className="info-card">
          <p>{error || 'Unknown error occurred'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <button className="back-button" onClick={onBack} data-testid="back-button">
          ← Back to Kiosks
        </button>
      </div>

      {/* Kiosk Header */}
      <div className="detail-header">
        <div className="detail-title">
          <h1>{kiosk.name}</h1>
          <span className="kiosk-id" data-testid="kiosk-id">{kiosk.id}</span>
        </div>
        <span className={getStatusBadge(kiosk.status)}>{kiosk.status}</span>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Location</h3>
          <p className="stat-value">{kiosk.location}</p>
        </div>
        <div className="stat-card">
          <h3>Inventory</h3>
          <p className="stat-value">{kiosk.inventory}%</p>
        </div>
        <div className="stat-card">
          <h3>Today's Plays</h3>
          <p className="stat-value">{kiosk.todayPlays}</p>
        </div>
        <div className="stat-card">
          <h3>Today's Wins</h3>
          <p className="stat-value">{kiosk.todayWins}</p>
          <p className="stat-detail">
            {kiosk.todayPlays > 0
              ? `${((kiosk.todayWins / kiosk.todayPlays) * 100).toFixed(1)}% win rate`
              : 'No plays yet'}
          </p>
        </div>
      </div>

      {/* Configuration */}
      <div className="info-card">
        <h3>Configuration</h3>
        <div className="config-grid">
          <div className="config-item">
            <span className="config-label">Win Rate:</span>
            <span className="config-value">{kiosk.config.winRate}%</span>
          </div>
          <div className="config-item">
            <span className="config-label">Daily Budget:</span>
            <span className="config-value">€{kiosk.config.dailyBudget}</span>
          </div>
          <div className="config-item">
            <span className="config-label">Language:</span>
            <span className="config-value">
              {kiosk.config.language === 'fr' ? 'French' : 'Dutch'}
            </span>
          </div>
          <div className="config-item">
            <span className="config-label">Last Seen:</span>
            <span className="config-value">{kiosk.lastSeen.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="table-container">
        <h2>Recent Activity</h2>
        {kiosk.recentActivity.length === 0 ? (
          <div className="no-activity">
            <p>No recent activity</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {kiosk.recentActivity.map((activity, index) => (
                <tr key={index}>
                  <td>{activity.timestamp.toLocaleTimeString()}</td>
                  <td>
                    {getActivityIcon(activity.type)} {activity.type}
                  </td>
                  <td>{activity.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
