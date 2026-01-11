// Admin Dashboard - Configuration Page
import { useState, useEffect } from 'react';

interface KioskConfig {
  kioskId: string;
  kioskName: string;
  winRate: number;
  dailyBudget: number;
  quizTimeLimit: number;
  language: 'fr' | 'nl';
  isActive: boolean;
}

export interface ConfigurationPageProps {
  onBack: () => void;
}

export function ConfigurationPage({ onBack }: ConfigurationPageProps) {
  const [configs, setConfigs] = useState<KioskConfig[]>([]);
  const [selectedKiosk, setSelectedKiosk] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Form state for selected kiosk
  const [formData, setFormData] = useState<Partial<KioskConfig>>({});

  useEffect(() => {
    // Load configurations
    const loadConfigs = async () => {
      setIsLoading(true);

      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data
      const mockConfigs: KioskConfig[] = [
        {
          kioskId: 'KIOSK-001',
          kioskName: 'Main Entrance',
          winRate: 30,
          dailyBudget: 10,
          quizTimeLimit: 15,
          language: 'fr',
          isActive: true,
        },
        {
          kioskId: 'KIOSK-002',
          kioskName: 'Checkout Area',
          winRate: 30,
          dailyBudget: 10,
          quizTimeLimit: 15,
          language: 'nl',
          isActive: true,
        },
        {
          kioskId: 'KIOSK-003',
          kioskName: 'Food Court',
          winRate: 25,
          dailyBudget: 15,
          quizTimeLimit: 20,
          language: 'fr',
          isActive: true,
        },
      ];

      setConfigs(mockConfigs);
      if (mockConfigs.length > 0) {
        setSelectedKiosk(mockConfigs[0].kioskId);
        setFormData(mockConfigs[0]);
      }
      setIsLoading(false);
    };

    loadConfigs();
  }, []);

  const handleKioskSelect = (kioskId: string) => {
    setSelectedKiosk(kioskId);
    const config = configs.find((c) => c.kioskId === kioskId);
    if (config) {
      setFormData(config);
    }
    setSaveMessage(null);
  };

  const handleInputChange = (field: keyof KioskConfig, value: string | number | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSaveMessage(null);
  };

  const handleSave = async () => {
    if (!selectedKiosk) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // TODO: Replace with actual Convex mutation
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update local state
      setConfigs((prev) =>
        prev.map((c) =>
          c.kioskId === selectedKiosk ? { ...c, ...formData } as KioskConfig : c
        )
      );

      setSaveMessage('Configuration saved successfully!');
    } catch {
      setSaveMessage('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="config-loading">
        <p>Loading configurations...</p>
      </div>
    );
  }

  const currentConfig = configs.find((c) => c.kioskId === selectedKiosk);

  return (
    <div className="config-page">
      <header className="config-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>Kiosk Configuration</h1>
      </header>

      <div className="config-content">
        {/* Kiosk selector */}
        <aside className="kiosk-selector">
          <h3>Select Kiosk</h3>
          <ul className="kiosk-list">
            {configs.map((config) => (
              <li
                key={config.kioskId}
                className={`kiosk-item ${selectedKiosk === config.kioskId ? 'selected' : ''}`}
                onClick={() => handleKioskSelect(config.kioskId)}
              >
                <span className="kiosk-id">{config.kioskId}</span>
                <span className="kiosk-name">{config.kioskName}</span>
              </li>
            ))}
          </ul>
        </aside>

        {/* Configuration form */}
        {currentConfig && (
          <main className="config-form">
            <h2>Configure {currentConfig.kioskName}</h2>

            {saveMessage && (
              <div className={`save-message ${saveMessage.includes('Failed') ? 'error' : 'success'}`}>
                {saveMessage}
              </div>
            )}

            <div className="form-section">
              <h3>Game Settings</h3>

              <div className="form-group">
                <label htmlFor="winRate">Win Rate (%)</label>
                <input
                  type="number"
                  id="winRate"
                  min="0"
                  max="100"
                  value={formData.winRate || 0}
                  onChange={(e) => handleInputChange('winRate', parseInt(e.target.value))}
                />
                <span className="help-text">Percentage of games that result in a win (0-100)</span>
              </div>

              <div className="form-group">
                <label htmlFor="dailyBudget">Daily Win Budget</label>
                <input
                  type="number"
                  id="dailyBudget"
                  min="0"
                  max="1000"
                  value={formData.dailyBudget || 0}
                  onChange={(e) => handleInputChange('dailyBudget', parseInt(e.target.value))}
                />
                <span className="help-text">Maximum number of wins per day before budget exhausted</span>
              </div>

              <div className="form-group">
                <label htmlFor="quizTimeLimit">Quiz Time Limit (seconds)</label>
                <input
                  type="number"
                  id="quizTimeLimit"
                  min="5"
                  max="60"
                  value={formData.quizTimeLimit || 15}
                  onChange={(e) => handleInputChange('quizTimeLimit', parseInt(e.target.value))}
                />
                <span className="help-text">Time allowed to answer quiz question (5-60 seconds)</span>
              </div>
            </div>

            <div className="form-section">
              <h3>Localization</h3>

              <div className="form-group">
                <label htmlFor="language">Language</label>
                <select
                  id="language"
                  value={formData.language || 'fr'}
                  onChange={(e) => handleInputChange('language', e.target.value)}
                >
                  <option value="fr">French (Français)</option>
                  <option value="nl">Dutch (Nederlands)</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>Status</h3>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive || false}
                    onChange={(e) => handleInputChange('isActive', e.target.checked)}
                  />
                  Kiosk Active
                </label>
                <span className="help-text">Inactive kiosks will not accept coins</span>
              </div>
            </div>

            <div className="form-actions">
              <button
                className="save-button"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
