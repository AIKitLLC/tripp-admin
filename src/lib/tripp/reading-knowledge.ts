import { cardById, DECK, type Card } from './cards';
import type { ReadingOutputDiagnostics, ReadingOutputPart } from './reading-output';
import { type GroundingFact } from './policy';
import { inspectGeneratedText, type ReplyTextInspection } from './reply-text';
import { quickOptionsField } from './quick-options';

export type KnowledgeGoal = 'definition' | 'applications' | 'detail';
export type KnowledgeArea = 'love' | 'work' | 'general';
export interface KnowledgeOutputContract {
  kind: 'knowledge';
  language: string;
  goal: KnowledgeGoal;
  areas: KnowledgeArea[];
  facts: string[];
  sections: { area: KnowledgeArea; label: string; card: Card }[];
  limits: { application: number; question: number };
}
type KnowledgeRejection = 'knowledge_contract' | 'field_bounds' | 'rendered_bounds' | 'empty' | 'length' | 'controls'
  | 'markup' | 'unsafe_claim' | 'unsupported_private_fact' | 'metadata_claim';
export type KnowledgeParseResult = { ok: true; value: { reply: string; proposal: null; quickOptions?: string[] } } | ({ ok: false; reason: KnowledgeRejection } & ReadingOutputDiagnostics);

function rejectedText(inspected: Extract<ReplyTextInspection, { accepted: false }>, outputPart: ReadingOutputPart): KnowledgeParseResult {
  return { ok: false, reason: inspected.reason, outputPart };
}

/** Small authoritative app reference, not retrieved personal data or a new service. */
export function createKnowledgeOutputContract(language: string, goal: string, areas: string): KnowledgeOutputContract {
  if (!['definition', 'applications', 'detail'].includes(goal) || !['love', 'work', 'both', 'general'].includes(areas)) throw new Error('knowledge_contract');
  const vi = language === 'vi';
  const major = DECK.filter(card => card.arcana === 'major').length;
  const minor = DECK.length - major;
  const facts = [vi
    ? 'Tarot dùng các biểu tượng để đặt câu hỏi, nhìn lại cảm xúc và cân nhắc lựa chọn. Ý nghĩa lá bài không xác nhận chuyện riêng của người khác hay quyết định tương lai.'
    : 'Tarot uses symbols to ask questions, reflect on feelings and consider choices. A card meaning does not establish another person’s private facts or determine the future.'];
  if (goal === 'definition' || goal === 'detail') facts.push(vi
    ? `Bộ bài trong demo có ${DECK.length} lá: ${major} lá Ẩn chính và ${minor} lá Ẩn phụ. Các bộ Gậy, Cốc, Kiếm và Tiền có 14 lá mỗi bộ.`
    : `The demo deck contains ${DECK.length} cards: ${major} Major Arcana and ${minor} Minor Arcana. Wands, Cups, Swords and Pentacles each have 14 cards.`);
  if (goal === 'detail') facts.push(vi
    ? 'Một biểu tượng có thể gợi các câu hỏi khác nhau tùy bối cảnh đã được kể và vị trí trong trải bài. Hướng ngược là một góc nhìn khác, không tự đồng nghĩa với điều xấu. Khi thực hành, phân biệt dữ kiện đang có, điều chưa biết và một việc nhỏ mình có thể thử.'
    : 'A symbol can suggest different questions depending on the stated context and its spread position. Reversal offers another lens rather than automatically meaning something bad. Distinguish known facts, unknowns and a small action you can try.');
  const selected: KnowledgeArea[] = areas === 'both' ? ['love', 'work'] : [areas as KnowledgeArea];
  const labels = vi ? { love: 'Tình cảm', work: 'Công việc', general: 'Tự suy ngẫm' }
    : { love: 'Relationships', work: 'Work', general: 'Self-reflection' };
  const exampleIds = { love: 6, work: 71, general: 0 };
  return { kind: 'knowledge', language, goal: goal as KnowledgeGoal, areas: selected, facts,
    sections: selected.map(area => ({ area, label: labels[area], card: cardById(exampleIds[area], 'upright') })),
    limits: { application: goal === 'detail' ? 800 : 500, question: 240 } };
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function exact(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function bounded(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= maximum;
}

export function parseKnowledgeOutput(data: Record<string, unknown>, contract: KnowledgeOutputContract,
  normalizeText: (text: string) => string, groundingFacts: readonly GroundingFact[] = [], metadataClaim?: (text: string, card: Card) => boolean): KnowledgeParseResult {
  void groundingFacts; void metadataClaim;
  if (!(Object.keys(data).filter(key => key !== 'quick_options').length === 1 && ['sections'].every(key => Object.hasOwn(data, key))) || !Array.isArray(data.sections) || data.sections.length !== contract.sections.length) return { ok: false, reason: 'knowledge_contract' };
  const sections: string[] = [];
  const dynamic: string[] = [];
  const vi = contract.language === 'vi';
  for (const [index, section] of data.sections.entries()) {
    const expected = contract.sections[index];
    if (!object(section) || !exact(section, ['area', 'application', 'question']) || section.area !== expected.area) return { ok: false, reason: 'knowledge_contract' };
    if (!bounded(section.application, contract.limits.application) || !bounded(section.question, contract.limits.question)) return { ok: false, reason: 'field_bounds' };
    const application = normalizeText(section.application), question = normalizeText(section.question);
    const applied = inspectGeneratedText(application, contract.limits.application);
    const asked = inspectGeneratedText(question, contract.limits.question);
    if (!applied.accepted) return rejectedText(applied, 'knowledge_application');
    if (!asked.accepted) return rejectedText(asked, 'knowledge_question');
    dynamic.push(applied.text, asked.text);
    const card = expected.card;
    sections.push(`${expected.label} — ${vi ? 'ví dụ giả định' : 'hypothetical example'}: ${vi ? card.name : card.english} (${vi ? 'xuôi' : 'upright'}). ${vi ? 'Biểu tượng gợi ý' : 'Symbolic lens'}: ${vi ? card.meaning : card.meaningEnglish}\n${applied.text}\n${vi ? 'Câu hỏi có thể tự đặt' : 'A question to consider'}: ${asked.text}`);
  }
  const inspected = inspectGeneratedText(dynamic.join('\n\n'));
  if (!inspected.accepted) return rejectedText(inspected, 'combined_dynamic_text');
  const source = `${contract.facts.join('\n\n')}\n\n${vi ? 'Các ví dụ dưới đây để học cách suy ngẫm; ứng dụng chưa rút bài cho bạn.' : 'These examples show reflective practice; the app has not drawn personal cards for you.'}`;
  const reply = `${source}\n\n${sections.join('\n\n')}`;
  if (reply.length > 6000) return { ok: false, reason: 'rendered_bounds' };
  const safe = inspectGeneratedText(reply);
  if (!safe.accepted) return rejectedText(safe, 'rendered_body');
  return { ok: true, value: { reply: safe.text, proposal: null, ...quickOptionsField(data) } };
}
