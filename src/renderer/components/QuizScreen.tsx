// Quiz Screen - displays question with answer options
import { useState, useMemo } from 'react';
import { getRandomQuestion } from '../services/QuizService';
import { languageService, t } from '../services/LanguageService';

export interface QuizScreenProps {
  onComplete: (passed: boolean) => void;
}

export function QuizScreen({ onComplete }: QuizScreenProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Get a random question when component mounts (useMemo ensures same question during re-renders)
  const question = useMemo(() => getRandomQuestion(), []);

  // Use detected language from LanguageService
  const language = languageService.getLanguage();

  const handleAnswerSelect = (answerIndex: number) => {
    if (hasAnswered) return; // Prevent changing answer

    setSelectedAnswer(answerIndex);
    setHasAnswered(true);

    const isCorrect = answerIndex === question.correctAnswer;

    // Delay before transition to show result
    setTimeout(() => {
      onComplete(isCorrect);
    }, 1500);
  };

  const getAnswerButtonClass = (index: number) => {
    if (!hasAnswered) {
      return 'answer-button';
    }
    if (index === question.correctAnswer) {
      return 'answer-button correct';
    }
    if (index === selectedAnswer && index !== question.correctAnswer) {
      return 'answer-button incorrect';
    }
    return 'answer-button';
  };

  return (
    <div className="quiz-screen">
      <h2 className="quiz-title">{t('quiz.title')}</h2>
      <div className="question-container">
        <p className="question-text">{question.question[language]}</p>
      </div>
      <div className="answers-container">
        {question.answers[language].map((answer, index) => (
          <button
            key={index}
            className={getAnswerButtonClass(index)}
            onClick={() => handleAnswerSelect(index)}
            disabled={hasAnswered}
          >
            {answer}
          </button>
        ))}
      </div>
      {hasAnswered && (
        <div className="result-message">
          {selectedAnswer === question.correctAnswer ? (
            <p className="correct-message">{t('quiz.correct')}</p>
          ) : (
            <p className="incorrect-message">{t('quiz.incorrect')}</p>
          )}
        </div>
      )}
    </div>
  );
}
