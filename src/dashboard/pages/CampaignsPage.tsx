// Admin Dashboard - Campaigns Management Page
import { useState, useEffect } from 'react';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'scheduled' | 'ended' | 'draft';
  startDate: Date;
  endDate: Date;
  targetKiosks: number;
  impressions: number;
  createdBy: string;
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadCampaigns = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      setCampaigns([
        {
          id: 'CAMP-001',
          name: 'Summer Sale 2025',
          status: 'active',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          targetKiosks: 5,
          impressions: 12450,
          createdBy: 'admin@chain.be',
        },
        {
          id: 'CAMP-002',
          name: 'New Product Launch',
          status: 'scheduled',
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-02-28'),
          targetKiosks: 3,
          impressions: 0,
          createdBy: 'marketing@brand.be',
        },
        {
          id: 'CAMP-003',
          name: 'Holiday Promo',
          status: 'ended',
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-31'),
          targetKiosks: 5,
          impressions: 28340,
          createdBy: 'admin@chain.be',
        },
      ]);

      setIsLoading(false);
    };

    loadCampaigns();
  }, []);

  const getStatusBadge = (status: Campaign['status']) => {
    const badges: Record<Campaign['status'], string> = {
      active: 'status-badge online',
      scheduled: 'status-badge processing',
      ended: 'status-badge offline',
      draft: 'status-badge',
    };
    return badges[status];
  };

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Campaigns</h1>
        <p>Manage advertising campaigns across kiosks</p>
      </div>

      <div className="page-actions">
        <button className="primary-button">+ New Campaign</button>
      </div>

      {/* Campaigns Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Target Kiosks</th>
              <th>Impressions</th>
              <th>Created By</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id}>
                <td>
                  <strong>{campaign.name}</strong>
                  <br />
                  <span className="text-muted">{campaign.id}</span>
                </td>
                <td>
                  <span className={getStatusBadge(campaign.status)}>{campaign.status}</span>
                </td>
                <td>{campaign.startDate.toLocaleDateString()}</td>
                <td>{campaign.endDate.toLocaleDateString()}</td>
                <td>{campaign.targetKiosks}</td>
                <td>{campaign.impressions.toLocaleString()}</td>
                <td>{campaign.createdBy}</td>
                <td>
                  <button className="action-button small">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
