// Admin Dashboard - Analytics Page
import { useState, useEffect } from 'react';

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

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7days');

  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      setAnalytics({
        totalPlays: 1245,
        totalWins: 374,
        winRate: 30.0,
        revenue: 2490,
        avgPlaysPerKiosk: 249,
        topKiosk: 'KIOSK-003 (Food Court)',
      });

      setDailyStats([
        { date: '2025-01-05', plays: 156, wins: 47, revenue: 312 },
        { date: '2025-01-06', plays: 189, wins: 58, revenue: 378 },
        { date: '2025-01-07', plays: 201, wins: 61, revenue: 402 },
        { date: '2025-01-08', plays: 178, wins: 52, revenue: 356 },
        { date: '2025-01-09', plays: 165, wins: 50, revenue: 330 },
        { date: '2025-01-10', plays: 198, wins: 59, revenue: 396 },
        { date: '2025-01-11', plays: 158, wins: 47, revenue: 316 },
      ]);

      setIsLoading(false);
    };

    loadAnalytics();
  }, [dateRange]);

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>View performance metrics and insights</p>
      </div>

      {/* Date Range Filter */}
      <div className="filters-bar">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="filter-select"
        >
          <option value="7days">Last 7 Days</option>
          <option value="30days">Last 30 Days</option>
          <option value="90days">Last 90 Days</option>
        </select>
      </div>

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

      {/* Daily Stats Table */}
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
    </div>
  );
}
