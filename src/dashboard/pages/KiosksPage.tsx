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

export interface KiosksPageProps {
  onNavigateToKiosk?: (kioskId: string) => void;
}

const ITEMS_PER_PAGE = 5;

// Session storage keys for filter persistence
const STORAGE_KEYS = {
  search: 'kiosks_search',
  status: 'kiosks_status',
  page: 'kiosks_page',
};

export function KiosksPage({ onNavigateToKiosk }: KiosksPageProps) {
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Initialize from sessionStorage for persistence across navigation
  const [searchTerm, setSearchTerm] = useState(() =>
    sessionStorage.getItem(STORAGE_KEYS.search) || ''
  );
  const [statusFilter, setStatusFilter] = useState<string>(() =>
    sessionStorage.getItem(STORAGE_KEYS.status) || 'all'
  );
  const [currentPage, setCurrentPage] = useState(() => {
    const stored = sessionStorage.getItem(STORAGE_KEYS.page);
    return stored ? parseInt(stored, 10) : 1;
  });

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
        {
          id: 'KIOSK-006',
          name: 'West Wing',
          location: 'Liege - Mall',
          status: 'online',
          lastSeen: new Date(),
          inventory: 72,
          todayPlays: 33,
          todayWins: 10,
        },
        {
          id: 'KIOSK-007',
          name: 'Garden Center',
          location: 'Leuven - Suburb',
          status: 'online',
          lastSeen: new Date(),
          inventory: 88,
          todayPlays: 28,
          todayWins: 8,
        },
        {
          id: 'KIOSK-008',
          name: 'Kids Zone',
          location: 'Antwerp - Mall',
          status: 'error',
          lastSeen: new Date(Date.now() - 1800000),
          inventory: 56,
          todayPlays: 15,
          todayWins: 4,
        },
        {
          id: 'KIOSK-009',
          name: 'Sports Section',
          location: 'Brussels - North',
          status: 'online',
          lastSeen: new Date(),
          inventory: 91,
          todayPlays: 45,
          todayWins: 14,
        },
        {
          id: 'KIOSK-010',
          name: 'Bakery Counter',
          location: 'Ghent - Downtown',
          status: 'online',
          lastSeen: new Date(),
          inventory: 79,
          todayPlays: 37,
          todayWins: 11,
        },
        {
          id: 'KIOSK-011',
          name: 'Pharmacy Entrance',
          location: 'Charleroi - Mall',
          status: 'offline',
          lastSeen: new Date(Date.now() - 7200000),
          inventory: 34,
          todayPlays: 0,
          todayWins: 0,
        },
        {
          id: 'KIOSK-012',
          name: 'Customer Service',
          location: 'Namur - Center',
          status: 'online',
          lastSeen: new Date(),
          inventory: 65,
          todayPlays: 22,
          todayWins: 7,
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

  const handleRowClick = (kioskId: string) => {
    if (onNavigateToKiosk) {
      onNavigateToKiosk(kioskId);
    }
  };

  const filteredKiosks = kiosks.filter((kiosk) => {
    const matchesSearch =
      kiosk.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kiosk.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || kiosk.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredKiosks.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedKiosks = filteredKiosks.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Reset to page 1 when filters change and persist to sessionStorage
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
    sessionStorage.setItem(STORAGE_KEYS.search, value);
    sessionStorage.setItem(STORAGE_KEYS.page, '1');
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
    sessionStorage.setItem(STORAGE_KEYS.status, value);
    sessionStorage.setItem(STORAGE_KEYS.page, '1');
  };

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    sessionStorage.setItem(STORAGE_KEYS.page, String(newPage));
  };

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
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
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
            {paginatedKiosks.map((kiosk) => (
              <tr
                key={kiosk.id}
                onClick={() => handleRowClick(kiosk.id)}
                className="clickable-row"
                data-testid={`kiosk-row-${kiosk.id}`}
              >
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
                  <button
                    className="action-button small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(kiosk.id);
                    }}
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination" data-testid="pagination">
          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            data-testid="prev-page"
          >
            ← Previous
          </button>
          <div className="pagination-pages">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                onClick={() => goToPage(page)}
                data-testid={`page-${page}`}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            className="pagination-btn"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            data-testid="next-page"
          >
            Next →
          </button>
        </div>
      )}

      <p className="pagination-info">
        Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredKiosks.length)} of{' '}
        {filteredKiosks.length} kiosks
      </p>
    </div>
  );
}
