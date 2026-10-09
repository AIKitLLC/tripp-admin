import { cardById, type CardOrientation } from './cards';
import { type GroundingFact, type PrivateFactRule } from './policy';
import { inspectGeneratedText, type ReplyTextInspection } from './reply-text';
import { quickOptionsField } from './quick-options';
import { type SpreadPosition } from './spreads';
import { parseKnowledgeOutput, type KnowledgeOutputContract } from './reading-knowledge';

export type ReadingFactId = 'question' | 'job' | 'relationshipStatus';
export interface ReadingOutputContract {
  kind: 'reading';
  language: string;
  spreadId: string;
  year?: number;
  viewingDate?: string;
  facts: { id: ReadingFactId; text: string }[];
  cards: { cardId: number; positionId: string; name: string; english: string; orientation: CardOrientation; position: SpreadPosition }[];
  /** All card applications share the remaining rendered character budget. */
  limits: { keyPoint: number; applications: number; nextStep: number };
}
export type ReadingOutputRejection = 'provider_envelope' | 'malformed_json' | 'unexpected_keys' | 'invalid_reply'
  | 'invalid_proposal' | 'card_contract' | 'context_references' | 'field_bounds' | 'unsafe_text' | 'rendered_bounds'
  | 'empty' | 'length' | 'controls' | 'markup' | 'unsafe_claim' | 'unsupported_private_fact' | 'knowledge_contract' | 'metadata_claim';
export type ReplyOutputContract = ReadingOutputContract | KnowledgeOutputContract;
export type ReadingMetadataContext = Pick<ReadingOutputContract, 'cards' | 'year' | 'viewingDate'> & { allowEducationalReferences?: boolean };
interface ParsedReply { reply: string; quickOptions?: string[]; proposal: { reason: string; count: 1 | 2; angles: string[] } | null }
export type ReadingOutputPart = 'plain_reply' | 'proposal' | 'key_point' | 'card_application' | 'next_step'
  | 'knowledge_application' | 'knowledge_question' | 'combined_dynamic_text' | 'rendered_body';
export type ReadingOutputDiagnostics = { outputPart?: ReadingOutputPart; privateFactRule?: PrivateFactRule };
export type ReadingReplyParseResult = { ok: true; value: ParsedReply } | ({ ok: false; reason: ReadingOutputRejection } & ReadingOutputDiagnostics);

function rejectedText(inspected: Extract<ReplyTextInspection, { accepted: false }>, outputPart: ReadingOutputPart,
  reason: ReadingOutputRejection = inspected.reason): ReadingReplyParseResult {
  return { ok: false, reason, outputPart };
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
/** Preserve literal data; simplify only unambiguous prose Markdown markers. */
export function normalizeReadingText(value: string) {
  const text = value.replace(/\r\n?/g, '\n');
  const literal = new Uint8Array(text.length);
  // Recognize literal delimiters, including encoded examples, without decoding data.
  const tagAt = (index: number) => /^(?:<|&lt;|&#0*60;|&#x0*3c;)(\/?)([A-Za-z][A-Za-z0-9:-]*)(?=[\s/>]|&(?:gt|#0*62|#x0*3e);)(?:(?!(?:>|&gt;|&#0*62;|&#x0*3e;))[^"'<>]|"[^"]*"|'[^']*')*(?:>|&gt;|&#0*62;|&#x0*3e;)/i.exec(text.slice(index));
  const selfClosing = /\/(?:>|&gt;|&#0*62;|&#x0*3e;)$/i;
  const voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/i;
  for (let index = 0; index < text.length;) {
    let end = index;
    if (!index || text[index - 1] === '\n') {
      const fence = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/.exec(text.slice(index));
      if (fence) {
        end = text.length;
        for (let cursor = index + fence[0].length; cursor < text.length;) {
          const nextLine = text.indexOf('\n', cursor);
          const lineEnd = nextLine < 0 ? text.length : nextLine;
          const close = /^ {0,3}(`+|~+)[ \t]*$/.exec(text.slice(cursor, lineEnd));
          if (close && close[1][0] === fence[1][0] && close[1].length >= fence[1].length) {
            end = lineEnd; break;
          }
          cursor = lineEnd + 1;
        }
      }
    }
    if (end === index && text[index] === '`') {
      const run = /^`+/.exec(text.slice(index))![0];
      end = text.length;
      for (let cursor = index + run.length; cursor < text.length;) {
        const closing = text.indexOf(run, cursor);
        if (closing < 0) break;
        if (text[closing - 1] !== '`' && text[closing + run.length] !== '`') { end = closing + run.length; break; }
        cursor = closing + run.length;
      }
    }
    if (end === index && text.startsWith('<!--', index)) {
      const closing = text.indexOf('-->', index + 4);
      end = closing < 0 ? text.length : closing + 3;
    }
    if (end === index && (text[index] === '<' || text[index] === '&')) {
      const tag = tagAt(index);
      if (tag) {
        end = index + tag[0].length;
        if (!tag[1] && !voidTag.test(tag[2]) && !selfClosing.test(tag[0])) {
          let depth = 1;
          const name = tag[2].toLowerCase();
          for (let cursor = end; cursor < text.length;) {
            const nextRaw = text.indexOf('<', cursor), nextEncoded = text.indexOf('&', cursor);
            const opening = nextRaw < 0 ? nextEncoded : nextEncoded < 0 ? nextRaw : Math.min(nextRaw, nextEncoded);
            if (opening < 0) break;
            const next = tagAt(opening);
            cursor = opening + (next?.[0].length ?? 1);
            if (next && next[2].toLowerCase() === name) {
              if (next[1]) depth--;
              else if (!selfClosing.test(next[0])) depth++;
              if (!depth) { end = cursor; break; }
            }
          }
          if (depth) end = text.length;
        }
      }
    }
    if (end === index) {
      const url = /^(?:https?:\/\/|www\.)[^\s<>"'`]+/i.exec(text.slice(index));
      if (url) {
        end = index + url[0].length;
        const outerMarker = text.slice(Math.max(0, index - 2), index);
        if ((outerMarker === '**' || outerMarker === '__') && url[0].endsWith(outerMarker)) end -= 2;
      }
    }
    if (end > index) { literal.fill(1, index, end); index = end; }
    else index++;
  }
  const remove = new Uint8Array(text.length);
  const mark = (start: number, length: number) => {
    if (!literal.subarray(start, start + length).some(Boolean)) remove.fill(1, start, start + length);
  };
  for (const expression of [/^#{1,6}[ \t]+/gm, /^[*+-][ \t]+/gm])
    for (const match of text.matchAll(expression)) mark(match.index, match[0].length);
  for (const expression of [/\*\*([^*\n]+)\*\*/g, /__([^_\n]+)__/g]) {
    for (const match of text.matchAll(expression)) {
      const start = match.index, closing = start + match[0].length - 2;
      if (literal[start] || literal[start + 1] || literal[closing] || literal[closing + 1]) continue;
      if (match[0].startsWith('__') && (/[\p{L}\p{M}\p{N}_.$/%]$/u.test(text.slice(Math.max(0, start - 2), start))
        || /^[\p{L}\p{M}\p{N}_]/u.test(text.slice(closing + 2, closing + 4)))) continue;
      mark(start, 2); mark(closing, 2);
    }
  }
  return text.split('').filter((_, index) => !remove[index]).join('');
}
/** User source stays literal; display hidden controls without interpreting it. */
export function displayReadingFact(value: string) {
  return Array.from(value, character => {
    const code = character.charCodeAt(0);
    const hidden = code <= 0x1f || (code >= 0x7f && code <= 0x9f) || (code >= 0x200b && code <= 0x200f)
      || (code >= 0x202a && code <= 0x202e) || (code >= 0x2060 && code <= 0x206f) || code === 0xfeff;
    return hidden ? `\\u${code.toString(16).padStart(4, '0')}` : character;
  }).join('');
}
function boundedText(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= maximum;
}

function readingAttribution(contract: Omit<ReadingOutputContract, 'limits'>) {
  const labels = contract.language === 'vi'
    ? { question: 'Câu hỏi bạn đã chia sẻ', job: 'Công việc bạn đã chia sẻ', relationshipStatus: 'Bối cảnh tình cảm bạn đã chia sẻ' }
    : { question: 'Your stated question', job: 'Your stated work context', relationshipStatus: 'Your stated relationship context' };
  return contract.facts.map(fact => `${labels[fact.id]}: “${displayReadingFact(fact.text)}”`).join('\n');
}
function readingBody(contract: Omit<ReadingOutputContract, 'limits'>, keyPoint: string, applications: readonly string[], nextStep: string) {
  const vi = contract.language === 'vi';
  const paragraphs = contract.cards.map((card, index) => {
    const canonical = cardById(card.cardId, card.orientation);
    const position = vi ? card.position.label.vi : card.position.label.en;
    const timeframe = contract.spreadId === 'yearly' && contract.year !== undefined ? `${vi ? ' năm' : ','} ${contract.year}`
      : contract.spreadId === 'daily' && contract.viewingDate ? ` (${contract.viewingDate})` : '';
    const orientation = vi ? card.orientation === 'upright' ? 'xuôi' : 'ngược' : card.orientation;
    const meaning = vi ? canonical.meaning : canonical.meaningEnglish;
    return `${position}${timeframe} — ${vi ? canonical.name : canonical.english} (${orientation}). ${vi ? 'Biểu tượng gợi ý' : 'Symbolic lens'}: ${meaning} ${applications[index]}`;
  });
  return `${keyPoint}\n\n${paragraphs.join('\n\n')}\n\n${vi ? 'Một bước có thể thử' : 'One step to try'}: ${nextStep}`;
}
/** Reserve source text and synthesis first, then bound applications in total. */
export function createReadingOutputContract(value: Omit<ReadingOutputContract, 'limits'>): ReadingOutputContract {
  const keyPoint = value.cards.length >= 12 ? 200 : 240;
  const nextStep = value.cards.length >= 12 ? 240 : 400;
  const fixed = `${readingAttribution(value)}\n\n${readingBody(value, '', value.cards.map(() => ''), '')}`.length;
  return { ...value, limits: { keyPoint, applications: Math.max(0, 6000 - fixed - keyPoint - nextStep), nextStep } };
}

function decode(result: unknown): { ok: true; value: unknown } | { ok: false; reason: ReadingOutputRejection } {
  const value = result as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null;
  const raw = value?.response ?? value?.choices?.[0]?.message?.content;
  if (raw === undefined || raw === null) return { ok: false, reason: 'provider_envelope' };
  if (typeof raw !== 'string') return { ok: true, value: raw };
  if (raw.length > 14000) return { ok: false, reason: 'field_bounds' };
  const trimmed = raw.trim();
  const fence = /^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
  try { return { ok: true, value: JSON.parse(fence?.[1] ?? trimmed) }; }
  catch { return { ok: false, reason: 'malformed_json' }; }
}

function plainReply(data: Record<string, unknown>, allowProposal: boolean): ReadingReplyParseResult {
  if (Object.keys(data).some(key => !['reply', 'proposal', 'quick_options'].includes(key))) return { ok: false, reason: 'unexpected_keys' };
  if (!boundedText(data.reply, 6000)) return { ok: false, reason: 'invalid_reply' };
  const inspected = inspectGeneratedText(normalizeReadingText(data.reply));
  if (!inspected.accepted) return rejectedText(inspected, 'plain_reply');
  const options = quickOptionsField(data);
  if (data.proposal === undefined || data.proposal === null) return { ok: true, value: { reply: inspected.text, proposal: null, ...options } };
  if (!allowProposal || !object(data.proposal) || !exact(data.proposal, ['reason', 'count', 'angles'])) return { ok: false, reason: 'invalid_proposal' };
  const proposal = data.proposal;
  if (!boundedText(proposal.reason, 240) || (proposal.count !== 1 && proposal.count !== 2) || !Array.isArray(proposal.angles)
    || proposal.angles.length !== proposal.count || !proposal.angles.every(angle => boundedText(angle, 120))
    || new Set((proposal.angles as string[]).map(angle => normalizeReadingText(angle).trim().normalize('NFC').toLocaleLowerCase())).size !== proposal.count) return { ok: false, reason: 'invalid_proposal' };
  for (const [text, maximum] of [[proposal.reason, 240], ...(proposal.angles as string[]).map(angle => [angle, 120] as const)] as const) {
    const proposed = inspectGeneratedText(normalizeReadingText(text), maximum);
    if (!proposed.accepted) return rejectedText(proposed, 'proposal', 'invalid_proposal');
  }
  return { ok: true, value: { reply: inspected.text, proposal: { reason: normalizeReadingText(proposal.reason).trim(), count: proposal.count,
    angles: (proposal.angles as string[]).map(angle => normalizeReadingText(angle).trim()) }, ...options } };
}

function structuredReply(data: Record<string, unknown>, contract: ReadingOutputContract): ReadingReplyParseResult {
  if (!(Object.keys(data).filter(key => key !== 'quick_options').length === 3 && ['keyPoint', 'cards', 'nextStep'].every(key => Object.hasOwn(data, key)))) return { ok: false, reason: 'unexpected_keys' };
  if (!boundedText(data.keyPoint, contract.limits.keyPoint) || !boundedText(data.nextStep, contract.limits.nextStep)) return { ok: false, reason: 'field_bounds' };
  if (!Array.isArray(data.cards) || data.cards.length !== contract.cards.length || !contract.cards.length) return { ok: false, reason: 'card_contract' };
  const notes: string[] = [];
  let applicationCharacters = 0;
  for (const [index, note] of data.cards.entries()) {
    if (!object(note) || !exact(note, ['cardId', 'positionId', 'application'])
      || note.cardId !== contract.cards[index].cardId || note.positionId !== contract.cards[index].positionId) return { ok: false, reason: 'card_contract' };
    if (!boundedText(note.application, contract.limits.applications)) return { ok: false, reason: 'field_bounds' };
    applicationCharacters += note.application.length;
    if (applicationCharacters > contract.limits.applications) return { ok: false, reason: 'field_bounds' };
    const application = normalizeReadingText(note.application);
    const applied = inspectGeneratedText(application, contract.limits.applications);
    if (!applied.accepted) return rejectedText(applied, 'card_application');
    notes.push(applied.text);
  }
  const keyPoint = normalizeReadingText(data.keyPoint), nextStep = normalizeReadingText(data.nextStep);
  const keyPointInspected = inspectGeneratedText(keyPoint, contract.limits.keyPoint);
  const stepInspected = inspectGeneratedText(nextStep, contract.limits.nextStep);
  if (!keyPointInspected.accepted) return rejectedText(keyPointInspected, 'key_point');
  if (!stepInspected.accepted) return rejectedText(stepInspected, 'next_step');
  // Combined generated text must remain within technical display bounds.
  const dynamicText = `${keyPoint}\n\n${notes.join('\n\n')}\n\n${nextStep}`;
  const dynamicInspected = inspectGeneratedText(dynamicText);
  if (!dynamicInspected.accepted) return rejectedText(dynamicInspected, 'combined_dynamic_text');
  const body = readingBody(contract, keyPointInspected.text, notes, stepInspected.text);
  const reply = `${readingAttribution(contract)}\n\n${body}`;
  if (reply.length > 6000) return { ok: false, reason: 'rendered_bounds' };
  // User source is attributed data and the UI displays it with textContent.
  // Generated prose and canonical headers receive technical display validation.
  const inspected = inspectGeneratedText(body);
  if (!inspected.accepted) return rejectedText(inspected, 'rendered_body');
  return { ok: true, value: { reply, proposal: null, ...quickOptionsField(data) } };
}

export function parseReadingReplyResult(result: unknown, allowProposal: boolean, contract?: ReplyOutputContract | null,
  groundingFacts?: readonly GroundingFact[], metadata?: ReadingMetadataContext): ReadingReplyParseResult {
  const decoded = decode(result);
  if (!decoded.ok) return decoded;
  if (!object(decoded.value)) return { ok: false, reason: 'unexpected_keys' };
  // These compatibility arguments are prompt data, never content vetoes.
  void groundingFacts; void metadata;
  if (contract?.kind === 'knowledge') return parseKnowledgeOutput(decoded.value, contract, normalizeReadingText);
  return contract ? structuredReply(decoded.value, contract) : plainReply(decoded.value, allowProposal);
}

/** Compatibility for plain conversational branches; main readings pass a contract. */
export function parseReadingReply(result: unknown, allowProposal: boolean, contract?: ReplyOutputContract | null, groundingFacts?: readonly GroundingFact[], metadata?: ReadingMetadataContext) {
  const parsed = parseReadingReplyResult(result, allowProposal, contract, groundingFacts, metadata);
  return parsed.ok ? parsed.value : null;
}
