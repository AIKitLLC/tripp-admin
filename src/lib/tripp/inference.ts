import type { Card } from './cards';
import { serverChatCards } from './server-tools';
import { fitHistoryForModel, modelHistoryTurns, HISTORY_USER_CHARS, unicodeCharacterCount, conversationMessageIds, emptyConversationContext, emptyConversationHistory, type ConversationContext, type ConversationHistory } from './conversation';
import { validateReading } from './policy';
import { inspectGeneratedText } from './reply-text';
import { quickOptionsField } from './quick-options';
import { composeChatPrompt, composeLegacyPrompt } from './prompt-parts';
import { createReplySchema, replySchemaBytes } from './reply-schema';

export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8' as const;
export const MAX_OUTPUT_TOKENS = 2500;
export const MAX_PROMPT_BYTES = 28000;
export const QWEN_CONTEXT_TOKENS = 32768;
export const CHAT_TEMPLATE_TOKEN_RESERVE = 1024;
export const VERSION = '0.8.6';

function budgetMessages(messages: { role: 'system' | 'user'; content: string }[], schemaBytes = 0) {
  const text = messages.map(m => m.content).join('');
  const rawBytes = new TextEncoder().encode(text).byteLength + schemaBytes;
  const normalizedBytes = new TextEncoder().encode(text.normalize('NFC')).byteLength + schemaBytes;
  const bytes = Math.max(rawBytes, normalizedBytes);
  if (bytes > MAX_PROMPT_BYTES) throw new Error('context_budget');
  return { messages, bytes, rawBytes, normalizedBytes,
    inputTokenUpperBound: bytes + CHAT_TEMPLATE_TOKEN_RESERVE };
}

/** Two messages only: fixed instructions and bounded, explicitly untrusted data. */
export function buildChatMessages(message: string, cards: Card[], summary: string, domain: 'in_domain' | 'off_topic' = 'in_domain', language = 'vi', context: ConversationContext = emptyConversationContext(), messageId = '', continuity = 'new_subject', history: ConversationHistory = emptyConversationHistory()) {
  if (unicodeCharacterCount(message) > HISTORY_USER_CHARS || cards.length > 3) throw new Error('context_budget');
  const currentCard = cards.length ? null : context.activeReading;
  const existingReading = currentCard ? {
    sourceMessageId: currentCard.messageId,
    request: currentCard.request,
    cards: serverChatCards(currentCard.cards).map(c => {
      return { id: c.id, name: language === 'vi' ? c.name : c.english, english: c.english, orientation: c.orientation, meaning: c.meaning };
    }),
  } : null;
  const data = {
    message, messageId, routeDomain: domain, replyLanguage: language, continuity,
    cards: serverChatCards(cards).map(c => ({ id: c.id, name: language === 'vi' ? c.name : c.english, english: c.english, orientation: c.orientation, meaning: c.meaning })),
    existingReading,
    pendingRequest: context.pendingTarot?.message ?? null,
    history: modelHistoryTurns({ history: emptyConversationHistory(), compressedUserIds: [], compressedAssistantIds: [] }),
    previousSummary: history.turns.length ? '' : summary.slice(0, 600),
  };
  const prompt = composeChatPrompt(language);
  const system = prompt.text;
  const replySchema = createReplySchema();
  const schemaBytes = replySchemaBytes(replySchema);
  const inputIds = () => [...new Set([messageId, ...conversationMessageIds(context, Boolean(data.previousSummary)),
      ...data.history.turns.flatMap(turn => [turn.messageId, `${turn.messageId}:assistant`])])].filter(Boolean);
  const size = () => {
    const text = system + JSON.stringify(data) + '\n/no_think';
    return Math.max(new TextEncoder().encode(text).byteLength, new TextEncoder().encode(text.normalize('NFC')).byteLength) + schemaBytes;
  };
  const compacted = fitHistoryForModel(history, candidate => {
    data.history = modelHistoryTurns(candidate);
    const bytes = size();
    return bytes <= MAX_PROMPT_BYTES && bytes + CHAT_TEMPLATE_TOKEN_RESERVE + MAX_OUTPUT_TOKENS <= QWEN_CONTEXT_TOKENS;
  });
  data.history = modelHistoryTurns(compacted);
  const bounded = budgetMessages([
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(data) + '\n/no_think' },
  ], schemaBytes);
  if (bounded.inputTokenUpperBound + MAX_OUTPUT_TOKENS > QWEN_CONTEXT_TOKENS) throw new Error('context_budget');
  return { ...bounded, replySchema, schemaBytes, promptParts: prompt.promptParts, promptVersion: prompt.promptVersion, historyMode: compacted.compressedUserIds.length ? 'user_and_assistant_excerpts' as const
      : compacted.compressedAssistantIds.length ? 'assistant_excerpts' as const : 'full' as const,
    inputMessageIds: inputIds(), compressedUserIds: compacted.compressedUserIds,
    compressedAssistantIds: compacted.compressedAssistantIds, inputUserMessageCount: data.history.turns.length + 1 };
}

/** A generated draw must identify the actual server-selected card. */
export function identifiesDrawnCard(reply: string, cards: Card[]): boolean {
  const text = reply.normalize('NFC').toLocaleLowerCase();
  return cards.length === 0 || cards.every(card => [card.name, card.english].some(name => text.includes(name.normalize('NFC').toLocaleLowerCase())));
}

export function buildMessages(question: string, cards: Card[], summary: string) {
  const prompt = composeLegacyPrompt();
  const messages = [
    { role: 'system' as const, content: prompt.text },
    { role: 'user' as const, content: JSON.stringify({ question, cards: serverChatCards(cards).map(c => ({ name: c.name, orientation: c.orientation, meaning: c.meaning })), previousSummary: summary.slice(0, 600) }) + '\n/no_think' },
  ];
  return { ...budgetMessages(messages), promptParts: prompt.promptParts, promptVersion: prompt.promptVersion };
}

function responseContent(result: unknown): unknown {
  if (!result || typeof result !== 'object') return null;
  const obj = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] };
  // Only final answer content is read. reasoning_content is never copied.
  return obj.response ?? (Array.isArray(obj.choices) ? obj.choices[0]?.message?.content : null);
}

function parseFinalContent(result: unknown): unknown {
  const raw = responseContent(result);
  if (raw !== null && typeof raw === 'object') return raw;
  if (typeof raw !== 'string' || raw.length > 12000) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function parseChatModelResponse(result: unknown): { reply: string; quickOptions?: string[] } | null {
  const data = parseFinalContent(result);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = data as Record<string, unknown>;
  if (!Object.hasOwn(value, 'reply') || Object.keys(value).some(key => !['reply', 'quick_options'].includes(key))) return null;
  const inspected = inspectGeneratedText(value.reply);
  return inspected.accepted ? { reply: inspected.text, ...quickOptionsField(value) } : null;
}

/** Legacy advisory fixture parser; no deployed API route calls this function. */
export function parseModelResponse(result: unknown) {
  const raw = parseFinalContent(result);
  if (typeof raw === 'object') return validateReading(raw);
  return null;
}

function historyText(value: string, limit: number): string {
  // Keep extracts on one line, even when a prior summary contains a fake role prefix.
  let text = value.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  // JSON escaping also counts toward the history budget, including quotes and backslashes.
  while (JSON.stringify(text).length > limit + 2) {
    text = text.slice(0, text.length - (JSON.stringify(text).length - limit - 2));
  }
  return text;
}

/** Extractive, zero-inference history: two user messages and the latest assistant reply. */
export function summarizeChat(previous: string, message: string, reply: string, inDomain = false): string {
  let previousMessage = '';
  if (previous.length <= 600) {
    try {
      const value: unknown = JSON.parse(previous);
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const history = value as { userMessages?: unknown; assistantReply?: unknown; domain?: unknown };
        if ((Object.keys(history).length === 2 || (Object.keys(history).length === 3 && history.domain === 'in_domain')) && Object.hasOwn(history, 'userMessages')
          && Object.hasOwn(history, 'assistantReply') && typeof history.assistantReply === 'string'
          && Array.isArray(history.userMessages) && history.userMessages.length >= 1
          && history.userMessages.length <= 2 && history.userMessages.every(item => typeof item === 'string')) {
          previousMessage = history.userMessages.at(-1) as string;
        }
      }
    } catch { /* An incompatible or malformed prior summary starts a fresh extract. */ }
  }
  // Preserve the response's ending so a short answer to its closing question
  // remains interpretable, without retaining the whole assistant response.
  const answer = reply.replace(/[\r\n\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim();
  const excerpt = answer.length <= 200 ? answer : `${answer.slice(0, 96)} … ${answer.slice(-100)}`;
  return JSON.stringify({
    ...(inDomain ? { domain: 'in_domain' } : {}),
    userMessages: [historyText(previousMessage, 160), historyText(message, 160)].filter(Boolean),
    assistantReply: historyText(excerpt, 200),
  });
}

// Extractive history costs no additional inference. Only two short questions and one action survive.
export function summarize(previous: string, question: string, action: string): string {
  const previousQuestion = previous.split('\n').find(line => line.startsWith('Câu hỏi:'))?.slice(0, 170) ?? '';
  return [previousQuestion, `Câu hỏi: ${question.slice(0, 160)}`, `Bước đã gợi ý: ${action.slice(0, 160)}`].filter(Boolean).join('\n').slice(0, 600);
}
