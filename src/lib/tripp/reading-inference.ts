import { composeReadingPrompt } from './prompt-parts';
import type { Card } from './cards';
import { serverReadingCards } from './server-tools';
import { fitHistoryForModel, type ConversationHistory } from './conversation';
import { contextHistoryBytes, selectContextHistory, serializeContextHistory, validateContextFeedingSettings,
  type ReadingContextOptions } from './context-feeding';
import { CHAT_TEMPLATE_TOKEN_RESERVE, MAX_OUTPUT_TOKENS, MAX_PROMPT_BYTES, QWEN_CONTEXT_TOKENS } from './inference';
import type { ReadingSession } from './reading-schema';
import type { ReadingSemanticDecision } from './reading-decision';
import { getSpreadConfig } from './spreads';
import { createReadingOutputContract, type ReadingOutputContract, type ReadingFactId, type ReplyOutputContract } from './reading-output';
import { createKnowledgeOutputContract } from './reading-knowledge';
import { createReplySchema, replySchemaBytes } from './reply-schema';
export { parseReadingReply, parseReadingReplyResult } from './reading-output';

export function buildReadingMessages(message: string, reading: ReadingSession, history: ConversationHistory, branch: string,
  semantic?: ReadingSemanticDecision, contextOptions?: ReadingContextOptions) {
  const instructionReserveBytes = contextOptions === undefined ? 0 : contextOptions.instructionReserveBytes;
  if (!Number.isSafeInteger(instructionReserveBytes) || instructionReserveBytes < 0 || instructionReserveBytes > MAX_PROMPT_BYTES) throw new Error('context_budget');
  const feeding = contextOptions?.history === undefined ? undefined : validateContextFeedingSettings(contextOptions.history);
  if (feeding === null) throw new Error('invalid_context_feeding');
  const selection = feeding ? selectContextHistory(history, feeding) : undefined;
  const selectedHistory = selection?.history ?? history;
  const main = branch === 'interpret' || branch === 'extra_interpret';
  const conversation = branch === 'conversation' || branch === 'budget_probe_established';
  const focus = ['conversation', 'budget_probe_established', 'budget_probe_followup', 'practical', 'clarify_reading', 'emotional_support', 'new_topic'].includes(branch)
    || branch === 'knowledge' && semantic?.knowledgeGoal === 'practical';
  // Point at existing history instead of copying the prior answer into another
  // prominent payload field. A pending current user may have no answer yet.
  let previousAnswerMessageId: string | null = null;
  if (focus) for (let index = selectedHistory.turns.length - 1; index >= 0; index--) {
    if (selectedHistory.turns[index].assistant) { previousAnswerMessageId = selectedHistory.turns[index].messageId; break; }
  }
  if (main && (!reading.cards.length || !reading.cards.every(card => card.flipped) || !reading.extraCards.every(card => card.flipped))) throw new Error('all_cards_must_be_flipped');
  const language = semantic?.language && semantic.language !== 'other' ? semantic.language : reading.profile?.language ?? 'vi';
  const { mainCards, extraCards } = serverReadingCards(reading);
  const contractCards = [...mainCards, ...extraCards];
  const facts: ReadingOutputContract['facts'] = [];
  for (const id of ['question', 'job', 'relationshipStatus'] as ReadingFactId[]) {
    const text = reading.context?.[id];
    if (text) facts.push({ id, text });
  }
  const structured = main || (branch === 'budget_probe' && contractCards.length > 0 && reading.cards.every(card => card.flipped) && reading.extraCards.every(card => card.flipped));
  const readingContract: ReadingOutputContract | null = structured ? createReadingOutputContract({
    kind: 'reading', language, spreadId: reading.spread?.id ?? '',
    ...(reading.context?.year === undefined ? {} : { year: reading.context.year }),
    ...(reading.context?.viewingDate ? { viewingDate: reading.context.viewingDate } : {}), facts,
    cards: contractCards.map(card => ({ cardId: card.id, positionId: card.positionId, name: card.name, english: card.english,
      orientation: card.orientation, position: card.position })),
  }) : null;
  if (readingContract && readingContract.limits.applications < readingContract.cards.length) throw new Error('context_budget');
  // Vietnamese source strings are the largest encoded reference variant.
  const knowledgeContract = ['budget_probe', 'budget_probe_followup'].includes(branch) ? createKnowledgeOutputContract('vi', 'detail', 'both')
    : branch === 'knowledge' && semantic?.knowledgeGoal !== 'practical'
      ? createKnowledgeOutputContract(language, semantic?.knowledgeGoal ?? '', semantic?.knowledgeAreas ?? '') : null;
  const outputContract: ReplyOutputContract | null = readingContract ?? knowledgeContract;
  const replySchema = createReplySchema(outputContract, branch === 'supplement' || branch === 'budget_probe_supplement');
  const schemaBytes = replySchemaBytes(replySchema);
  // Display metadata remains in the trusted return value. Structured generation
  // needs only each theme and its position, not names or personal identifiers.
  const actionCards = (items: typeof mainCards) => items.map(card => ({ id: card.id, positionId: card.positionId, orientation: card.orientation,
    theme: language === 'vi' ? card.meaning : card.meaningEnglish,
    position: { id: card.position.id, label: language === 'vi' ? card.position.label.vi : card.position.label.en,
      meaning: language === 'vi' ? card.position.meaning.vi : card.position.meaning.en } }));
  // Ordinary chat needs exact card identity, orientation and the current-language
  // theme/position. Display artwork and duplicate language descriptions stay in
  // trusted server metadata. Revealed positions already live with their cards.
  const conversationCards = (items: typeof mainCards) => items.map(card => ({ id: card.id, name: card.name,
    english: card.english, orientation: card.orientation, positionId: card.positionId,
    meaning: language === 'vi' ? card.meaning : card.meaningEnglish,
    position: { id: card.position.id, label: language === 'vi' ? card.position.label.vi : card.position.label.en,
      meaning: language === 'vi' ? card.position.meaning.vi : card.position.meaning.en } }));
  const conversationSpread = reading.spread ? { id: reading.spread.id, count: reading.spread.count,
    name: language === 'vi' ? reading.spread.name.vi : reading.spread.name.en,
    description: language === 'vi' ? reading.spread.description.vi : reading.spread.description.en,
    ...(mainCards.length ? {} : { positions: reading.spread.positions.map(position => ({ id: position.id,
      label: language === 'vi' ? position.label.vi : position.label.en,
      meaning: language === 'vi' ? position.meaning.vi : position.meaning.en })) }) } : null;
  const data = { branch: branch === 'budget_probe_established' ? 'conversation' : branch, replyLanguage: language, state: reading.step,
    profile: reading.profile ? { language: reading.profile.language } : null,
    context: reading.context, mainQuestion: reading.context?.question ?? null,
    spread: main && reading.spread ? { id: reading.spread.id, count: reading.spread.count } : conversation ? conversationSpread : reading.spread,
    suggestedSpread: branch === 'budget_probe' ? getSpreadConfig('yearly')
      : ['suggest_spread', 'new_reading_offer'].includes(branch) && semantic?.intent === 'suggest_spread' && semantic.spread !== 'none' ? getSpreadConfig(semantic.spread) : null,
    cards: main ? actionCards(mainCards) : conversation ? conversationCards(mainCards) : mainCards,
    extraCards: main ? actionCards(extraCards) : conversation ? conversationCards(extraCards) : extraCards,
    // Canonical details already live in cards/spread/context. The generation
    // contract carries identifiers and limits, not a duplicate catalog.
    outputContract: outputContract?.kind === 'reading' ? { kind: outputContract.kind, language: outputContract.language, spreadId: outputContract.spreadId,
      ...(outputContract.year === undefined ? {} : { year: outputContract.year }),
      ...(outputContract.viewingDate ? { viewingDate: outputContract.viewingDate } : {}),
      cards: outputContract.cards.map(card => ({ cardId: card.cardId, positionId: card.positionId })), limits: outputContract.limits }
      : outputContract ? { kind: outputContract.kind, language: outputContract.language, goal: outputContract.goal, areas: outputContract.areas,
        sections: outputContract.sections.map(section => ({ area: section.area })), limits: outputContract.limits } : null,
    knowledgeReference: knowledgeContract ? { facts: knowledgeContract.facts, sections: knowledgeContract.sections.map(section => ({
      area: section.area, theme: knowledgeContract.language === 'vi' ? section.card.meaning : section.card.meaningEnglish,
    })) } : null,
    priorReading: reading.interpretation ? { summary: reading.summary || reading.interpretation.slice(0, 600), extractive: true, fullReadingStored: true } : null,
    // Send the extractive reading summary once. The stored summary, complete
    // interpretation and full persisted conversation remain untouched.
    ...(reading.interpretation ? {} : { summary: reading.summary }), pendingExtra: reading.pendingExtra,
    ...(previousAnswerMessageId ? { replyFocus: { previousAnswerMessageId } } : {}),
    semantic, history: serializeContextHistory({ history: { version: 1, turns: [] }, compressedUserIds: [], compressedAssistantIds: [] }),
    // Keep current input after background and history in the actual payload.
    message };
  const { priorReading, summary, history: emptyHistory, message: currentMessage, ...background } = data;
  const summaryData = feeding?.includeReadingSummary ? { priorReading, ...(!reading.interpretation ? { summary } : {}) } : {};
  // Configurable order applies to untrusted summary/history only; the current input stays last.
  const payload = feeding && selection ? { ...background, contextFeeding: { ...selection.metadata,
      omissions: { olderTurns: selection.metadata.omittedTurnCount > 0, assistantText: selection.assistantOmittedIds.length > 0,
        readingSummary: !feeding.includeReadingSummary && Boolean(reading.interpretation || reading.summary) } },
    ...(feeding.dataOrder === 'summary_then_history' ? { ...summaryData, history: emptyHistory } : { history: emptyHistory, ...summaryData }),
    message: currentMessage } : data;
  const promptBranch = branch === 'knowledge' && semantic?.knowledgeGoal === 'practical' ? 'practical' : branch;
  const prompt = composeReadingPrompt(language, promptBranch);
  const system = prompt.text;
  const size = () => { const text = system + JSON.stringify(payload) + '\n/no_think';
    return Math.max(new TextEncoder().encode(text).byteLength, new TextEncoder().encode(text.normalize('NFC')).byteLength) + schemaBytes; };
  const fitted = fitHistoryForModel(selectedHistory, candidate => {
    payload.history = serializeContextHistory(candidate, selection?.assistantOmittedIds);
    const bytes = size() + instructionReserveBytes;
    return (!feeding || contextHistoryBytes(payload.history) <= feeding.maxBytes)
      && bytes <= MAX_PROMPT_BYTES && bytes + CHAT_TEMPLATE_TOKEN_RESERVE + MAX_OUTPUT_TOKENS <= QWEN_CONTEXT_TOKENS;
  });
  payload.history = serializeContextHistory(fitted, selection?.assistantOmittedIds);
  return { messages: [{ role: 'system' as const, content: system }, { role: 'user' as const, content: JSON.stringify(payload) + '\n/no_think' }],
    bytes: size(), instructionReserveBytes, inputTokenUpperBound: size() + instructionReserveBytes + CHAT_TEMPLATE_TOKEN_RESERVE,
    compressedUserIds: fitted.compressedUserIds, compressedAssistantIds: fitted.compressedAssistantIds,
    historyMode: fitted.compressedUserIds.length ? 'user_and_assistant_excerpts' as const : fitted.compressedAssistantIds.length ? 'assistant_excerpts' as const : 'full' as const,
    cards: [...mainCards, ...extraCards] as Card[], outputContract, replySchema, schemaBytes, promptParts: prompt.promptParts, promptVersion: prompt.promptVersion,
    readingMetadata: { allowEducationalReferences: !main, cards: contractCards.map(card => ({ cardId: card.id, positionId: card.positionId, name: card.name, english: card.english,
      orientation: card.orientation, position: card.position })),
      ...(reading.context?.year === undefined ? {} : { year: reading.context.year }),
      ...(reading.context?.viewingDate ? { viewingDate: reading.context.viewingDate } : {}) },
    groundingFacts: [...facts, { id: 'current_message', text: message }, ...history.turns.map(turn => ({ id: `user:${turn.messageId}`, text: turn.user }))] };
}
