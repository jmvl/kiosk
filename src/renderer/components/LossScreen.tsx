// Loss Screen - minimal feedback after losing the slot machine
import { useEffect } from 'react';
import { t } from '../services/LanguageService';

export interface LossScreenProps {
  onComplete: () => void;
}

export function LossScreen({ onComplete }: LossScreenProps) {
  useEffect(() => {
    // Auto-return to idle after 4 seconds
    const timer = setTimeout(() => {
      onComplete();
    }, 4000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="loss-screen">
      <div className="loss-content">
        <h2 className="loss-title">{t('loss.betterLuck')}</h2>
        <p className="loss-message">{t('loss.tryAgain')}</p>
        <div className="try-again-icon">🎰</div>
      </div>
    </div>
  );
}
