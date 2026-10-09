import { cardById, drawCards } from './cards';
import { getSpreadConfig, snapshotSpread } from './spreads';
import { validateReadingSession, type ReadingSession } from './reading-schema';
import { MAX_ESTABLISHED_MESSAGE_CHARS } from './policy';
import { unicodeCharacterCount } from './conversation';

export const READING_ACTIONS = ['suggest_spread', 'select_spread', 'confirm_spread', 'save_profile', 'set_language', 'save_context', 'draw', 'flip', 'interpret', 'followup', 'propose_extra', 'consent_extra', 'start_new', 'reset'] as const;
export type ReadingAction = typeof READING_ACTIONS[number];
export interface ReadingCommand { requestId: string; action: ReadingAction; payload: Record<string, unknown>; retry?: boolean }
export const READING_LANGUAGES = ['vi', 'en', 'es', 'fr', 'ja', 'zh', 'other'] as const;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOPICS = ['general', 'love', 'work', 'money', 'self'];

export function validateReadingCommand(value: unknown): ReadingCommand {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_command');
  const command = value as Record<string, unknown>;
  if (!UUID.test(String(command.requestId)) || !READING_ACTIONS.includes(command.action as ReadingAction)
    || !command.payload || typeof command.payload !== 'object' || Array.isArray(command.payload)
    || (command.retry !== undefined && typeof command.retry !== 'boolean')
    || Object.keys(command).some(key => !['requestId', 'action', 'payload', 'retry'].includes(key))) throw new Error('invalid_command');
  return command as unknown as ReadingCommand;
}

export function emptyReading(now: number, profile: ReadingSession['profile'] = null, knownContext: ReadingSession['knownContext'] = {}): ReadingSession {
  return { version: 1, id: crypto.randomUUID(), step: 'select_spread', spread: null, profile, context: null,
    cards: [], extraCards: [], interpretation: null, summary: '', pendingExtra: null, newSessionOffered: false, knownContext, updatedAt: now };
}

export function isModelAction(action: ReadingAction): boolean {
  return ['suggest_spread', 'save_context', 'interpret', 'followup', 'propose_extra'].includes(action);
}

/** Conversation readiness comes from confirmed app state, never a text heuristic. */
export function hasEstablishedReadingContext(reading: Pick<ReadingSession, 'profile' | 'context' | 'step'>): boolean {
  return Boolean(reading.profile && reading.context && ['ready_to_draw', 'flipping', 'ready_to_interpret',
    'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(reading.step));
}

export function actionUserMessage(command: ReadingCommand, reading: ReadingSession): string {
  if (command.action === 'suggest_spread' || command.action === 'followup') return boundedText(command.payload.message, command.action === 'followup' ? MAX_ESTABLISHED_MESSAGE_CHARS : 600, 'invalid_message', command.action === 'followup');
  if (command.action === 'propose_extra') return JSON.stringify(command.payload);
  return reading.context?.question ?? '';
}

function boundedText(value: unknown, limit: number, reason: string, codePoints = false): string {
  // eslint-disable-next-line no-control-regex -- reject JSON control characters in user data.
  if (typeof value !== 'string' || !value.trim() || (codePoints ? unicodeCharacterCount(value) : value.length) > limit || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) throw new Error(reason);
  return value;
}
function exactPayload(payload: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(payload).some(key => !allowed.includes(key))) throw new Error('invalid_payload');
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Authoritative transition. No model or draw happens on an invalid transition. */
export function applyReadingAction(current: ReadingSession, command: ReadingCommand, now: number): ReadingSession {
  const checked = validateReadingSession(current);
  if (!checked) throw new Error('invalid_reading');
  const next: ReadingSession = structuredClone(checked);
  const payload = command.payload;
  switch (command.action) {
    case 'reset': exactPayload(payload, []); return emptyReading(now);
    case 'start_new': exactPayload(payload, []); return emptyReading(now, next.profile, next.knownContext);
    case 'select_spread': {
      exactPayload(payload, ['spreadId']);
      if (!['select_spread', 'confirm_spread', 'profile', 'context', 'ready_to_draw'].includes(next.step) || next.cards.length) throw new Error('new_session_required');
      const config = getSpreadConfig(String(payload.spreadId));
      if (!config) throw new Error('invalid_spread');
      next.spread = snapshotSpread(config); next.step = 'confirm_spread';
      next.pendingExtra = null; break;
    }
    case 'confirm_spread':
      exactPayload(payload, []);
      if (next.step !== 'confirm_spread' || !next.spread) throw new Error('invalid_step');
      next.step = next.profile ? 'context' : 'profile'; break;
    case 'save_profile': {
      exactPayload(payload, ['preferredName', 'birthDate', 'language', 'dataUseAccepted']);
      if (next.step !== 'profile' || !next.spread) throw new Error('invalid_step');
      const preferredName = boundedText(payload.preferredName, 80, 'invalid_name');
      const today = new Date(now).toISOString().slice(0, 10);
      if (!validDate(payload.birthDate) || payload.birthDate > today || payload.birthDate < '1900-01-01') throw new Error('invalid_birth_date');
      if (!READING_LANGUAGES.includes(payload.language as typeof READING_LANGUAGES[number]) || payload.dataUseAccepted !== true) throw new Error('data_use_consent_required');
      next.profile = { preferredName, birthDate: payload.birthDate, language: payload.language as typeof READING_LANGUAGES[number], dataUseAcceptedAt: now };
      next.step = 'context'; break;
    }
    case 'set_language':
      exactPayload(payload, ['language']);
      if (!next.profile || !READING_LANGUAGES.includes(payload.language as typeof READING_LANGUAGES[number])) throw new Error('invalid_language');
      next.profile.language = payload.language as typeof next.profile.language; break;
    case 'save_context': {
      exactPayload(payload, ['question', 'topic', 'job', 'relationshipStatus', 'viewingDate', 'year']);
      if (next.step !== 'context' || !next.spread || !next.profile) throw new Error('invalid_step');
      const topic = payload.topic ?? (next.spread.id === 'love' ? 'love' : next.spread.id === 'money' ? 'money' : 'general');
      if (!TOPICS.includes(String(topic))) throw new Error('invalid_topic');
      if ((next.spread.id === 'love' && topic !== 'love') || (next.spread.id === 'money' && !['work', 'money'].includes(String(topic)))) throw new Error('invalid_topic_for_spread');
      const language = next.profile.language;
      const defaultDaily = language === 'vi' ? 'Hôm nay mình có thể chăm sóc bản thân và chọn một bước nhỏ như thế nào?' : 'What can I reflect on and take one small step toward today?';
      const question = next.spread.id === 'daily' && (payload.question === undefined || payload.question === '') ? defaultDaily : boundedText(payload.question, 600, 'question_required');
      const context: NonNullable<ReadingSession['context']> = { question, topic: topic as NonNullable<ReadingSession['context']>['topic'] };
      if (['work', 'money'].includes(String(topic))) context.job = boundedText(payload.job ?? next.knownContext.job, 200, 'job_required');
      if (topic === 'love') context.relationshipStatus = boundedText(payload.relationshipStatus ?? next.knownContext.relationshipStatus, 200, 'relationship_status_required');
      if (next.spread.id === 'daily') {
        if (!validDate(payload.viewingDate)) throw new Error('viewing_date_required');
        // Viewing date is supplied by the client local calendar, never derived from DOB.
        const delta = Math.abs(new Date(`${payload.viewingDate}T00:00:00Z`).getTime() - now);
        if (delta > 36 * 3600000) throw new Error('invalid_viewing_date');
        context.viewingDate = payload.viewingDate;
      }
      if (next.spread.id === 'yearly') {
        if (!Number.isInteger(payload.year) || Number(payload.year) < 1900 || Number(payload.year) > 2200) throw new Error('year_required');
        context.year = Number(payload.year);
      }
      next.context = context; next.knownContext = { ...next.knownContext, ...(context.job ? { job: context.job } : {}), ...(context.relationshipStatus ? { relationshipStatus: context.relationshipStatus } : {}) }; next.step = 'ready_to_draw'; break;
    }
    case 'draw':
      exactPayload(payload, []);
      if (next.step !== 'ready_to_draw' || !next.spread || !next.context || !next.profile) throw new Error('invalid_step');
      next.cards = drawCards(next.spread.positions.length).map((card, index) => ({ id: card.id, orientation: card.orientation, positionId: next.spread!.positions[index].id, flipped: false }));
      next.step = 'flipping'; break;
    case 'flip': {
      exactPayload(payload, ['index', 'extra']);
      const extra = payload.extra === true;
      if (payload.extra !== undefined && typeof payload.extra !== 'boolean') throw new Error('invalid_flip');
      const cards = extra ? next.extraCards : next.cards;
      if (!Number.isInteger(payload.index) || Number(payload.index) < 0 || Number(payload.index) >= cards.length) throw new Error('invalid_flip');
      if (cards[Number(payload.index)].flipped) break;
      if (next.step !== (extra ? 'extra_flipping' : 'flipping')) throw new Error('invalid_step');
      cards[Number(payload.index)].flipped = true;
      if (cards.every(card => card.flipped)) next.step = extra ? 'ready_to_extra_interpret' : 'ready_to_interpret';
      break;
    }
    case 'interpret':
      exactPayload(payload, []);
      if (!['ready_to_interpret', 'ready_to_extra_interpret'].includes(next.step)
        || !next.cards.length || !next.cards.every(card => card.flipped)
        || !next.extraCards.every(card => card.flipped)) throw new Error('all_cards_must_be_flipped');
      break;
    case 'suggest_spread':
      exactPayload(payload, ['message']); boundedText(payload.message, 600, 'invalid_message');
      if (next.cards.length || !['select_spread', 'confirm_spread', 'profile', 'context'].includes(next.step)) throw new Error('new_session_required');
      break;
    case 'followup':
      exactPayload(payload, ['message']); boundedText(payload.message, MAX_ESTABLISHED_MESSAGE_CHARS, 'invalid_message', true);
      if (!hasEstablishedReadingContext(next)) throw new Error('reading_not_complete');
      break;
    case 'propose_extra': {
      exactPayload(payload, ['reason', 'count', 'angles']);
      if (next.step !== 'interpreted' || !next.interpretation || next.extraCards.length) throw new Error('extra_not_available');
      const reason = boundedText(payload.reason, 240, 'extra_reason_required');
      if (payload.count !== 1 && payload.count !== 2) throw new Error('invalid_extra_count');
      const angles = payload.angles ?? [];
      if (!Array.isArray(angles) || angles.length > 2 || !angles.every(angle => typeof angle === 'string' && angle.trim() && angle.length <= 120)
        || (payload.count === 2 && (angles.length !== 2 || angles[0].trim() === angles[1].trim()))) throw new Error('two_angles_required');
      next.pendingExtra = { reason, count: payload.count, angles: angles as string[] };
      next.step = 'extra_consent'; break;
    }
    case 'consent_extra':
      exactPayload(payload, ['accept']);
      if (next.step !== 'extra_consent' || !next.pendingExtra || typeof payload.accept !== 'boolean') throw new Error('invalid_step');
      if (payload.accept) {
        next.extraCards = drawCards(next.pendingExtra.count, next.cards.map(card => card.id)).map((card, index) => ({ id: card.id, orientation: card.orientation, positionId: `extra_${index + 1}`, flipped: false }));
        next.step = 'extra_flipping';
      } else { next.step = 'interpreted'; next.pendingExtra = null; }
      break;
  }
  next.updatedAt = now;
  if (!validateReadingSession(next)) throw new Error('invalid_transition');
  return next;
}

/** Do not leak face-down identities or symbols through API JSON. */
export function publicReading(reading: ReadingSession | null) {
  if (!reading) return null;
  const reveal = (cards: ReadingSession['cards']) => cards.map((card, index) => card.flipped
    ? { ...cardById(card.id, card.orientation), revealedCard: cardById(card.id, card.orientation), index, positionId: card.positionId, flipped: true }
    : { index, positionId: card.positionId, flipped: false, revealedCard: null });
  return { ...reading, cards: reveal(reading.cards), extraCards: reveal(reading.extraCards) };
}
