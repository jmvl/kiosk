// Admin Dashboard - Analytics Page
import { useState, useEffect, useCallback } from 'react';

interface AnalyticsData {
  totalPlays: number;
  totalWins: number;
  winRate: number;
  revenue: number;
  avgPlaysPerKiosk: number;
  topKiosk: string;
}

interface DailyStats {
  date: string;
  plays: number;
  wins: number;
  revenue: number;
}

type AnalyticsTab = 'overview' | 'daily' | 'kiosks';
type DateRange = 'today' | '7days' | '30days' | '90days';

// Export data to CSV
const exportToCsv = (data: DailyStats[], filename: string) => {
  const headers = ['Date', 'Plays', 'Wins', 'Win Rate', 'Revenue'];
  const rows = data.map((row) => [
    row.date,
    row.plays.toString(),
    row.wins.toString(),
    `${((row.wins / row.plays) * 100).toFixed(1)}%`,
    `€${row.revenue}`,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

// Parse URL search params for filters
const getParamsFromUrl = () => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as AnalyticsTab | null;
  const range = params.get('range') as DateRange | null;
  return {
    tab: ['overview', 'daily', 'kiosks'].includes(tab || '') ? tab : 'overview',
    range: ['today', '7days', '30days', '90days'].includes(range || '') ? range : '7days',
  };
};

// Update URL with current filters
const updateUrlParams = (tab: AnalyticsTab, range: DateRange) => {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  url.searchParams.set('range', range);
  window.history.replaceState(null, '', url.toString());
};

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize from URL params
  const initialParams = getParamsFromUrl();
  const [dateRange, setDateRange] = useState<DateRange>(initialParams.range as DateRange);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(initialParams.tab as AnalyticsTab);

  // Sync URL when filters change
  useEffect(() => {
    updateUrlParams(activeTab, dateRange);
  }, [activeTab, dateRange]);

  // Handle tab change with URL update
  const handleTabChange = useCallback((tab: AnalyticsTab) => {
    setActiveTab(tab);
  }, []);

  // Handle date range change with URL update
  const handleRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Don't update state if component unmounted during fetch
      if (!isMounted) return;

      // Get today's date string for filtering
      const today = new Date().toISOString().split('T')[0];

      // Mock data for different date ranges
      const allDailyStats: DailyStats[] = [
        { date: '2025-01-05', plays: 156, wins: 47, revenue: 312 },
        { date: '2025-01-06', plays: 189, wins: 58, revenue: 378 },
        { date: '2025-01-07', plays: 201, wins: 61, revenue: 402 },
        { date: '2025-01-08', plays: 178, wins: 52, revenue: 356 },
        { date: '2025-01-09', plays: 165, wins: 50, revenue: 330 },
        { date: '2025-01-10', plays: 198, wins: 59, revenue: 396 },
        { date: '2025-01-11', plays: 158, wins: 47, revenue: 316 },
        { date: today, plays: 142, wins: 43, revenue: 284 }, // Today's data
      ];

      // Filter based on date range
      let filteredStats: DailyStats[];
      if (dateRange === 'today') {
        filteredStats = allDailyStats.filter((day) => day.date === today);
      } else {
        const daysToShow = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
        filteredStats = allDailyStats.slice(-daysToShow);
      }

      // Calculate aggregates from filtered data
      const totalPlays = filteredStats.reduce((sum, day) => sum + day.plays, 0);
      const totalWins = filteredStats.reduce((sum, day) => sum + day.wins, 0);
      const totalRevenue = filteredStats.reduce((sum, day) => sum + day.revenue, 0);
      const winRate = totalPlays > 0 ? (totalWins / totalPlays) * 100 : 0;

      setAnalytics({
        totalPlays,
        totalWins,
        winRate,
        revenue: totalRevenue,
        avgPlaysPerKiosk: Math.round(totalPlays / 5), // Assuming 5 kiosks
        topKiosk: 'KIOSK-003 (Food Court)',
      });

      setDailyStats(filteredStats);

      setIsLoading(false);
    };

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading analytics...</p>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Plays</h3>
                <p className="stat-value">{analytics?.totalPlays.toLocaleString()}</p>
              </div>
              <div className="stat-card">
                <h3>Total Wins</h3>
                <p className="stat-value">{analytics?.totalWins.toLocaleString()}</p>
                <p className="stat-detail">{analytics?.winRate.toFixed(1)}% win rate</p>
              </div>
              <div className="stat-card">
                <h3>Revenue</h3>
                <p className="stat-value">€{analytics?.revenue.toLocaleString()}</p>
              </div>
              <div className="stat-card">
                <h3>Avg Plays/Kiosk</h3>
                <p className="stat-value">{analytics?.avgPlaysPerKiosk}</p>
              </div>
            </div>

            {/* Top Performer */}
            <div className="info-card">
              <h3>Top Performing Kiosk</h3>
              <p>{analytics?.topKiosk}</p>
            </div>
          </>
        );
      case 'daily':
        return (
          <div className="table-container">
            <h2>Daily Breakdown</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plays</th>
                  <th>Wins</th>
                  <th>Win Rate</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {dailyStats.map((day) => (
                  <tr key={day.date}>
                    <td>{day.date}</td>
                    <td>{day.plays}</td>
                    <td>{day.wins}</td>
                    <td>{((day.wins / day.plays) * 100).toFixed(1)}%</td>
                    <td>€{day.revenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'kiosks':
        return (
          <div className="table-container">
            <h2>Kiosk Performance</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kiosk</th>
                  <th>Location</th>
                  <th>Plays</th>
                  <th>Wins</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>KIOSK-001</td>
                  <td>Brussels - Central</td>
                  <td>312</td>
                  <td>94</td>
                  <td>€624</td>
                </tr>
                <tr>
                  <td>KIOSK-002</td>
                  <td>Brussels - Central</td>
                  <td>287</td>
                  <td>86</td>
                  <td>€574</td>
                </tr>
                <tr>
                  <td>KIOSK-003</td>
                  <td>Antwerp - Mall</td>
                  <td>356</td>
                  <td>107</td>
                  <td>€712</td>
                </tr>
                <tr>
                  <td>KIOSK-004</td>
                  <td>Ghent - Station</td>
                  <td>198</td>
                  <td>59</td>
                  <td>€396</td>
                </tr>
                <tr>
                  <td>KIOSK-005</td>
                  <td>Bruges - Center</td>
                  <td>92</td>
                  <td>28</td>
                  <td>€184</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>View performance metrics and insights</p>
      </div>

      {/* Tab Navigation */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleTabChange('overview')}
          data-testid="tab-overview"
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'daily' ? 'active' : ''}`}
          onClick={() => handleTabChange('daily')}
          data-testid="tab-daily"
        >
          Daily Stats
        </button>
        <button
          className={`tab-button ${activeTab === 'kiosks' ? 'active' : ''}`}
          onClick={() => handleTabChange('kiosks')}
          data-testid="tab-kiosks"
        >
          By Kiosk
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="filters-bar">
        <select
          value={dateRange}
          onChange={(e) => handleRangeChange(e.target.value as DateRange)}
          className="filter-select"
          aria-label="Date range filter"
        >
          <option value="today">Today</option>
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
        </select>
        <button
          className="primary-button"
          onClick={() => exportToCsv(dailyStats, `analytics-${dateRange}.csv`)}
          data-testid="export-csv"
        >
          Export CSV
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content" data-testid="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}
