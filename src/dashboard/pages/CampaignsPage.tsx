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
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

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

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign({ ...campaign });
  };

  const handleSaveEdit = () => {
    if (!editingCampaign) return;
    setCampaigns((prev) =>
      prev.map((c) => (c.id === editingCampaign.id ? editingCampaign : c))
    );
    setEditingCampaign(null);
  };

  const handleCancelEdit = () => {
    setEditingCampaign(null);
  };

  // Format date for input fields
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
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
                  <button
                    className="action-button small"
                    onClick={() => handleEdit(campaign)}
                    data-testid={`edit-campaign-${campaign.id}`}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingCampaign && (
        <div className="modal-overlay" data-testid="edit-modal">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Campaign</h2>
              <button className="close-button" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Campaign ID</label>
                <input type="text" value={editingCampaign.id} disabled />
              </div>
              <div className="form-group">
                <label>Campaign Name</label>
                <input
                  type="text"
                  value={editingCampaign.name}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, name: e.target.value })
                  }
                  data-testid="edit-campaign-name"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formatDateForInput(editingCampaign.startDate)}
                    onChange={(e) =>
                      setEditingCampaign({ ...editingCampaign, startDate: new Date(e.target.value) })
                    }
                    data-testid="edit-campaign-start"
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={formatDateForInput(editingCampaign.endDate)}
                    onChange={(e) =>
                      setEditingCampaign({ ...editingCampaign, endDate: new Date(e.target.value) })
                    }
                    data-testid="edit-campaign-end"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editingCampaign.status}
                    onChange={(e) =>
                      setEditingCampaign({ ...editingCampaign, status: e.target.value as Campaign['status'] })
                    }
                    data-testid="edit-campaign-status"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="ended">Ended</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Target Kiosks</label>
                  <input
                    type="number"
                    value={editingCampaign.targetKiosks}
                    onChange={(e) =>
                      setEditingCampaign({ ...editingCampaign, targetKiosks: Number(e.target.value) })
                    }
                    data-testid="edit-campaign-kiosks"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="primary-button" onClick={handleSaveEdit} data-testid="save-edit">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
