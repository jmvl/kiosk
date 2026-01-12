// Admin Dashboard - Quiz Questions Management Page
import { useState, useEffect, useRef } from 'react';

interface Question {
  id: string;
  questionFr: string;
  questionNl: string;
  answersFr: string[];
  answersNl: string[];
  correctAnswer: number;
  active: boolean;
}

// Interface for imported question format
interface ImportedQuestion {
  questionFr: string;
  questionNl: string;
  answersFr: string[];
  answersNl: string[];
  correctAnswer: number;
}

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadQuestions = async () => {
      setIsLoading(true);
      // TODO: Replace with actual Convex query
      await new Promise((resolve) => setTimeout(resolve, 500));

      setQuestions([
        {
          id: 'Q-001',
          questionFr: 'Quelle est la capitale de la Belgique?',
          questionNl: 'Wat is de hoofdstad van België?',
          answersFr: ['Bruxelles', 'Anvers', 'Gand', 'Liège'],
          answersNl: ['Brussel', 'Antwerpen', 'Gent', 'Luik'],
          correctAnswer: 0,
          active: true,
        },
        {
          id: 'Q-002',
          questionFr: 'Combien de régions compte la Belgique?',
          questionNl: 'Hoeveel gewesten heeft België?',
          answersFr: ['2', '3', '4', '5'],
          answersNl: ['2', '3', '4', '5'],
          correctAnswer: 1,
          active: true,
        },
        {
          id: 'Q-003',
          questionFr: 'Quel est le plat national belge?',
          questionNl: 'Wat is het nationale gerecht van België?',
          answersFr: ['Pizza', 'Moules-frites', 'Paella', 'Sushi'],
          answersNl: ['Pizza', 'Mosselen-friet', 'Paella', 'Sushi'],
          correctAnswer: 1,
          active: true,
        },
        {
          id: 'Q-004',
          questionFr: 'Question inactive exemple',
          questionNl: 'Inactieve vraag voorbeeld',
          answersFr: ['A', 'B', 'C', 'D'],
          answersNl: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
          active: false,
        },
      ]);

      setIsLoading(false);
    };

    loadQuestions();
  }, []);

  const toggleActive = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, active: !q.active } : q))
    );
  };

  const handleEdit = (question: Question) => {
    setEditingQuestion({ ...question });
  };

  const handleSaveEdit = () => {
    if (!editingQuestion) return;
    setQuestions((prev) =>
      prev.map((q) => (q.id === editingQuestion.id ? editingQuestion : q))
    );
    setEditingQuestion(null);
  };

  const handleCancelEdit = () => {
    setEditingQuestion(null);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content) as ImportedQuestion[];

        if (!Array.isArray(imported)) {
          throw new Error('Invalid format: expected array of questions');
        }

        // Validate and convert imported questions
        const newQuestions: Question[] = imported.map((q, index) => {
          if (!q.questionFr || !q.questionNl || !q.answersFr || !q.answersNl) {
            throw new Error(`Question ${index + 1}: Missing required fields (questionFr, questionNl, answersFr, answersNl)`);
          }
          if (!Array.isArray(q.answersFr) || !Array.isArray(q.answersNl)) {
            throw new Error(`Question ${index + 1}: answersFr and answersNl must be arrays`);
          }
          if (q.answersFr.length !== q.answersNl.length) {
            throw new Error(`Question ${index + 1}: answersFr and answersNl must have same length`);
          }

          return {
            id: `Q-${String(questions.length + index + 1).padStart(3, '0')}`,
            questionFr: q.questionFr,
            questionNl: q.questionNl,
            answersFr: q.answersFr,
            answersNl: q.answersNl,
            correctAnswer: q.correctAnswer ?? 0,
            active: true,
          };
        });

        setQuestions((prev) => [...prev, ...newQuestions]);
        alert(`Successfully imported ${newQuestions.length} questions`);
      } catch (err) {
        setImportError(err instanceof Error ? err.message : 'Failed to parse JSON file');
      }
    };

    reader.readAsText(file);
    // Reset input so same file can be imported again
    event.target.value = '';
  };

  const filteredQuestions = showInactive
    ? questions
    : questions.filter((q) => q.active);

  if (isLoading) {
    return (
      <div className="page-loading">
        <p>Loading questions...</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Quiz Questions</h1>
        <p>Manage quiz questions for the kiosk game</p>
      </div>

      <div className="page-actions">
        <button className="primary-button">+ Add Question</button>
        <button
          className="secondary-button"
          onClick={handleImportClick}
          data-testid="import-questions"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileImport}
          style={{ display: 'none' }}
          aria-label="Import questions from JSON file"
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive questions
        </label>
      </div>

      {importError && (
        <div className="error-message" role="alert">
          Import Error: {importError}
        </div>
      )}

      {/* Questions List */}
      <div className="questions-list">
        {filteredQuestions.map((question) => (
          <div key={question.id} className={`question-card ${!question.active ? 'inactive' : ''}`}>
            <div className="question-header">
              <span className="question-id">{question.id}</span>
              <span className={`status-badge ${question.active ? 'online' : 'offline'}`}>
                {question.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="question-content">
              <div className="question-lang">
                <h4>🇫🇷 French</h4>
                <p className="question-text">{question.questionFr}</p>
                <ul className="answers-list">
                  {question.answersFr.map((answer, idx) => (
                    <li key={idx} className={idx === question.correctAnswer ? 'correct' : ''}>
                      {answer}
                      {idx === question.correctAnswer && ' ✓'}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="question-lang">
                <h4>🇳🇱 Dutch</h4>
                <p className="question-text">{question.questionNl}</p>
                <ul className="answers-list">
                  {question.answersNl.map((answer, idx) => (
                    <li key={idx} className={idx === question.correctAnswer ? 'correct' : ''}>
                      {answer}
                      {idx === question.correctAnswer && ' ✓'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="question-actions">
              <button
                className="action-button small"
                onClick={() => handleEdit(question)}
                data-testid={`edit-question-${question.id}`}
              >
                Edit
              </button>
              <button
                className="action-button small toggle"
                onClick={() => toggleActive(question.id)}
              >
                {question.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingQuestion && (
        <div className="modal-overlay" data-testid="edit-modal">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit Question</h2>
              <button className="close-button" onClick={handleCancelEdit} aria-label="Close modal">×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="question-id">Question ID</label>
                <input type="text" id="question-id" value={editingQuestion.id} disabled />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="question-fr">Question (French)</label>
                  <textarea
                    id="question-fr"
                    value={editingQuestion.questionFr}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionFr: e.target.value })
                    }
                    data-testid="edit-question-fr"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="question-nl">Question (Dutch)</label>
                  <textarea
                    id="question-nl"
                    value={editingQuestion.questionNl}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionNl: e.target.value })
                    }
                    data-testid="edit-question-nl"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label id="answers-fr-label">Answers (French)</label>
                  {editingQuestion.answersFr.map((answer, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={answer}
                      aria-labelledby="answers-fr-label"
                      aria-label={`French answer ${idx + 1}`}
                      onChange={(e) => {
                        const newAnswers = [...editingQuestion.answersFr];
                        newAnswers[idx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, answersFr: newAnswers });
                      }}
                      className={idx === editingQuestion.correctAnswer ? 'correct-answer' : ''}
                    />
                  ))}
                </div>
                <div className="form-group">
                  <label id="answers-nl-label">Answers (Dutch)</label>
                  {editingQuestion.answersNl.map((answer, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={answer}
                      aria-labelledby="answers-nl-label"
                      aria-label={`Dutch answer ${idx + 1}`}
                      onChange={(e) => {
                        const newAnswers = [...editingQuestion.answersNl];
                        newAnswers[idx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, answersNl: newAnswers });
                      }}
                      className={idx === editingQuestion.correctAnswer ? 'correct-answer' : ''}
                    />
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="correct-answer">Correct Answer</label>
                <select
                  id="correct-answer"
                  value={editingQuestion.correctAnswer}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, correctAnswer: Number(e.target.value) })
                  }
                  data-testid="edit-correct-answer"
                >
                  {editingQuestion.answersFr.map((_, idx) => (
                    <option key={idx} value={idx}>Answer {idx + 1}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" onClick={handleCancelEdit}>Cancel</button>
              <button className="primary-button" onClick={handleSaveEdit} data-testid="save-edit">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
