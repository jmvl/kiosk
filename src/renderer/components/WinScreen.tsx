// Skeleton components for Story 1.7

export interface WinScreenProps {
  onComplete: () => void;
}

export function WinScreen({ onComplete: _onComplete }: WinScreenProps) {
  // TODO: Implement in Story 1.7, will use onComplete callback
  return (
    <div className="win-screen">
      <h1>🎉 YOU WIN! 🎉</h1>
      <p>Printing your ticket...</p>
    </div>
  );
}
