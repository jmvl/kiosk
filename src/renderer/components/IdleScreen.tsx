// Idle Screen - displays promotional videos and "Insert Coin" prompt
import { useState, useRef, useEffect } from 'react';

// Sample video ads - will be loaded from Convex in production
const SAMPLE_VIDEO_ADS = [
  {
    id: '1',
    title: 'Summer Deals',
    // Using a placeholder - in production, this would be a Convex-hosted URL
    url: 'https://storage.convex.cloud/placeholder/summer-deals.mp4',
    duration: 30,
  },
  {
    id: '2',
    title: 'Weekly Specials',
    url: 'https://storage.convex.cloud/placeholder/weekly-specials.mp4',
    duration: 30,
  },
  {
    id: '3',
    title: 'Loyalty Points',
    url: 'https://storage.convex.cloud/placeholder/loyalty-points.mp4',
    duration: 30,
  },
];

export function IdleScreen() {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentAd = SAMPLE_VIDEO_ADS[currentAdIndex];

  // Rotate to next video when current one ends
  const handleVideoEnd = () => {
    setCurrentAdIndex((prev) => (prev + 1) % SAMPLE_VIDEO_ADS.length);
    setIsVideoLoaded(false);
  };

  // Auto-play video when loaded
  useEffect(() => {
    if (videoRef.current && isVideoLoaded) {
      videoRef.current.play().catch(() => {
        // Autoplay might be blocked, that's ok
        console.log('[IdleScreen] Autoplay blocked, waiting for user interaction');
      });
    }
  }, [isVideoLoaded, currentAdIndex]);

  // Handle video load error - move to next video
  const handleVideoError = () => {
    console.log('[IdleScreen] Video load error, trying next ad');
    handleVideoEnd();
  };

  return (
    <div className="idle-screen">
      {/* Video ad player */}
      <div className="video-container">
        <video
          ref={videoRef}
          className="ad-video"
          src={currentAd.url}
          muted
          loop={false}
          playsInline
          onLoadedData={() => setIsVideoLoaded(true)}
          onEnded={handleVideoEnd}
          onError={handleVideoError}
        />

        {/* Fallback content if video fails to load */}
        {!isVideoLoaded && (
          <div className="video-fallback">
            <div className="promo-text">
              <h2>🛒 Special Offers!</h2>
              <p>Play to win amazing prizes!</p>
            </div>
          </div>
        )}
      </div>

      {/* Insert coin prompt overlay */}
      <div className="coin-prompt-overlay">
        <div className="coin-prompt">
          <h1 className="insert-coin-text">Insert Coin to Play!</h1>
          <div className="coin-icons">
            <span className="coin coin-1">€1</span>
            <span className="coin coin-2">€2</span>
            <span className="coin coin-5">€5</span>
          </div>
          <p className="win-chance-text">Win prizes instantly!</p>
        </div>
      </div>

      {/* Ad info (subtle) */}
      <div className="ad-info">
        <span className="ad-title">{currentAd.title}</span>
        <span className="ad-indicator">
          Ad {currentAdIndex + 1} of {SAMPLE_VIDEO_ADS.length}
        </span>
      </div>
    </div>
  );
}
