import type { LocalDatabase } from './db/sqlite.js';
import { appendEvent } from './events.js';
import { getSession, transitionSession } from './session.js';

export type SessionLanguage = 'fr-BE' | 'nl-BE';
interface LocalizedCopy { 'fr-BE': string; 'nl-BE': string }
interface QuizChoice { choice_id: string; correct: boolean }
interface CampaignQuiz { choices: QuizChoice[]; attempt_limit: number }
export interface CampaignOutcome {
  outcome_id: string;
  outcome_type: string;
  active: boolean;
  localized_label: LocalizedCopy;
  weight: number;
  inventory_cap?: number;
  daily_cap?: number;
  print_ticket: boolean;
  ticket_template_id?: string;
  bitmap_asset_id?: string;
  qr_payload_template?: string;
  cashier_instruction: LocalizedCopy;
  terms: LocalizedCopy;
}
export interface CampaignRuntimeConfig {
  campaign_short_code?: string;
  quiz?: CampaignQuiz;
  outcome_strategy?: { outcomes?: CampaignOutcome[] };
}
export interface QuizAnswerResult {
  session: ReturnType<typeof getSession>;
  correct: boolean;
  retry: boolean;
  attempts: number;
  completed_no_reward: boolean;
}
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function isSessionLanguage(value: unknown): value is SessionLanguage { return value === 'fr-BE' || value === 'nl-BE'; }
export function campaignConfigFromPayload(payload: Record<string, unknown>): CampaignRuntimeConfig { return payload as CampaignRuntimeConfig; }

export function submitQuizAnswer(db: LocalDatabase, input: { kioskId: string; sessionId: string; language: SessionLanguage; choiceId: string; campaign: CampaignRuntimeConfig }): QuizAnswerResult {
  const quiz = input.campaign.quiz;
  if (!quiz) throw new Error('active_campaign_has_no_quiz');
  const choice = quiz.choices.find((item) => item.choice_id === input.choiceId);
  if (!choice) throw new Error('quiz_choice_not_found');
  return db.transaction(() => {
    const current = getSession(db, input.sessionId);
    if (current.state !== 'playing') throw new Error(`session_not_accepting_quiz_answer:${current.state}`);
    const previousLanguage = current.session_language;
    const language = previousLanguage ?? input.language;
    const now = new Date().toISOString();
    if (previousLanguage === undefined) {
      db.prepare('UPDATE sessions SET session_language = ?, updated_at = ? WHERE session_id = ?').run(language, now, input.sessionId);
      appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'language_selected', payload: { language }, occurredAt: now });
      appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'question_shown', payload: { language }, occurredAt: now });
    }
    appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'answer_selected', payload: { language, choice_id: input.choiceId }, occurredAt: now });
    if (choice.correct) {
      db.prepare('UPDATE sessions SET quiz_passed = 1, updated_at = ? WHERE session_id = ?').run(now, input.sessionId);
      appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'answer_correct', payload: { language, choice_id: input.choiceId }, occurredAt: now });
      appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'spin_button_shown', payload: { language }, occurredAt: now });
      return { session: getSession(db, input.sessionId), correct: true, retry: false, attempts: current.quiz_attempts ?? 0, completed_no_reward: false };
    }
    const attempts = (current.quiz_attempts ?? 0) + 1;
    db.prepare('UPDATE sessions SET quiz_attempts = ?, updated_at = ? WHERE session_id = ?').run(attempts, now, input.sessionId);
    appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'answer_wrong', payload: { language, choice_id: input.choiceId, attempt: attempts }, occurredAt: now });
    if (attempts < (quiz.attempt_limit || 2)) return { session: getSession(db, input.sessionId), correct: false, retry: true, attempts, completed_no_reward: false };
    appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'question_failed_attempt_limit', payload: { language, attempts }, occurredAt: now });
    const pending = transitionSession(db, input.sessionId, 'result_pending', { resultPayload: { reward: false, reason: 'quiz_failed_attempt_limit', language, attempts } });
    appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'session_completed_no_reward', payload: { language, attempts }, occurredAt: now });
    const completed = transitionSession(db, pending.session_id, 'completed');
    transitionSession(db, completed.session_id, 'resetting');
    const idle = transitionSession(db, completed.session_id, 'idle');
    appendEvent(db, { kioskId: input.kioskId, sessionId: input.sessionId, eventType: 'session_reset', payload: { reason: 'quiz_failed_attempt_limit' }, occurredAt: now });
    return { session: idle, correct: false, retry: false, attempts, completed_no_reward: true };
  })();
}
function parsedPayload(raw: string): Record<string, unknown> { const parsed = JSON.parse(raw) as unknown; return isRecord(parsed) ? parsed : {}; }
function capReached(db: LocalDatabase, outcome: CampaignOutcome, now = new Date()): boolean {
  if (outcome.inventory_cap === undefined && outcome.daily_cap === undefined) return false;
  const rows = db.prepare("SELECT payload, occurred_at FROM events WHERE event_type = 'outcome_selected'").all() as { payload: string; occurred_at: string }[];
  const selected = rows.filter((row) => parsedPayload(row.payload).outcome_id === outcome.outcome_id);
  if (outcome.inventory_cap !== undefined && selected.length >= outcome.inventory_cap) return true;
  if (outcome.daily_cap !== undefined && selected.filter((row) => row.occurred_at.slice(0, 10) === now.toISOString().slice(0, 10)).length >= outcome.daily_cap) return true;
  return false;
}
export function selectWeightedOutcome(db: LocalDatabase, outcomes: CampaignOutcome[], random = Math.random): CampaignOutcome {
  const eligible = outcomes.filter((outcome) => outcome.active && outcome.weight > 0 && !capReached(db, outcome));
  if (eligible.length === 0) throw new Error('no_eligible_campaign_outcomes');
  let pick = random() * eligible.reduce((sum, outcome) => sum + outcome.weight, 0);
  for (const outcome of eligible) { pick -= outcome.weight; if (pick < 0) return outcome; }
  return eligible[eligible.length - 1] as CampaignOutcome;
}
export function buildTicketRenderPayload(input: { sessionId: string; language: SessionLanguage; outcome: CampaignOutcome; ticketCode?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = { session_id: input.sessionId, language: input.language, outcome_id: input.outcome.outcome_id, outcome_type: input.outcome.outcome_type, localized_label: input.outcome.localized_label[input.language], ticket_template_id: input.outcome.ticket_template_id ?? null, bitmap_asset_id: input.outcome.bitmap_asset_id ?? null, cashier_instruction: input.outcome.cashier_instruction[input.language], terms: input.outcome.terms[input.language] };
  if (input.ticketCode && input.outcome.qr_payload_template) payload.qr_payload = input.outcome.qr_payload_template.replaceAll('{{ticket_code}}', input.ticketCode);
  return payload;
}
export function printRequestPayload(ticketCode: string, renderPayload: Record<string, unknown>): Record<string, unknown> { return { endpoint: '/spin/start', ticket_code: ticketCode, render_payload: renderPayload }; }
