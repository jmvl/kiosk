// Skeleton components for Story 1.2

export interface QuizScreenProps {
  onComplete: (passed: boolean) => void;
}

export function QuizScreen({ onComplete }: QuizScreenProps) {
  // TODO: Implement in Story 1.2
  return (
    <div className="quiz-screen">
      <h2>Question</h2>
      <p>Loading quiz...</p>
    </div>
  );
}
