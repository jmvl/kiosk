// Skeleton components for Story 1.4

export interface SlotMachineScreenProps {
  onComplete: (result: 'win' | 'loss') => void;
}

export function SlotMachineScreen({ onComplete }: SlotMachineScreenProps) {
  // TODO: Implement in Story 1.4
  return (
    <div className="slot-machine">
      <h2>Slot Machine</h2>
      <div className="reels">Coming soon...</div>
    </div>
  );
}
