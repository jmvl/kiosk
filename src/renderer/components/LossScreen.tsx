// Skeleton components for Story 1.7

export interface LossScreenProps {
  onComplete: () => void;
}

export function LossScreen({ onComplete: _onComplete }: LossScreenProps) {
  // TODO: Implement in Story 1.7, will use onComplete callback
  return (
    <div className="loss-screen">
      <h2>Better luck next time!</h2>
      <p>Insert another coin to play again</p>
    </div>
  );
}
