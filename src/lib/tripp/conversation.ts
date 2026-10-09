import { quickOptionsMetadata } from './quick-options';
import type { ChatTopic } from './policy';
import { cardById, DECK_SIZE } from './cards';

export const CONVERSATION_VERSION = 1;
export const PENDING_MESSAGE_CHARS = 600;
export const PENDING_CLARIFICATION_CHARS = 6000;
export const ACTIVE_READING_REQUEST_CHARS = 1201;
export type ConversationLanguage = 'vi' | 'en' | 'es' | 'fr' | 'ja' | 'zh' | 'other';
export interface PendingTarot {
  message: string;
  clarification: string;
  messageId: string;
  assistantId: string;
  language: ConversationLanguage;
  topic: ChatTopic;
}
export interface ActiveReading {
  cards: { id: number; orientation: 'upright' | 'reversed' }[];
  request: string;
  messageId: string;
  topic: ChatTopic;
  language: ConversationLanguage;
}
export interface ConversationContext {
  version: 1;
  pendingTarot: PendingTarot | null;
  activeReading: ActiveReading | null;
  recentUserIds: string[];
  assistantId: string | null;
  wakeupOptOut: boolean;
}

export const HISTORY_TURN_LIMIT = 100;
export const HISTORY_USER_CHARS = 10000;
export const HISTORY_ASSISTANT_CHARS = 6000;
export const HISTORY_ASSISTANT_THRESHOLD_CHARS = 16000;
export const HISTORY_TERMINAL_STATUSES = ['completed', 'clarification', 'safety', 'redirect', 'unavailable'] as const;
export type HistoryTerminalStatus = typeof HISTORY_TERMINAL_STATUSES[number];
export interface HistoryTurn {
  messageId: string;
  user: string;
  assistant: string;
  terminalStatus: HistoryTerminalStatus;
  inDomain: boolean;
  quickOptions?: string[];
  quickOptionsLanguage?: string;
  quickOptionsReadingId?: string | null;
}
export interface ConversationHistory {
  version: 1;
  turns: HistoryTurn[];
}

/** Count raw Unicode code points; do not normalize or combine graphemes. */
export function unicodeCharacterCount(value: string): number {
  let count = 0;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    const next = value.charCodeAt(index + 1);
    if (code >= 0xd800 && code <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) index++;
    count++;
  }
  return count;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const LANGUAGES = ['vi', 'en', 'es', 'fr', 'ja', 'zh', 'other'];
const TOPICS = ['general', 'food', 'activity', 'love', 'work', 'self'];
function object(value: unknown, keys: string[]): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)));
}
function userId(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function assistantId(value: unknown): value is string {
  return typeof value === 'string' && value.endsWith(':assistant') && UUID.test(value.slice(0, -10));
}

export function emptyConversationContext(): ConversationContext {
  return { version: 1, pendingTarot: null, activeReading: null, recentUserIds: [], assistantId: null, wakeupOptOut: false };
}

/** Validate server-authored metadata; user text cannot create this state. */
export function validateConversationContext(value: unknown): ConversationContext | null {
  if (!object(value, ['version', 'pendingTarot', 'activeReading', 'recentUserIds', 'assistantId', 'wakeupOptOut'])
    || value.version !== 1 || typeof value.wakeupOptOut !== 'boolean'
    || !Array.isArray(value.recentUserIds) || value.recentUserIds.length > 2 || !value.recentUserIds.every(userId)
    || (value.assistantId !== null && !assistantId(value.assistantId))) return null;
  const pending = value.pendingTarot;
  if (pending !== null && (!object(pending, ['message', 'clarification', 'messageId', 'assistantId', 'language', 'topic'])
    || typeof pending.message !== 'string' || pending.message.length < 1 || pending.message.length > PENDING_MESSAGE_CHARS
    || typeof pending.clarification !== 'string' || pending.clarification.length < 1 || pending.clarification.length > PENDING_CLARIFICATION_CHARS
    || !userId(pending.messageId) || !assistantId(pending.assistantId)
    || !LANGUAGES.includes(String(pending.language)) || !TOPICS.includes(String(pending.topic)))) return null;
  const reading = value.activeReading;
  if (reading !== null && (!object(reading, ['cards', 'request', 'messageId', 'topic', 'language'])
    || typeof reading.request !== 'string' || reading.request.length < 1 || reading.request.length > ACTIVE_READING_REQUEST_CHARS
    || !userId(reading.messageId) || !LANGUAGES.includes(String(reading.language)) || !TOPICS.includes(String(reading.topic))
    || !Array.isArray(reading.cards) || reading.cards.length !== 1
    || !reading.cards.every(card => object(card, ['id', 'orientation']) && Number.isInteger(card.id)
      && Number(card.id) >= 0 && Number(card.id) < DECK_SIZE && ['upright', 'reversed'].includes(String(card.orientation))))) return null;
  return JSON.parse(JSON.stringify(value)) as ConversationContext;
}

export function parseConversationContext(value: string | undefined): ConversationContext {
  try { return validateConversationContext(JSON.parse(value ?? '')) ?? emptyConversationContext(); }
  catch { return emptyConversationContext(); }
}

export function conversationMessageIds(context: ConversationContext, summaryUsed: boolean): string[] {
  return [...new Set([
    ...(summaryUsed ? context.recentUserIds : []),
    ...(summaryUsed && context.assistantId ? [context.assistantId] : []),
    ...(context.pendingTarot ? [context.pendingTarot.messageId, context.pendingTarot.assistantId] : []),
    ...(context.activeReading ? [context.activeReading.messageId] : []),
  ])];
}

export function readingTrace(context: ConversationContext) {
  const reading = context.activeReading;
  return reading ? { cardIds: reading.cards.map(card => card.id), cardNames: reading.cards.map(card => cardById(card.id, card.orientation).name), sourceMessageId: reading.messageId, topic: reading.topic, language: reading.language } : null;
}

export function emptyConversationHistory(): ConversationHistory {
  return { version: 1, turns: [] };
}

/** History is server-authored. User strings remain verbatim untrusted data. */
export function validateConversationHistory(value: unknown): ConversationHistory | null {
  if (!object(value, ['version', 'turns']) || value.version !== 1 || !Array.isArray(value.turns)
    || value.turns.length > HISTORY_TURN_LIMIT) return null;
  const ids = new Set<string>();
  const turns: HistoryTurn[] = [];
  for (const turn of value.turns) {
    if (!turn || typeof turn !== 'object' || Array.isArray(turn)
      || !(Object.keys(turn).filter(key => !['quickOptions', 'quickOptionsLanguage', 'quickOptionsReadingId'].includes(key)).length === 5
        && ['messageId', 'user', 'assistant', 'terminalStatus', 'inDomain'].every(key => Object.hasOwn(turn, key)))
      || !userId(turn.messageId) || ids.has(turn.messageId)
      || typeof turn.user !== 'string' || turn.user.length < 1 || unicodeCharacterCount(turn.user) > HISTORY_USER_CHARS
      || typeof turn.assistant !== 'string' || turn.assistant.length > HISTORY_ASSISTANT_CHARS
      || !HISTORY_TERMINAL_STATUSES.includes(turn.terminalStatus as HistoryTerminalStatus)
      || typeof turn.inDomain !== 'boolean') return null;
    ids.add(turn.messageId);
    turns.push({ messageId: turn.messageId, user: turn.user, assistant: turn.assistant,
      terminalStatus: turn.terminalStatus as HistoryTerminalStatus, inDomain: turn.inDomain, ...quickOptionsMetadata(turn) });
  }
  return { version: 1, turns };
}

/** Append one completed admission; evict only the oldest user turn at 101. */
export function appendHistoryTurn(history: ConversationHistory, turn: HistoryTurn): ConversationHistory {
  const previous = validateConversationHistory(history);
  const next = validateConversationHistory({ version: 1, turns: [turn] });
  if (!previous || !next) throw new Error('history_schema');
  if (previous.turns.some(item => item.messageId === turn.messageId)) throw new Error('history_duplicate');
  return { version: 1, turns: [...previous.turns, next.turns[0]].slice(-HISTORY_TURN_LIMIT) };
}

function historyExcerpt(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const headLength = Math.floor((limit - 3) / 2);
  const tailLength = limit - 3 - headLength;
  let head = value.slice(0, headLength);
  let tail = value.slice(-tailLength);
  // Do not introduce lone halves of a Unicode surrogate pair at either cut.
  if (/[\uD800-\uDBFF]$/u.test(head) && /^[\uDC00-\uDFFF]/u.test(value.slice(headLength))) head = head.slice(0, -1);
  if (/^[\uDC00-\uDFFF]/u.test(tail) && /[\uD800-\uDBFF]$/u.test(value.slice(0, -tailLength))) tail = tail.slice(1);
  return `${head} … ${tail}`;
}

function beneficialHistoryExcerpt(value: string, limit: number, marker: 'userExcerpt' | 'assistantExcerpt'): string {
  const excerpt = historyExcerpt(value, limit);
  if (excerpt === value) return value;
  const encoder = new TextEncoder();
  const originalJSON = JSON.stringify(value);
  const excerptJSON = JSON.stringify(excerpt);
  const markerBytes = encoder.encode(`,"${marker}":true`).byteLength;
  // The marker and JSON escaping are transmitted too. Require savings in both
  // raw and NFC accounting so a short field cannot grow at a smaller tier.
  return encoder.encode(excerptJSON).byteLength + markerBytes < encoder.encode(originalJSON).byteLength
    && encoder.encode(excerptJSON.normalize('NFC')).byteLength + markerBytes < encoder.encode(originalJSON.normalize('NFC')).byteLength
    ? excerpt : value;
}

/** Model-only, zero-inference compaction. Persisted history is never changed. */
export function compactHistoryForModel(history: ConversationHistory, assistantExcerptChars = 320, force = false): {
  history: ConversationHistory; compressedAssistantIds: string[];
} {
  const compacted = validateConversationHistory(history);
  if (!compacted || !Number.isSafeInteger(assistantExcerptChars) || assistantExcerptChars < 4
    || assistantExcerptChars > HISTORY_ASSISTANT_CHARS || typeof force !== 'boolean') throw new Error('history_schema');
  let assistantChars = compacted.turns.reduce((total, turn) => total + turn.assistant.length, 0);
  const compressedAssistantIds: string[] = [];
  let latestAssistantIndex = -1;
  for (let index = compacted.turns.length - 1; index >= 0; index--) {
    if (compacted.turns[index].assistant) { latestAssistantIndex = index; break; }
  }
  // The latest assistant stays complete, including a 6000-character answer.
  for (let index = 0; index < compacted.turns.length; index++) {
    const turn = compacted.turns[index];
    if (index === latestAssistantIndex || (!force && assistantChars <= HISTORY_ASSISTANT_THRESHOLD_CHARS)
      || turn.assistant.length <= assistantExcerptChars) continue;
    const excerpt = beneficialHistoryExcerpt(turn.assistant, assistantExcerptChars, 'assistantExcerpt');
    if (excerpt === turn.assistant) continue;
    assistantChars -= turn.assistant.length - excerpt.length;
    turn.assistant = excerpt;
    compressedAssistantIds.push(`${turn.messageId}:assistant`);
  }
  return { history: compacted, compressedAssistantIds };
}

export interface ModelHistoryResult {
  history: ConversationHistory;
  compressedUserIds: string[];
  compressedAssistantIds: string[];
}

/** Serialize only untrusted conversation text and explicit omission markers. */
export function modelHistoryTurns(result: ModelHistoryResult) {
  const users = new Set(result.compressedUserIds);
  const assistants = new Set(result.compressedAssistantIds);
  return { version: 1 as const, turns: result.history.turns.map(turn => ({
    messageId: turn.messageId, user: turn.user, assistant: turn.assistant,
    ...(users.has(turn.messageId) ? { userExcerpt: true as const } : {}),
    ...(assistants.has(`${turn.messageId}:assistant`) ? { assistantExcerpt: true as const } : {}),
  })) };
}

/**
 * Fit a model copy against the actual complete outbound prompt. No inference,
 * persisted edits or ID eviction: omitted middles are marked, never summarized.
 * The current message is outside this helper; the latest stored user stays full.
 */
export function fitHistoryForModel(history: ConversationHistory,
  accepts: (candidate: ModelHistoryResult) => boolean): ModelHistoryResult {
  const source = validateConversationHistory(history);
  if (!source || typeof accepts !== 'function') throw new Error('history_schema');
  const normal = { ...compactHistoryForModel(source), compressedUserIds: [] };
  if (accepts(normal)) return normal;
  for (const limit of [160, 80, 32, 16, 8]) {
    const candidate = { ...compactHistoryForModel(source, limit, true), compressedUserIds: [] };
    if (accepts(candidate)) return candidate;
  }
  let latestAssistantIndex = -1;
  for (let index = source.turns.length - 1; index >= 0; index--) {
    if (source.turns[index].assistant) { latestAssistantIndex = index; break; }
  }
  const candidateFor = (userLimit: number, assistantLimit: number, latestAssistantLimit = HISTORY_ASSISTANT_CHARS): ModelHistoryResult => {
    const compressedUserIds: string[] = [];
    const compressedAssistantIds: string[] = [];
    const turns = source.turns.map((turn, index) => {
      const user = index === source.turns.length - 1 ? turn.user : beneficialHistoryExcerpt(turn.user, userLimit, 'userExcerpt');
      const assistant = beneficialHistoryExcerpt(turn.assistant, index === latestAssistantIndex ? latestAssistantLimit : assistantLimit, 'assistantExcerpt');
      if (user !== turn.user) compressedUserIds.push(turn.messageId);
      if (assistant !== turn.assistant) compressedAssistantIds.push(`${turn.messageId}:assistant`);
      return { ...turn, user, assistant };
    });
    return { history: { version: 1, turns }, compressedUserIds, compressedAssistantIds };
  };
  // Old users are excerpted only after assistant-only compression cannot fit.
  for (const userLimit of [600, 320, 160, 80, 32, 16]) {
    for (const assistantLimit of [160, 80, 32, 16, 8]) {
      const candidate = candidateFor(userLimit, assistantLimit);
      if (accepts(candidate)) return candidate;
    }
  }
  // Keep the latest actual answer complete whenever possible; it can be an
  // explicitly marked excerpt only after all older-text tiers were exhausted.
  for (const latestAssistantLimit of [512, 256, 128]) {
    const candidate = candidateFor(16, 8, latestAssistantLimit);
    if (accepts(candidate)) return candidate;
  }
  throw new Error('context_budget');
}
