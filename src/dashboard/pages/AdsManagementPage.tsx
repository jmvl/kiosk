// Admin Dashboard - Ads Management Page
import { useState, useEffect, useRef } from 'react';

interface VideoAd {
  id: string;
  title: string;
  fileName: string;
  duration: number; // seconds
  uploadedAt: Date;
  status: 'active' | 'inactive' | 'processing';
  impressions: number;
  url: string;
}

export interface AdsManagementPageProps {
  onBack: () => void;
}

export function AdsManagementPage({ onBack }: AdsManagementPageProps) {
  const [ads, setAds] = useState<VideoAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load ads
    const loadAds = async () => {
      setIsLoading(true);

      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data
      setAds([
        {
          id: '1',
          title: 'Summer Deals',
          fileName: 'summer-deals.mp4',
          duration: 30,
          uploadedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          status: 'active',
          impressions: 1234,
          url: 'https://storage.convex.cloud/ads/summer-deals.mp4',
        },
        {
          id: '2',
          title: 'Weekly Specials',
          fileName: 'weekly-specials.mp4',
          duration: 30,
          uploadedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          status: 'active',
          impressions: 567,
          url: 'https://storage.convex.cloud/ads/weekly-specials.mp4',
        },
        {
          id: '3',
          title: 'Loyalty Points',
          fileName: 'loyalty-points.mp4',
          duration: 30,
          uploadedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          status: 'inactive',
          impressions: 0,
          url: 'https://storage.convex.cloud/ads/loyalty-points.mp4',
        },
      ]);

      setIsLoading(false);
    };

    loadAds();
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a video file');
      return;
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('File size must be less than 100MB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        setUploadProgress(i);
      }

      // TODO: Replace with actual Convex file upload
      // const uploadUrl = await convex.mutation(api.files.generateUploadUrl);
      // await fetch(uploadUrl, { method: 'POST', body: file });

      // Add new ad to list
      const newAd: VideoAd = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ''),
        fileName: file.name,
        duration: 30, // Would be detected from video
        uploadedAt: new Date(),
        status: 'processing',
        impressions: 0,
        url: URL.createObjectURL(file), // Temporary URL
      };

      setAds((prev) => [newAd, ...prev]);

      // Simulate processing completion
      setTimeout(() => {
        setAds((prev) =>
          prev.map((ad) =>
            ad.id === newAd.id ? { ...ad, status: 'active' as const } : ad
          )
        );
      }, 2000);
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleToggleStatus = async (adId: string) => {
    setAds((prev) =>
      prev.map((ad) =>
        ad.id === adId
          ? { ...ad, status: ad.status === 'active' ? 'inactive' : 'active' }
          : ad
      )
    );

    // TODO: Update in Convex
  };

  const handleDelete = async (adId: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;

    setAds((prev) => prev.filter((ad) => ad.id !== adId));

    // TODO: Delete from Convex
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="ads-loading">
        <p>Loading ads...</p>
      </div>
    );
  }

  return (
    <div className="ads-page">
      <header className="ads-header">
        <button className="back-button" onClick={onBack}>
          &larr; Back to Dashboard
        </button>
        <h1>Ads Management</h1>
      </header>

      <div className="ads-content">
        {/* Upload Section */}
        <section className="upload-section">
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <button
            className="upload-button"
            onClick={handleUploadClick}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : '+ Upload New Video Ad'}
          </button>

          {isUploading && (
            <div className="upload-progress">
              <div
                className="upload-progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
              <span>{uploadProgress}%</span>
            </div>
          )}

          {uploadError && <p className="upload-error">{uploadError}</p>}

          <p className="upload-help">
            Supported formats: MP4, WebM, MOV. Max file size: 100MB
          </p>
        </section>

        {/* Ads List */}
        <section className="ads-list-section">
          <h2>Video Ads ({ads.length})</h2>

          {ads.length === 0 ? (
            <div className="no-ads">
              <p>No ads uploaded yet. Click the button above to upload your first video ad.</p>
            </div>
          ) : (
            <table className="ads-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Duration</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th>Impressions</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.id}>
                    <td>
                      <div className="ad-title-cell">
                        <span className="ad-title">{ad.title}</span>
                        <span className="ad-filename">{ad.fileName}</span>
                      </div>
                    </td>
                    <td>{formatDuration(ad.duration)}</td>
                    <td>{formatDate(ad.uploadedAt)}</td>
                    <td>
                      <span className={`status-badge ${ad.status}`}>
                        {ad.status}
                      </span>
                    </td>
                    <td>{ad.impressions.toLocaleString()}</td>
                    <td>
                      <div className="ad-actions">
                        <button
                          className="action-button toggle"
                          onClick={() => handleToggleStatus(ad.id)}
                          disabled={ad.status === 'processing'}
                        >
                          {ad.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="action-button delete"
                          onClick={() => handleDelete(ad.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
