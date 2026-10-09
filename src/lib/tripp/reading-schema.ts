import { cardById, DECK_SIZE, type Card, type CardOrientation } from './cards';
import type { ConversationLanguage } from './conversation';
import { validateSpreadConfig, type SpreadConfig } from './spreads';

export type ReadingTopic = 'general' | 'love' | 'work' | 'money' | 'self';
export type ReadingStep = 'select_spread' | 'confirm_spread' | 'profile' | 'context' | 'ready_to_draw' | 'flipping'
  | 'ready_to_interpret' | 'interpreted' | 'extra_consent' | 'extra_flipping' | 'ready_to_extra_interpret';
export interface ReadingProfile {
  preferredName: string;
  birthDate: string;
  language: ConversationLanguage;
  dataUseAcceptedAt: number;
}
export interface KnownReadingContext { job?: string; relationshipStatus?: string }
export interface ReadingContext extends KnownReadingContext {
  question: string;
  topic: ReadingTopic;
  viewingDate?: string;
  year?: number;
}
/** Persist only trusted identifiers; display/model metadata comes from the app's catalog. */
export interface ReadingCard { id: number; orientation: CardOrientation; positionId: string; flipped: boolean }
export interface PendingExtra { reason: string; count: 1 | 2; angles: string[] }
export interface ReadingSession {
  version: 1;
  id: string;
  step: ReadingStep;
  spread: SpreadConfig | null;
  profile: ReadingProfile | null;
  knownContext: KnownReadingContext;
  context: ReadingContext | null;
  cards: ReadingCard[];
  extraCards: ReadingCard[];
  interpretation: string | null;
  summary: string;
  pendingExtra: PendingExtra | null;
  newSessionOffered: boolean;
  updatedAt: number;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LANGUAGES = ['vi', 'en', 'es', 'fr', 'ja', 'zh', 'other'];
const TOPICS = ['general', 'love', 'work', 'money', 'self'];
const STEPS: ReadingStep[] = ['select_spread', 'confirm_spread', 'profile', 'context', 'ready_to_draw', 'flipping',
  'ready_to_interpret', 'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'];
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function exact(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
  return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
}
function bounded(value: unknown, max: number, allowEmpty = false): value is string {
  return typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0)
    && Array.from(value).every(char => { const code = char.charCodeAt(0); return code >= 32 || code === 9 || code === 10 || code === 13; });
}

/** Full Gregorian dates only. No zodiac, personality or private facts are inferred. */
export function isFullDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

export function validateReadingProfile(value: unknown): ReadingProfile | null {
  if (!object(value) || !exact(value, ['preferredName', 'birthDate', 'language', 'dataUseAcceptedAt'])
    || !bounded(value.preferredName, 80) || !isFullDate(value.birthDate) || value.birthDate < '1900-01-01'
    || value.birthDate > new Date().toISOString().slice(0, 10) || !LANGUAGES.includes(String(value.language))
    || typeof value.dataUseAcceptedAt !== 'number' || !Number.isSafeInteger(value.dataUseAcceptedAt) || value.dataUseAcceptedAt < 0) return null;
  return { preferredName: value.preferredName, birthDate: value.birthDate,
    language: value.language as ConversationLanguage, dataUseAcceptedAt: value.dataUseAcceptedAt };
}

export function validateKnownContext(value: unknown): KnownReadingContext | null {
  if (!object(value) || !exact(value, [], ['job', 'relationshipStatus'])
    || (value.job !== undefined && !bounded(value.job, 300))
    || (value.relationshipStatus !== undefined && !bounded(value.relationshipStatus, 300))) return null;
  return JSON.parse(JSON.stringify(value)) as KnownReadingContext;
}

export function validateReadingContext(value: unknown): ReadingContext | null {
  if (!object(value) || !exact(value, ['question', 'topic'], ['job', 'relationshipStatus', 'viewingDate', 'year'])
    || !bounded(value.question, 600) || !TOPICS.includes(String(value.topic))
    || (value.job !== undefined && !bounded(value.job, 300))
    || (value.relationshipStatus !== undefined && !bounded(value.relationshipStatus, 300))
    || (value.viewingDate !== undefined && !isFullDate(value.viewingDate))
    || (value.year !== undefined && (!Number.isSafeInteger(value.year) || Number(value.year) < 1900 || Number(value.year) > 2200))) return null;
  return JSON.parse(JSON.stringify(value)) as ReadingContext;
}

export function emptyReadingSession(now: number, id = crypto.randomUUID()): ReadingSession {
  if (!Number.isSafeInteger(now) || now < 0 || !UUID.test(id)) throw new Error('reading_schema');
  return { version: 1, id, step: 'select_spread', spread: null, profile: null, knownContext: {}, context: null,
    cards: [], extraCards: [], interpretation: null, summary: '', pendingExtra: null, newSessionOffered: false, updatedAt: now };
}

export function displayCard(card: ReadingCard): Card & ReadingCard {
  return { ...cardById(card.id, card.orientation), positionId: card.positionId, flipped: card.flipped };
}

/** Validate persisted state before restoration; text cannot supply a spread or a card. */
export function validateReadingSession(value: unknown): ReadingSession | null {
  if (!object(value) || !exact(value, ['version', 'id', 'step', 'spread', 'profile', 'knownContext', 'context', 'cards',
    'extraCards', 'interpretation', 'summary', 'pendingExtra', 'newSessionOffered', 'updatedAt'])
    || value.version !== 1 || typeof value.id !== 'string' || !UUID.test(value.id) || !STEPS.includes(value.step as ReadingStep)
    || !Number.isSafeInteger(value.updatedAt) || Number(value.updatedAt) < 0 || typeof value.newSessionOffered !== 'boolean'
    || !bounded(value.summary, 6000, true) || (value.interpretation !== null && !bounded(value.interpretation, 12002))) return null;
  const spread = value.spread === null ? null : validateSpreadConfig(value.spread);
  const profile = value.profile === null ? null : validateReadingProfile(value.profile);
  const knownContext = validateKnownContext(value.knownContext);
  const context = value.context === null ? null : validateReadingContext(value.context);
  if ((value.spread !== null && !spread) || (value.profile !== null && !profile) || !knownContext
    || (value.context !== null && !context) || (value.step !== 'select_spread' && !spread)) return null;
  if (profile && profile.dataUseAcceptedAt > Number(value.updatedAt)) return null;
  if (!Array.isArray(value.cards) || !Array.isArray(value.extraCards) || value.extraCards.length > 2
    || value.cards.length + value.extraCards.length > DECK_SIZE) return null;
  const ids = new Set<number>();
  const positionIds = new Set<string>();
  for (const [index, card] of [...value.cards, ...value.extraCards].entries()) {
    if (!object(card) || !exact(card, ['id', 'orientation', 'positionId', 'flipped']) || !Number.isSafeInteger(card.id)
      || Number(card.id) < 0 || Number(card.id) >= DECK_SIZE || ids.has(Number(card.id))
      || !['upright', 'reversed'].includes(String(card.orientation)) || typeof card.flipped !== 'boolean'
      || typeof card.positionId !== 'string' || positionIds.has(card.positionId)) return null;
    if (index < value.cards.length ? !spread || card.positionId !== spread.positions[index]?.id : !/^extra_[1-9]\d?$/.test(card.positionId)) return null;
    ids.add(Number(card.id)); positionIds.add(card.positionId);
  }
  if (value.cards.length && (!spread || value.cards.length !== spread.count)) return null;
  if (['flipping', 'ready_to_interpret', 'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step))
    && (!spread || value.cards.length !== spread.count)) return null;
  const allMainFlipped = value.cards.length > 0 && value.cards.every(card => card.flipped);
  if ((value.interpretation !== null || ['ready_to_interpret', 'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step))) && !allMainFlipped) return null;
  if (['ready_to_draw', 'flipping', 'ready_to_interpret', 'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step)) && (!profile || !context)) return null;
  if (['ready_to_draw', 'flipping', 'ready_to_interpret', 'interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step)) && context) {
    if (spread?.id === 'love' && (context.topic !== 'love' || !context.relationshipStatus)) return null;
    if (spread?.id === 'money' && (!['work', 'money'].includes(context.topic) || !context.job)) return null;
    if (['work', 'money'].includes(context.topic) && !context.job) return null;
    if (context.topic === 'love' && !context.relationshipStatus) return null;
    if (spread?.id === 'daily' && !context.viewingDate) return null;
    if (spread?.id === 'yearly' && context.year === undefined) return null;
  }
  if (value.step === 'flipping' && (allMainFlipped || value.interpretation !== null)) return null;
  if (value.step === 'ready_to_interpret' && value.interpretation !== null) return null;
  if (value.step === 'ready_to_extra_interpret' && (!value.extraCards.length || !value.extraCards.every(card => card.flipped))) return null;
  if (value.step === 'interpreted' && !value.extraCards.every(card => card.flipped)) return null;
  if (['select_spread', 'confirm_spread', 'profile', 'context', 'ready_to_draw'].includes(String(value.step))
    && (value.cards.length || value.extraCards.length || value.interpretation !== null)) return null;
  if (value.step === 'select_spread' && spread !== null) return null;
  if (['interpreted', 'extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step)) && value.interpretation === null) return null;
  const pending = value.pendingExtra;
  if (pending !== null && (!object(pending) || !exact(pending, ['reason', 'count', 'angles']) || !bounded(pending.reason, 600)
    || (pending.count !== 1 && pending.count !== 2) || !Array.isArray(pending.angles) || pending.angles.length > 2
    || !pending.angles.every(angle => bounded(angle, 200)) || pending.angles.length > Number(pending.count)
    || (pending.count === 2 && pending.angles.length !== 2)
    || new Set(pending.angles.map(angle => String(angle).trim().normalize('NFC').toLocaleLowerCase())).size !== pending.angles.length)) return null;
  const extraStep = ['extra_consent', 'extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step));
  if (extraStep && pending === null) return null;
  if (pending !== null && !extraStep && !(value.step === 'interpreted'
    && value.extraCards.length === Number((pending as Record<string, unknown>).count) && value.extraCards.every(card => card.flipped))) return null;
  if (value.step === 'extra_consent' && value.extraCards.length) return null;
  if (value.extraCards.length && !['extra_flipping', 'ready_to_extra_interpret', 'interpreted'].includes(String(value.step))) return null;
  if (value.extraCards.length && pending === null) return null;
  if (value.step === 'extra_flipping' && value.extraCards.every(card => card.flipped)) return null;
  if (['extra_flipping', 'ready_to_extra_interpret'].includes(String(value.step))
    && value.extraCards.length !== Number((pending as Record<string, unknown>).count)) return null;
  return { ...(JSON.parse(JSON.stringify(value)) as ReadingSession), spread, profile, knownContext, context };
}

export function parseReadingSession(value: string | null | undefined): ReadingSession | null {
  try { return validateReadingSession(JSON.parse(value ?? '')); } catch { return null; }
}
