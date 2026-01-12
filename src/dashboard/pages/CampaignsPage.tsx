// Admin Dashboard - Campaigns Management Page
import { useState, useEffect, useCallback } from 'react';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'scheduled' | 'ended' | 'draft';
  startDate: Date;
  endDate: Date;
  targetKiosks: number;
  impressions: number;
  createdBy: string;
  adId?: string; // Associated video ad
}

// Available video ads (would come from Convex in production)
const AVAILABLE_ADS = [
  { id: 'ad-1', title: 'Summer Deals' },
  { id: 'ad-2', title: 'Weekly Specials' },
  { id: 'ad-3', title: 'Loyalty Points' },
];

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>({
    name: '',
    status: 'draft',
    startDate: new Date(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    targetKiosks: 1,
    adId: '',
  });

  // Compute campaign status based on dates
  const computeStatus = useCallback((campaign: Campaign): Campaign['status'] => {
    const now = new Date();
    const start = new Date(campaign.startDate);
    const end = new Date(campaign.endDate);

    // Don't override draft status
    if (campaign.status === 'draft') return 'draft';

    if (now > end) return 'ended';
    if (now >= start && now <= end) return 'active';
    if (now < start) return 'scheduled';
    return campaign.status;
  }, []);

  // Update campaign statuses periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCampaigns((prev) =>
        prev.map((c) => {
          const computedStatus = computeStatus(c);
          if (c.status !== computedStatus && c.status !== 'draft') {
            return { ...c, status: computedStatus };
          }
          return c;
        })
      );
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [computeStatus]);

  useEffect(() => {
    const loadCampaigns = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Initial campaigns with computed status based on dates
      const initialCampaigns: Campaign[] = [
        {
          id: 'CAMP-001',
          name: 'Summer Sale 2025',
          status: 'active', // Will be recalculated
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          targetKiosks: 5,
          impressions: 12450,
          createdBy: 'admin@chain.be',
          adId: 'ad-1',
        },
        {
          id: 'CAMP-002',
          name: 'New Product Launch',
          status: 'scheduled', // Will be recalculated
          startDate: new Date('2025-02-01'),
          endDate: new Date('2025-02-28'),
          targetKiosks: 3,
          impressions: 0,
          createdBy: 'marketing@brand.be',
          adId: 'ad-2',
        },
        {
          id: 'CAMP-003',
          name: 'Holiday Promo',
          status: 'ended', // Will be recalculated
          startDate: new Date('2024-12-01'),
          endDate: new Date('2024-12-31'),
          targetKiosks: 5,
          impressions: 28340,
          createdBy: 'admin@chain.be',
          adId: 'ad-3',
        },
      ];

      // Compute initial statuses based on dates
      const campaignsWithStatus = initialCampaigns.map((c) => ({
        ...c,
        status: computeStatus(c),
      }));

      setCampaigns(campaignsWithStatus);

      setIsLoading(false);
    };

    loadCampaigns();
  }, [computeStatus]);

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

  // Create new campaign
  const handleCreateCampaign = () => {
    if (!newCampaign.name || !newCampaign.startDate || !newCampaign.endDate) {
      alert('Please fill in all required fields');
      return;
    }

    // Validate end date is after start date
    if (newCampaign.endDate <= newCampaign.startDate) {
      alert('End date must be after start date');
      return;
    }

    const campaign: Campaign = {
      id: `CAMP-${String(campaigns.length + 1).padStart(3, '0')}`,
      name: newCampaign.name || '',
      status: computeStatus({
        ...newCampaign,
        id: '',
        name: newCampaign.name || '',
        status: 'scheduled',
        impressions: 0,
        createdBy: '',
        startDate: newCampaign.startDate || new Date(),
        endDate: newCampaign.endDate || new Date(),
        targetKiosks: newCampaign.targetKiosks || 1,
      }),
      startDate: newCampaign.startDate || new Date(),
      endDate: newCampaign.endDate || new Date(),
      targetKiosks: newCampaign.targetKiosks || 1,
      impressions: 0,
      createdBy: 'current@user.be',
      adId: newCampaign.adId,
    };

    setCampaigns((prev) => [...prev, campaign]);
    setShowCreateModal(false);
    setNewCampaign({
      name: '',
      status: 'draft',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      targetKiosks: 1,
      adId: '',
    });
  };

  // Delete campaign
  const handleDelete = (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;
    setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
    // TODO: Delete from Convex
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
        <button className="primary-button" onClick={() => setShowCreateModal(true)}>
          + New Campaign
        </button>
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
                  <div className="action-buttons">
                    <button
                      className="action-button small"
                      onClick={() => handleEdit(campaign)}
                      data-testid={`edit-campaign-${campaign.id}`}
                    >
                      Edit
                    </button>
                    <button
                      className="action-button small delete"
                      onClick={() => handleDelete(campaign.id)}
                      data-testid={`delete-campaign-${campaign.id}`}
                    >
                      Delete
                    </button>
                  </div>
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

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" data-testid="create-modal">
          <div className="modal">
            <div className="modal-header">
              <h2>Create Campaign</h2>
              <button className="close-button" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Campaign Name *</label>
                <input
                  type="text"
                  value={newCampaign.name || ''}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  placeholder="Enter campaign name"
                  data-testid="create-campaign-name"
                />
              </div>
              <div className="form-group">
                <label>Video Ad</label>
                <select
                  value={newCampaign.adId || ''}
                  onChange={(e) => setNewCampaign({ ...newCampaign, adId: e.target.value })}
                  data-testid="create-campaign-ad"
                >
                  <option value="">Select a video ad...</option>
                  {AVAILABLE_ADS.map((ad) => (
                    <option key={ad.id} value={ad.id}>{ad.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={newCampaign.startDate ? formatDateForInput(newCampaign.startDate) : ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, startDate: new Date(e.target.value) })}
                    data-testid="create-campaign-start"
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={newCampaign.endDate ? formatDateForInput(newCampaign.endDate) : ''}
                    onChange={(e) => setNewCampaign({ ...newCampaign, endDate: new Date(e.target.value) })}
                    data-testid="create-campaign-end"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Target Kiosks</label>
                <input
                  type="number"
                  min="1"
                  value={newCampaign.targetKiosks || 1}
                  onChange={(e) => setNewCampaign({ ...newCampaign, targetKiosks: Number(e.target.value) })}
                  data-testid="create-campaign-kiosks"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="primary-button" onClick={handleCreateCampaign} data-testid="create-campaign-submit">
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
