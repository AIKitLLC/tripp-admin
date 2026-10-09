import { validateConversationHistory, type ConversationHistory, type ModelHistoryResult, modelHistoryTurns } from './conversation';

export const CONTEXT_HISTORY_TURN_LIMITS = [4, 12, 24, 100] as const;
export const CONTEXT_HISTORY_BYTE_LIMITS = [2048, 4096, 8192, 16000] as const;
export const CONTEXT_DATA_ORDERS = ['summary_then_history', 'history_then_summary'] as const;
export interface ContextFeedingSettings {
  maxTurns: typeof CONTEXT_HISTORY_TURN_LIMITS[number];
  maxBytes: typeof CONTEXT_HISTORY_BYTE_LIMITS[number];
  includeAssistant: boolean;
  includeReadingSummary: boolean;
  dataOrder: typeof CONTEXT_DATA_ORDERS[number];
}
export interface ReadingContextOptions { instructionReserveBytes: number; history?: ContextFeedingSettings }

export function defaultContextFeedingSettings(): ContextFeedingSettings {
  return { maxTurns: 100, maxBytes: 16000, includeAssistant: true, includeReadingSummary: true, dataOrder: 'summary_then_history' };
}

/** Only bounded data selection is configurable; no strings can become instructions. */
export function validateContextFeedingSettings(value: unknown): ContextFeedingSettings | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = ['maxTurns', 'maxBytes', 'includeAssistant', 'includeReadingSummary', 'dataOrder'];
    if (Reflect.ownKeys(value).length !== keys.length || !keys.every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor?.enumerable && Object.hasOwn(descriptor, 'value');
    })) return null;
    const settings = value as Record<string, unknown>;
    if (!CONTEXT_HISTORY_TURN_LIMITS.some(limit => limit === settings.maxTurns)
      || !CONTEXT_HISTORY_BYTE_LIMITS.some(limit => limit === settings.maxBytes)
      || typeof settings.includeAssistant !== 'boolean' || typeof settings.includeReadingSummary !== 'boolean'
      || !CONTEXT_DATA_ORDERS.some(order => order === settings.dataOrder)) return null;
    // The exact own-data-property checks above make these bounded enum assertions safe.
    return { maxTurns: settings.maxTurns as ContextFeedingSettings['maxTurns'], maxBytes: settings.maxBytes as ContextFeedingSettings['maxBytes'],
      includeAssistant: settings.includeAssistant, includeReadingSummary: settings.includeReadingSummary,
      dataOrder: settings.dataOrder as ContextFeedingSettings['dataOrder'] };
  } catch { return null; }
}

export interface ContextHistorySelection {
  history: ConversationHistory;
  assistantOmittedIds: readonly string[];
  metadata: {
    storedTurnCount: number; selectedTurnCount: number; omittedTurnCount: number;
    maxTurns: ContextFeedingSettings['maxTurns']; maxBytes: ContextFeedingSettings['maxBytes'];
    assistantIncluded: boolean; readingSummaryIncluded: boolean; dataOrder: ContextFeedingSettings['dataOrder'];
  };
}

/** Select a chronological model copy. Persisted turns are never edited or evicted. */
export function selectContextHistory(history: ConversationHistory, settings: ContextFeedingSettings): ContextHistorySelection {
  const source = validateConversationHistory(history);
  if (!source) throw new Error('history_schema');
  const selected = source.turns.slice(-settings.maxTurns);
  const assistantOmittedIds = settings.includeAssistant ? [] : selected.filter(turn => turn.assistant).map(turn => turn.messageId);
  return { history: { version: 1, turns: selected.map(turn => ({ ...turn, assistant: settings.includeAssistant ? turn.assistant : '' })) },
    assistantOmittedIds, metadata: { storedTurnCount: source.turns.length, selectedTurnCount: selected.length,
      omittedTurnCount: source.turns.length - selected.length, maxTurns: settings.maxTurns, maxBytes: settings.maxBytes,
      assistantIncluded: settings.includeAssistant, readingSummaryIncluded: settings.includeReadingSummary, dataOrder: settings.dataOrder } };
}

export function serializeContextHistory(result: ModelHistoryResult, omittedIds: readonly string[] = []) {
  const omitted = new Set(omittedIds), model = modelHistoryTurns(result);
  return { ...model, turns: model.turns.map(turn => ({ ...turn, ...(omitted.has(turn.messageId) ? { assistantOmitted: true as const } : {}) })) };
}

/** Apply the configured cap to the complete serialized model history, including markers and IDs. */
export function contextHistoryBytes(history: ReturnType<typeof serializeContextHistory>): number {
  const text = JSON.stringify(history), encoder = new TextEncoder();
  return Math.max(encoder.encode(text).byteLength, encoder.encode(text.normalize('NFC')).byteLength);
}
