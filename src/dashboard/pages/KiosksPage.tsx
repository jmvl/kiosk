// Admin Dashboard - Kiosks Management Page
import { useState, useEffect } from 'react';

interface Kiosk {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'error';
  lastSeen: Date;
  inventory: number;
  todayPlays: number;
  todayWins: number;
}

export function KiosksPage() {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    const loadKiosks = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      setKiosks([
        {
          id: 'KIOSK-001',
          name: 'Main Entrance',
          location: 'Brussels - Central',
          status: 'online',
          lastSeen: new Date(),
          inventory: 85,
          todayPlays: 42,
          todayWins: 13,
        },
        {
          id: 'KIOSK-002',
          name: 'Checkout Area',
          location: 'Brussels - Central',
          status: 'online',
          lastSeen: new Date(),
          inventory: 92,
          todayPlays: 38,
          todayWins: 11,
        },
        {
          id: 'KIOSK-003',
          name: 'Food Court',
          location: 'Antwerp - Mall',
          status: 'online',
          lastSeen: new Date(),
          inventory: 67,
          todayPlays: 51,
          todayWins: 15,
        },
        {
          id: 'KIOSK-004',
          name: 'Electronics',
          location: 'Ghent - Station',
          status: 'online',
          lastSeen: new Date(Date.now() - 300000),
          inventory: 78,
          todayPlays: 25,
          todayWins: 8,
        },
        {
          id: 'KIOSK-005',
          name: 'Parking Lot',
          location: 'Bruges - Center',
          status: 'offline',
          lastSeen: new Date(Date.now() - 3600000),
          inventory: 45,
          todayPlays: 0,
          todayWins: 0,
        },
      ]);

      setIsLoading(false);
    };

    loadKiosks();
  }, []);

  const getStatusBadge = (status: Kiosk['status']) => {
    const badges = {
      online: 'status-badge online',
      offline: 'status-badge offline',
      error: 'status-badge error',
    };
    return badges[status];
  };

  const filteredKiosks = kiosks.filter((kiosk) => {
    const matchesSearch =
      kiosk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || kiosk.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading kiosks...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Kiosks</h1>
        <p>Manage and monitor all kiosk devices</p>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search kiosks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
          <option value="error">Error</option>
        </select>
      </div>

      {/* Kiosks Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Kiosk ID</th>
              <th>Name</th>
              <th>Location</th>
              <th>Status</th>
              <th>Inventory</th>
              <th>Today Plays</th>
              <th>Today Wins</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredKiosks.map((kiosk) => (
              <tr key={kiosk.id}>
                <td>{kiosk.id}</td>
                <td>{kiosk.name}</td>
                <td>{kiosk.location}</td>
                <td>
                  <span className={getStatusBadge(kiosk.status)}>{kiosk.status}</span>
                </td>
                <td>{kiosk.inventory}</td>
                <td>{kiosk.todayPlays}</td>
                <td>{kiosk.todayWins}</td>
                <td>{kiosk.lastSeen.toLocaleTimeString()}</td>
                <td>
                  <button className="action-button small">Configure</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
