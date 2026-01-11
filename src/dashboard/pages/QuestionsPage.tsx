// Admin Dashboard - Quiz Questions Management Page
import { useState, useEffect } from 'react';

interface Question {
  id: string;
  questionFr: string;
  questionNl: string;
  answersFr: string[];
  answersNl: string[];
  correctAnswer: number;
  active: boolean;
}

export function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

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
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive questions
        </label>
      </div>

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
              <button className="close-button" onClick={handleCancelEdit}>×</button>
            </div>
            <div className="modal-content">
              <div className="form-group">
                <label>Question ID</label>
                <input type="text" value={editingQuestion.id} disabled />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Question (French)</label>
                  <textarea
                    value={editingQuestion.questionFr}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, questionFr: e.target.value })
                    }
                    data-testid="edit-question-fr"
                  />
                </div>
                <div className="form-group">
                  <label>Question (Dutch)</label>
                  <textarea
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
                  <label>Answers (French)</label>
                  {editingQuestion.answersFr.map((answer, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={answer}
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
                  <label>Answers (Dutch)</label>
                  {editingQuestion.answersNl.map((answer, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={answer}
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
                <label>Correct Answer</label>
                <select
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
