/**
 * Deterministic preflight and legacy Tarot policy fixtures for this demo.
 * This is a keyword policy, not a comprehensive classifier or an LLM judge.
 * It can miss euphemisms, mixed languages, adversarial paraphrases and implied
 * intent, and it can redirect harmless wording. Keep model instructions,
 * output validation, abuse limits and professional-support routing as layers.
 */
import { unicodeCharacterCount } from './conversation';

export const POLICY_VERSION = 'tripp-chat-v13';
export const MAX_QUESTION_CHARS = 600;
export const MAX_ESTABLISHED_MESSAGE_CHARS = 10000;

export type Decision = {
  verdict: 'pass' | 'redirect' | 'block';
  reason: string;
  policyVersion: string;
};
export type Payload = {
  question: string;
  spread: 'one' | 'three';
  topic: 'general' | 'love' | 'work' | 'self';
  followup: boolean;
};
export type Reading = { reflection: string; action: string; question: string };
export const SUGGESTION_COOLDOWN_MS = 10 * 60 * 1000;
export type SuggestionContext = {
  topic: string | null;
  hasReading: boolean;
  active: boolean;
  lastSuggestedAt: number;
  now: number;
  quotaAvailable: boolean;
  trigger: 'tick' | 'preview';
};
export type SuggestionDecision = Decision & {
  action: 'show_template' | 'skip';
  inference: false;
  templateId?: string;
};
export type SuggestionTemplate = { title: string; body: string; question: string };
export type ChatTopic = 'general' | 'food' | 'activity' | 'love' | 'work' | 'self';
export type ChatPayload = { message: string };
export type ChatReply = { reply: string };
export type ChatDecision = Decision & {
  action: 'template' | 'skip' | 'chat' | 'tool';
  topic: ChatTopic;
  /** Intended execution route; decision-only endpoints do not perform it. */
  inference: boolean;
  templateMessage?: string;
};
export type WakeupContext = {
  topic: string | null;
  hasContext: boolean;
  active: boolean;
  lastSuggestedAt: number;
  now: number;
  quotaAvailable: boolean;
  trigger: 'tick' | 'preview';
  /** Comes only from trusted session state, never from the wakeup request. */
  tarotRequested: boolean;
};
export type WakeupDecision = Decision & {
  action: 'template' | 'skip' | 'tool';
  inference: false;
  topic: ChatTopic;
  templateId?: string;
  templateMessage?: string;
};

// Reject hidden direction/format characters as well as ASCII/C1 controls.
// eslint-disable-next-line no-control-regex -- detecting controls is the intended validation.
const CONTROLS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;

export function normalize(text: string): string {
  return text.normalize('NFKC').normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

const selfHarm = /\b(?:suicid(?:e|al)|self[- ]harm|kill myself|end my life|end it all|hurt myself|cut myself|want to die|tu tu|tu sat|tu ket lieu|muon chet|khong muon song|khong the song tiep|ket thuc cuoc doi|tu ket thuc cuoc song|ket thuc cuoc song cua (?:toi|minh)|nhay cau|nhay lau|tu lam hai|tu gay thuong tich|tu cat tay|cat tay minh)\b/;
/** Preserve the unambiguous Vietnamese adverb before accent folding. */
function selfHarmInput(text: string): string {
  return normalize(text.normalize('NFKC').replace(/(?<!\p{L})từ\s+từ(?!\p{L})/giu, 'slowly'));
}

const harm = /\b(?:(?:kill|murder|stab|shoot|poison|hurt|harm|attack) (?:him|her|them|someone|somebody|people|others|my (?:partner|husband|wife|boyfriend|girlfriend|spouse))|giet (?:nguoi|anh|co|ho|ban|nguoi yeu)|sat hai|dam (?:nguoi|anh ay|co ay)|danh chet|lam hai (?:nguoi|anh|co|ho|ban)|domestic (?:abuse|violence)|my (?:partner|husband|wife|boyfriend|girlfriend|spouse) (?:(?:is|was) )?(?:hits|hurts|beats|hitting|hurting|beating) me|bi (?:bao hanh|bao luc)|bi danh)\b/;
const medical = /\b(?:diagnos(?:e|is|tic)|treatment|medication|medicine|pills?|dose|chemotherapy|cancer|disease|chest pain|heart attack|stroke|seizure|chan doan|chua benh|dieu tri|thuoc|ung thu|benh tim|benh tieu duong|bac si|phau thuat|tri lieu|hoa tri|xa tri|dau nguc|kho tho|dot quy|co giat|pha thai|nao thai)\b/;
const legal = /\b(?:lawsuit|lawyer|legal advice|court|sue|jail|prison|guilty|arrest|file (?:for )?divorce|luat su|to tung|kien tung|ra toa|toa an|phap ly|phap luat|tuyen an|co toi|pham toi|(?:nop|ky) don ly hon)\b/;
const financial = /\b(?:bitcoin|crypto|stock|stocks|forex|chung khoan|co phieu|dau tu|mua coin|ban coin|trad(?:e|ing)|invest(?:ment|ments)?|lottery|bet|bets|betting|gambl(?:e|ing)|casino|xo so|lo de|ca cuoc|danh bac|tai xiu|so de|(?:co nen|nen|quyet dinh) vay|(?:should i|shall i) (?:borrow|take out a loan))\b/;
const coercion = /\b(?:love spell|make (?:him|her|them|someone) love|coerc(?:e|ion)|manipulat(?:e|ion)|bua yeu|ep buoc|thao tung|(?:khien|lam cho) (?:anh ay|co ay|nguoi ay|ho) (?:phai )?yeu)\b/;
const certainty = /\b(?:guarantee(?:d)?|100%|chac chan|dam bao|predict (?:my |their |the )?death|when (?:will|do) .{0,40} (?:die|pass away)|will .{0,40} (?:die|pass away)|khi nao .{0,40} (?:chet|qua doi)|bao gio .{0,40} (?:chet|qua doi)|sap (?:chet|qua doi)|ngay (?:chet|qua doi)|tuoi tho|pregnan(?:t|cy)|co thai|mang thai|co bau|does (?:he|she|my partner) love me|(?:anh ay|co ay|nguoi ay|nguoi yeu) (?:(?:co|dang|van|thuc su) ){0,3}(?:yeu|nghi gi|nghi ve|ngoai tinh|co tinh cam|nho (?:toi|minh))|what (?:is|does) .{0,30} (?:thinking|think of me)|is .{0,30} cheating|(?:co |dang )?phan boi)\b/;
const injection = /\b(?:ignore .{0,40}(?:instructions|rules|prompt)|bo qua .{0,40}(?:chi dan|quy tac|huong dan|lenh|he thong)|system prompt|developer (?:message|instructions)|reveal .{0,40}(?:secrets|prompt|password|token)|api key|password|access token|mat khau|khoa api|you are now|act as|dong vai|write (?:a |some )?code|generate code|javascript|typescript|python|sql|html|css|source code|viet ma|tao ma|lap trinh|execute|run command|shell command|terminal command)\b/;
// Production preflight catches explicit override/extraction, while benign code
// questions reach the semantic domain router. Legacy fixture scope stays below.
const preflightInjection = /\b(?:ignore .{0,40}(?:instructions|rules|prompt)|bo qua .{0,40}(?:chi dan|quy tac|huong dan|lenh|he thong)|(?:reveal|show|print|expose|tell me).{0,40}(?:system prompt|developer (?:message|instructions)|secrets|password|access token|api key)|(?:tiet lo|hien thi|in ra|cho (?:toi|minh) xem).{0,40}(?:he thong|mat khau|khoa api|token|bi mat))\b/;
const irrelevant = /\b(?:capital of|thu do|weather|thoi tiet|recipe|cong thuc nau|cook(?:ing)?|bake|nau an|translate|dich sang|dich cau|tell me a joke|ke chuyen cuoi|football score|sports score|ty so|latest news|tin tuc|solve (?:this|the) equation|giai phuong trinh|world war|chien tranh the gioi)\b/;
const reflective = /\b(?:tarot|card|cards|la bai|tinh yeu|yeu|nguoi yeu|hon nhan|gia dinh|quan he|ban be|cong viec|lam viec|nghi viec|su nghiep|hoc tap|hoc hanh|cuoc song|ban than|cam xuc|cam thay|lo lang|buon|cang thang|tam trang|lac huong|nhin lai|suy ngam|suy nghi|dinh huong|tien bac|tai chinh|y nghia|quan trong|chu y|giai doan|thay doi|chuan bi|lua chon|tuong lai|ngay mai|goc nhin|bat dau|hieu ro|buoc nho|cham soc|love|relationship|partner|career|job|work|feel(?:ing|ings)?|stress|reflect(?:ion)?|self|family|friends|purpose|direction|mindfulness|decision|confidence|confident)\b/;

function removeNegatedCertainty(text: string): string {
  // Recognize denial grammar, rather than deleting an arbitrary number of
  // words after "not". Only the denied certainty term is removed; a following
  // positive claim and every other safety check remain visible. The copular
  // construction covers explanations such as "not a tool to guarantee".
  const denial = /\b(?:(?:khong|chua) (?:(?:the|co the|biet|the biet|bao gio|bao gio co the) )?(?:chac chan|dam bao)|(?:khong|chua) phai (?:la )?(?:mot )?(?:cong cu|phuong phap|cach|nguon) (?:de )?(?:chac chan|dam bao)|(?:cannot|can't|can not|does not|doesn't|do not|don't|is not|isn't|not|no) (?:a )?guarantee(?:d|s)?|(?:is not|isn't|not) (?:a )?(?:tool|method|way|source) (?:(?:to|that can|for) )?guarantee(?:d|s)?)\b/g;
  return text.replace(denial, denied => denied.replace(/\b(?:chac chan|dam bao|guarantee(?:d|s)?)\b/g, ''));
}

function decision(verdict: Decision['verdict'], reason: string): Decision {
  return { verdict, reason, policyVersion: POLICY_VERSION };
}

function decideWithInjection(question: string, injectionGate: RegExp): Decision {
  if (!question.trim() || question.length > MAX_QUESTION_CHARS || CONTROLS.test(question)) {
    return decision('block', 'invalid_request');
  }
  const text = normalize(question);
  // Crisis routing takes priority even when the same text contains an injection.
  if (selfHarm.test(selfHarmInput(question))) return decision('redirect', 'crisis_self_harm');
  if (harm.test(text)) return decision('redirect', 'crisis_harm');
  if (injectionGate.test(text)) return decision('block', 'injection');
  // "thuộc" (belonging) and "thuốc" (medicine) share an accent-free form.
  // Use the original accented text where available; narrowly allow familiar
  // unaccented belonging phrases while preserving explicit accented thuốc.
  const original = question.normalize('NFKC').toLowerCase();
  const medicalText = normalize(original.replace(/\bthuộc\b/gu, 'lien quan'))
    .replace(/\b(?:thuoc ve|thuoc linh vuc)\b/g, 'lien quan');
  if (/\bthuốc\b/u.test(original) || medical.test(medicalText)) return decision('redirect', 'medical');
  // Feeling guilty about quitting work is emotional reflection, not a request
  // for a legal verdict. Other legal terms still retain their usual gate.
  const legalText = text.replace(/\bco toi voi gia dinh vi nghi viec\b/g, 'day dut voi gia dinh vi nghi viec');
  if (legal.test(legalText)) return decision('redirect', 'legal');
  // Accent removal makes "bắt đầu từ" collide with "đầu tư". Preserve the
  // ordinary follow-up phrase while retaining checks for actual finance terms.
  if (financial.test(text.replace(/\bbat dau tu\b/g, 'bat dau'))) return decision('redirect', 'financial');
  if (coercion.test(text)) return decision('redirect', 'coercion');
  // Stating uncertainty is not a demand for a certain answer. Future-oriented
  // love/work prompts may pass; model instructions must answer conditionally.
  if (certainty.test(removeNegatedCertainty(text)) || /100\s*%/.test(text)) return decision('redirect', 'certainty');
  if (irrelevant.test(text) || !reflective.test(text)) return decision('block', 'irrelevant');
  return decision('pass', 'reflective');
}

export function decide(question: string): Decision {
  return decideWithInjection(question, injection);
}

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

export function validatePayload(value: unknown): Payload {
  if (!exactObject(value, ['question', 'spread', 'topic', 'followup'])) {
    throw new Error('Câu hỏi không đúng định dạng. Vui lòng thử lại.');
  }
  if (typeof value.question !== 'string' || !value.question.trim()) {
    throw new Error('Hãy nhập một câu hỏi để cùng suy ngẫm.');
  }
  if (value.question.length > MAX_QUESTION_CHARS) {
    throw new Error(`Hãy viết câu hỏi trong ${MAX_QUESTION_CHARS} ký tự.`);
  }
  if (CONTROLS.test(value.question)) {
    throw new Error('Câu hỏi chứa ký tự không được hỗ trợ. Vui lòng viết trên một dòng.');
  }
  if (value.spread !== 'one' && value.spread !== 'three') {
    throw new Error('Hãy chọn một hoặc ba lá bài.');
  }
  if (value.topic !== 'general' && value.topic !== 'love' && value.topic !== 'work' && value.topic !== 'self') {
    throw new Error('Chủ đề không được hỗ trợ. Vui lòng chọn lại.');
  }
  if (typeof value.followup !== 'boolean') {
    throw new Error('Lượt hỏi tiếp không đúng định dạng. Vui lòng thử lại.');
  }
  return { question: value.question.trim(), spread: value.spread, topic: value.topic, followup: value.followup };
}

export function validateChatPayload(value: unknown, maximum = MAX_QUESTION_CHARS): ChatPayload {
  if (![MAX_QUESTION_CHARS, MAX_ESTABLISHED_MESSAGE_CHARS].includes(maximum)) throw new Error('invalid_message_bound');
  if (!exactObject(value, ['message'])) {
    throw new Error('Tin nhắn không đúng định dạng. Vui lòng thử lại.');
  }
  if (typeof value.message !== 'string' || !value.message.trim()) {
    throw new Error('Hãy viết điều bạn muốn chia sẻ.');
  }
  const message = value.message;
  if ((maximum === MAX_ESTABLISHED_MESSAGE_CHARS ? unicodeCharacterCount(message) : message.length) > maximum) {
    throw new Error(`Hãy viết tin nhắn trong ${maximum} ký tự.`);
  }
  if (CONTROLS.test(value.message.replace(/[\t\n\r]/g, ''))) {
    throw new Error('Tin nhắn chứa ký tự điều khiển không được hỗ trợ.');
  }
  return { message };
}

function inferTopic(text: string): ChatTopic {
  if (/\b(?:tinh yeu|yeu|nguoi yeu|hon nhan|moi quan he|love|relationship|partner|dating|breakup)\b/.test(text)) return 'love';
  if (/\b(?:cong viec|lam viec|nghi viec|su nghiep|dong nghiep|sep|career|job|work|coworker|boss|money|tien bac|tai chinh)\b/.test(text)) return 'work';
  if (/\b(?:ban than|cam xuc|cam thay|tam trang|cham soc|lo lang|lo au|stress|cang thang|lac huong|met|buon|co don|self|feel|feeling|anxious|sad|tired|lonely|overwhelmed)\b/.test(text)) return 'self';
  return 'general';
}

function smallTalk(text: string): { reason: string; message: string } | null {
  const plain = text.replace(/[.!?…,;:]+/g, '').trim();
  if (/^(?:(?:xin |minh )?chao(?: (?:ban|tripp))?|hello(?: tripp)?|hi(?: tripp)?|hey(?: tripp)?|ban la ai|who are you)$/.test(plain)) {
    return { reason: 'greeting', message: 'Chào bạn, mình là TRIPP. Bạn có thể kể điều đang bận tâm, hoặc hỏi một câu để cùng nhìn lại cảm xúc và lựa chọn của mình.' };
  }
  if (/^(?:cam on(?: (?:ban|minh|tripp))?(?: nhe| nhieu| rat nhieu)?|thanks(?: (?:you|tripp))?|thank you(?: tripp)?|ok|okay|duoc roi)$/.test(plain)) {
    return { reason: 'thanks', message: 'Mình ở đây khi bạn muốn chia sẻ thêm. Bạn có thể dành một chút thời gian cho điều vừa nhận ra.' };
  }
  if (/^(?:ban (?:the nao|khoe khong)|how are you)$/.test(plain)) {
    return { reason: 'smalltalk', message: 'Mình sẵn sàng lắng nghe bạn. Hôm nay bạn đang cảm thấy thế nào?' };
  }
  return null;
}

function explicitlyRequestsTarot(text: string, original: string): boolean {
  // A mention of Tarot is not sufficient: asking what it is stays conversation.
  // Negated requests take precedence over the positive keyword patterns.
  if (/\b(?:khong (?:can|muon|dung|su dung)|bo qua|without|no need for|do not|don't|i do not want|i don't want).{0,30}(?:tarot|la bai|cards?|reading)\b/.test(text)
    || /đừng.{0,30}(?:tarot|lá bài|bài)/u.test(original)) return false;
  if (/\b(?:tarot la gi|la bai la gi|giai thich tarot|what is tarot|explain tarot|tell me about tarot)\b/.test(text)) return false;
  return /\b(?:(?:rut|keo|boc|chon|mo|xem|doc|trai).{0,25}(?:tarot|la bai)|(?:cho|giup|muon).{0,25}(?:mot la bai|1 la bai|bai tarot|xem tarot)|(?:draw|pull|read|choose).{0,20}(?:cards?|tarot)|(?:give|provide|do|want|would like).{0,25}(?:tarot reading|card reading)|tarot reading)\b/.test(text);
}

export function decideChat(message: string): ChatDecision {
  const text = normalize(message);
  const topic = inferTopic(text);
  let gate = decide(message);
  // Never allow small talk or a tool request to bypass a safety decision.
  if (gate.verdict !== 'pass' && gate.reason !== 'irrelevant') {
    return { ...gate, action: 'template', topic, inference: false, templateMessage: chatSafetyMessage(gate.reason) };
  }
  const template = smallTalk(text);
  if (template) return { ...decision('pass', template.reason), action: 'template', topic, inference: false, templateMessage: template.message };
  if (/^[^\p{L}\p{N}]*$/u.test(text)) {
    return { ...decision('block', 'empty_signal'), action: 'skip', topic, inference: false };
  }
  // Legacy chat fixtures retain an earlier broad conversational scope. Benign
  // everyday chat, food, planning, slang and short followups do
  // not need an approved keyword or an existing history. Earlier risk gates
  // still apply. Production uses preflightChat plus the semantic domain router.
  if (gate.reason === 'irrelevant') gate = decision('pass', 'conversational');
  const action = explicitlyRequestsTarot(text, message.normalize('NFKC').toLowerCase()) ? 'tool' : 'chat';
  return { ...gate, action, topic, inference: true };
}

/** No semantic classification, topic inference or tool authorization occurs here. */
export function preflightChat(message: string, maximum = MAX_QUESTION_CHARS): ChatDecision {
  // Do not block a health, intimacy or relationship topic by word alone. Clef
  // evaluates intent and context; only immediate danger and explicit overrides
  // use fixed preflight support before semantic routing.
  const text = normalize(message);
  const reason = ![MAX_QUESTION_CHARS, MAX_ESTABLISHED_MESSAGE_CHARS].includes(maximum) || !message.trim() || (maximum === MAX_ESTABLISHED_MESSAGE_CHARS ? unicodeCharacterCount(message) : message.length) > maximum || CONTROLS.test(message.replace(/[\t\n\r]/g, '')) ? 'invalid_request'
    : selfHarm.test(selfHarmInput(message)) ? 'crisis_self_harm' : harm.test(text) ? 'crisis_harm'
      : preflightInjection.test(text) ? 'injection' : null;
  if (reason) {
    const gate = decision(reason === 'injection' || reason === 'invalid_request' ? 'block' : 'redirect', reason);
    return { ...gate, action: 'template', topic: 'general', inference: false, templateMessage: chatSafetyMessage(gate.reason) };
  }
  return { ...decision('pass', 'semantic_pending'), action: 'chat', topic: 'general', inference: false };
}

export function chatSafetyMessage(reason: string): string {
  const support = safetyReading(reason);
  const reflection = support.reflection
    .replace('Mình sẽ dừng việc đọc bài để ưu tiên sự an toàn của bạn.', 'Lúc này, sự an toàn của bạn là ưu tiên.')
    .replace('Mình sẽ dừng việc đọc bài để ưu tiên an toàn cho bạn và những người liên quan.', 'Lúc này, cần ưu tiên an toàn cho bạn và những người liên quan.')
    .replace('Lá bài không thể', 'Mình không thể')
    .replace('Lá bài không dự đoán', 'Mình không dự đoán')
    .replace(' từ lá bài', '');
  return `${reflection} ${support.action}`;
}

const MARKUP_OR_URL = /[<>`*_#[\]]|(?:https?:\/\/|www\.|javascript:|data:)|\b[a-z0-9-]+\.(?:com|org|net|io|ai|vn|app|dev|co)(?:\/|\b)/i;
const certainOutput = /\b(?:chac chan|dam bao|guarantee(?:d|s)?|definitely|certainly|100%)\b/;
const privateOutput = /\b(?:(?:anh ay|co ay|nguoi ay|nguoi yeu) (?:(?:co|dang|van|thuc su) ){0,3}(?:yeu ban|ngoai tinh|tinh cam voi ban|nghi ve ban|nho ban)|(?:he|she) (?:loves you|is thinking about you|is cheating on you)|your partner is cheating)\b/;
const unsafeOutput = /\b(?:ban (?:bi|co) ung thu|you have cancer|ban (?:sap|se) (?:chet|qua doi)|you are pregnant|ban (?:dang |da )?mang thai|khong (?:can|nen|phai) (?:gap|di|tham kham|tim).{0,20}(?:bac si|y te|cap cuu)|suc khoe.{0,30}hoan toan binh thuong|(?:hay|nen) (?:tu tu|tu sat|tu ket lieu|tu ket thuc cuoc song|giet|lam hai)|kill yourself|make (?:him|her|them) love you|your diagnosis is|chan doan cua ban la|ban (?:co toi|vo toi)|you are (?:guilty|innocent))\b/;

function removeExplicitPrivateUnknowns(text: string): string {
  // An explicit indirect question is an epistemic boundary, not an assertion
  // about a partner. Match its ending "không/whether" and leave subsequent
  // clauses untouched; a vague disclaimer cannot excuse a positive claim.
  return text.replace(/\b(?:minh|toi|tripp|tarot|la bai) (?:khong (?:the )?(?:biet|xac dinh|cho biet)|chua biet) (?:lieu )?(?:(?:anh ay|co ay|nguoi ay|nguoi yeu) (?:(?:co|dang|van|thuc su) ){0,3}(?:yeu ban|ngoai tinh|tinh cam voi ban|nghi ve ban|nho ban)) (?:hay )?khong\b/g, '')
    .replace(/\b(?:minh|toi|tripp|tarot|la bai) (?:khong (?:the )?(?:biet|xac dinh|cho biet)|chua biet) (?:anh ay|co ay|nguoi ay|nguoi yeu|doi phuong) (?:(?:co|dang|van|thuc su) ){0,3}(?:cam thay|cam nhan|nghi|muon|mong) (?:gi|the nao|ra sao)\b/g, '')
    .replace(/\b(?:i|we|tripp|tarot|the cards) (?:cannot|can't|do not|don't|does not|doesn't) (?:know|tell|determine) whether (?:(?:he|she) (?:loves you|is thinking about you|is cheating on you)|your partner is cheating)\b/g, '')
    .replace(/\b(?:i|we|tripp|tarot|the cards) (?:cannot|can't|do not|don't|does not|doesn't) (?:know|tell|determine) (?:what|how) (?:he|she|your partner) (?:feels?|thinks?|wants?)\b/g, '');
}

function safeOutputText(text: unknown, maximum: number): text is string {
  return typeof text === 'string' && Boolean(text.trim()) && text.length <= maximum
    && !CONTROLS.test(text) && !MARKUP_OR_URL.test(text);
}

// Supplemental output checks distinguish descriptive education from directives.
// They are not a complete semantic safety guarantee.
const treatmentDirective = /(?:^|[.!?;,:]\s*|\b(?:then|and|afterwards|roi|va|sau do)\s+|\b(?:hay|nen|phai|can|please|ban co the|you can|you could|you may|you should|you must|you need to|i recommend|we recommend)\s+)(?:uong|dung|ngung|bo|tang|giam|take|stop|change|increase|decrease|skip|double).{0,40}(?:thuoc|lieu|vien|paracetamol|insulin|hoa tri|medication|medicine|dose|pills|injections)\b/;
const personalDiagnosis = /\b(?:ban (?:(?:da|dang) )?(?:bi|nhiem|mac)|you have|you are diagnosed with).{0,24}(?:ung thu|tieu duong|hiv|aids|cancer|diabetes|infection|an sti|an std)\b/;
const predictedOutcome = /\b(?:ban se|you will).{0,35}(?:nhan duoc (?:cong viec|viec lam)|trung (?:so|xo so)|ket hon|co thai|mang thai|chet|get (?:the |a |that |this |your )?(?:job|offer)|win (?:the )?lottery|be pregnant|die)\b/;
// Conversational flexibility does not authorize a generated instruction to
// pressure another person. Negated educational advice has no directive prefix.
const coerciveDirective = /(?:^|[.!?;,:]\s*|\b(?:hay|nen|phai|can|ban (?:co the|nen|phai|can)|tiep tuc|keep|continue|you (?:can|could|may|should|must|need to))\s+)(?:ep(?: buoc)?|thao tung|de doa|pressure|pressuring|force|forcing|coerce|coercing|manipulate|threaten)\b[^.!?;]{0,100}\b(?:nguoi ay|nguoi yeu|nguoi kia|doi phuong|ho|anh ay|co ay|him|her|them|they|someone|partner|refus(?:e|es|al)|agree|tu choi|dong y)\b/g;
const consentNegation = /\b(?:consent|dong thuan|su dong y)\s+(?:is\s+)?(?:unnecessary|not (?:necessary|required)|khong (?:can|can thiet|bat buoc))\b/;

function unsafeCoerciveDirective(output: string): boolean {
  for (const directive of output.matchAll(coerciveDirective)) {
    const prefix = output.slice(0, directive.index).split(/[.!?;,:]/).at(-1) ?? '';
    // Negation governs this directive only; a later clause is checked anew.
    if (!/\b(?:(?:khong|dung)(?: (?:nen|can|phai))?|do not|don't|never|should not|must not|cannot|can't)\s*$/.test(prefix)) return true;
  }
  return false;
}
const investmentDirective = /(?:^|[.!?]\s*|\b(?:hay|nen|phai|can|you should|you must|you need to|i recommend|we recommend)\s+)(?:mua|ban|giu|dau tu|buy|sell|hold|invest)\b(?:[^.!?]*\b(?:bitcoin|btc|ethereum|eth|crypto|coin|co phieu|chung khoan|stocks?|shares|(?:stock|equity|company) share|securit(?:y|ies)|bonds?|funds?|forex|options?|savings?|real estate|propert(?:y|ies)|gold|silver|currenc(?:y|ies)|dollars?|money|cash|tien|tiet kiem|vang|bat dong san|nha dat|tai san)\b|(?:\s+(?:in|into))?\s+(?:a|the|your|one)\s+share\b)/;
const holdOrInvestDirective = /\b(?:(?:ban|you) (?:nen|phai|can)|hay|you (?:should|must|need to))\s+(giu|dau tu|hold|invest)\b(?=([^.!?]*))/g;
const compoundHoldOrInvestDirective = /\b(?:(?:ban|you) (?:nen|phai|can)|hay|you (?:should|must|need to))\s+[^.!?]*?\b(?:roi|va|sau do|then|and|afterwards)\s+(?:(?:bat dau|begin to|start to)\s+)?(giu|dau tu|hold|invest)\b(?=([^.!?]*))/g;
const resourceAction = /\b(giu|dau tu|hold|invest)\b(?=([^.!?]*))/g;
const nonFinancialInvestmentObject = /^\s+(?:(?:your|some|more|additional|a little|a bit of|them|mot it|nhieu hon)\s+){0,3}(?:time|effort|attention|learning|thoi gian|cong suc|no luc|su chu y|viec hoc|hoc tap)\b/;
const nonFinancialHoldObject = /^\s+(?:(?:a|the|your|some|more|steady|gentle|healthy|clear|small|regular|supportive|safe|onto|mot|su|them|thai do|tinh than)\s+){0,4}(?:space|room|boundaries|calm|rest(?: rhythm)?|listening|right(?:s)? (?:to choose|to decide)|agency|quyen (?:lua chon|tu chu|quyet dinh)|nhip nghi|binh tinh|ranh gioi|lang nghe|khong gian|khoang (?:nhe|yen|nghi|lang)|cho)\b/;
const coordinatedObject = /^\s*(?:[,/&;|+\u2013\u2014]\s*|(?:and|or|plus|as well as|va|hoac|hay|cung voi)\s+)(?:(?:and|or|va|hoac|hay)\s+)?/;
const bareResourceDirective = /(?:^|[.!?;:"“”']\s*|\b(?:then|and|afterwards|roi|va|sau do)\s+|\b(?:hay|nen|phai|can|you should|you must|you need to|i recommend|we recommend)\s+)(giu|dau tu|hold|invest|purchase|mua|ban|buy|sell)\b(?=([^.!?]*))/g;
// An optional exercise can govern a later recommendation: "you could write
// a question then invest" still recommends the investment. Use the bare-action
// object checks so ordinary hold/purchase objects retain their usual behavior.
const optionalResourceRecommendation = /\b(?:ban|you) (?:co the|can|could|may|might)\s+(?:[^.!?]*?\b(?:roi|va|sau do|then|and|afterwards)\s+(?:(?:bat dau|begin to|start to)\s+)?)?(giu|dau tu|hold|invest|purchase|mua|ban|buy|sell)\b(?=([^.!?]*))/g;
const bareResourceAction = /\b(giu|dau tu|hold|invest|purchase|mua|ban|buy|sell)\b(?=([^.!?]*))/g;
const financialObject = /^\s+(?:(?:a|the|your|their|my|our|some|all|entire|whole|mot|cac|nhung|toan bo|toan bo so)\s+){0,4}(?:bitcoin|btc|ethereum|eth|solana|crypto|coins?|portfolio|danh muc(?: dau tu)?|co phieu|chung khoan|stocks?|shares?|securit(?:y|ies)|bonds?|funds?|forex|options?|savings?|real estate|propert(?:y|ies)|gold|silver|currenc(?:y|ies)|dollars?|money|cash|tien|tiet kiem|vang|bat dong san|nha dat|tai san)\b/;
const financialSibling = /(?:[,/&]\s*|\b(?:and|or|va|hoac)\s+)(?=([^.!?]*))/g;

function unsafeResourceObject(tail: string, benignObject: RegExp, allowLaterPurchase = false): boolean {
  const object = benignObject.exec(tail);
  if (!object) return true;
  let remainder = tail.slice(object[0].length);
  for (let joint = coordinatedObject.exec(remainder); joint; joint = coordinatedObject.exec(remainder)) {
    const sibling = remainder.slice(joint[0].length);
    // Later action verbs are checked separately. A coordinated noun remains
    // part of the current action: time AND money cannot masquerade as time.
    if (/^(?:giu|dau tu|hold|invest|(?:bat )?start from)\b/.test(sibling)
      || (allowLaterPurchase && /^purchase\b/.test(sibling))) break;
    const nextObject = benignObject.exec(` ${sibling}`);
    if (!nextObject) return true;
    remainder = sibling.slice(nextObject[0].length - 1);
  }
  return false;
}

function explicitFinancialObject(tail: string): boolean {
  return financialObject.test(tail) || Array.from(tail.matchAll(financialSibling))
    .some(match => financialObject.test(` ${match[1]}`));
}

function unsafeFinancialDirective(output: string): boolean {
  // Replies are already character-bounded. Financial assets anywhere in the
  // same sentence override a benign object; soft line wraps cannot evade this.
  if (investmentDirective.test(output)) return true;
  for (const match of [...output.matchAll(holdOrInvestDirective), ...output.matchAll(compoundHoldOrInvestDirective)]) {
    // A benign first action does not excuse a later financial action sharing
    // its directive, including a security whose name is not in our asset list.
    for (const action of `${match[1]}${match[2]}`.matchAll(resourceAction)) {
      const benignObject = action[1] === 'invest' || action[1] === 'dau tu' ? nonFinancialInvestmentObject : nonFinancialHoldObject;
      if (unsafeResourceObject(action[2], benignObject)) return true;
    }
  }
  for (const match of [...output.matchAll(bareResourceDirective), ...output.matchAll(optionalResourceRecommendation)]) {
    // Bare investment imperatives use the same time/effort exceptions as a
    // should-directive. Bare hold/purchase needs an explicit financial object;
    // ordinary memories, pens, boundaries and books remain ordinary objects.
    for (const action of `${match[1]}${match[2]}`.matchAll(bareResourceAction)) {
      if (action[1] === 'invest' || action[1] === 'dau tu') {
        if (unsafeResourceObject(action[2], nonFinancialInvestmentObject, true)) return true;
      } else if (explicitFinancialObject(action[2])) return true;
    }
  }
  return false;
}
const exclusivityClaim = /\b(?:(?:i am|i'm|tripp is|tarot is|the cards are) (?:the )?only (?:one|person|friend|companion|thing|source).{0,50}(?:understands?|knows?|helps?|supports?|loves?|need)|only (?:i|me|tripp|tarot|the cards).{0,40}(?:understand|know|help|support|love)|(?:chi (?:minh|toi|tripp|tarot|la bai)|(?:minh|toi|tripp) la (?:nguoi )?duy nhat).{0,40}(?:hieu|biet|giup|yeu|cham soc))\b|\b(?:you (?:do not|don't) need (?:anyone|anybody) else|ban khong can (?:ai|nguoi nao) khac)\b/;
const compulsiveDrawDirective = /(?:^|[.!?;]\s*|\b(?:hay|ban (?:phai|can|nen)|you (?:must|need to|should)|keep)\s+)(?:rut|xem|draw|pull|return|come back|ask).{0,50}(?:moi gio|lien tuc|lap lai|den khi|cho den khi|ngay lap tuc|every hour|hourly|repeatedly|again and again|until|immediately).{0,25}(?:bai|tarot|card|reading|answer|[.!?]|$)/;
const redrawThreat = /\b(?:(?:if you (?:do not|don't|stop).{0,30}(?:draw|tarot|readings?|return)|neu (?:ban )?(?:khong|ngung).{0,30}(?:rut (?:them )?bai|xem tarot|quay lai)).{0,60}(?:bad luck|danger|lose|harm|xui|bat hanh|mat|nguy hiem)|(?:draw|pull|rut|xem tarot).{0,50}(?:or|neu khong|to avoid|de tranh).{0,50}(?:bad|danger|harm|xui|bat hanh|nguy hiem))\b/;
const personalSymptomCause = /\b(?:your (?:headaches?|symptoms?|(?:back |chest |stomach )?pain|nausea|dizziness|rash|fever|illness|fatigue)|(?:con |chung )?(?:dau dau|dau nguc|dau lung|trieu chung|buon non|chong mat|phat ban|sot|benh|met moi) cua ban).{0,60}\b(?:is caused by|are caused by|comes from|come from|is due to|are due to|la do|bat nguon tu|do (?:nang luong|la bai|tarot|tam linh))\b/;
const legacyFutureOrTreatment = /\b(?:ban se|you will|(?:uong|dung|ngung|bo|tang|giam).{0,40}(?:thuoc|lieu|vien|paracetamol|insulin|hoa tri)|(?:take|stop|change|increase|decrease|skip|double).{0,30}(?:medication|medicine|dose|pills|insulin|injections))\b/;

function unsafeConversationalCertainty(text: string): boolean {
  for (const clause of removeNegatedCertainty(text).split(/[.!?;\n]/)) {
    if (!certainOutput.test(clause) && !/100\s*%/.test(clause)) continue;
    const claim = clause.replace(/\b(?:chac chan|dam bao|guarantee(?:d|s)?|definitely|certainly)\b/g, '').replace(/\s+/g, ' ').trim();
    // Qualifying a process or general principle is different from promising
    // a user's future, private knowledge or the authority of a Tarot result.
    if (/\b(?:ban|you) (?:se|will)\b/.test(claim)
      || Array.from(claim.matchAll(new RegExp(`\\b${privatePerson} (?:se|will)\\b`, 'g')))
        .some(match => !questionOrHypotheticalClaim(claim, match.index))
      || privateOutput.test(claim)
      || Array.from(claim.matchAll(assertedPrivateState)).some(match => !questionOrHypotheticalClaim(claim, match.index))
      || Array.from(claim.matchAll(relationshipState)).some(match => !questionOrHypotheticalClaim(claim, match.index))
      || (/\b(?:guarantee(?:d|s)?|dam bao)\b/.test(clause)
        && (/\b(?:your|you|ban|cua ban)\b/.test(claim) || new RegExp(`\\b${privatePerson}\\b`).test(claim)))
      || (/\b(?:tarot|reading|readings|cards?|trai bai|la bai)\b/.test(claim)
        && (/\b(?:guarantee(?:d|s)?|dam bao)\b/.test(clause) || /\b(?:right|true|exact|accurate|correct|dung|chinh xac)\b/.test(claim)))) return true;
  }
  return false;
}

function unsafeResponse(text: string, chat = false, conversational = false): boolean {
  const output = normalize(text);
  // Preserve original accented lexical meaning only for treatment directives:
  // nền tảng is a foundation, not nên tăng; dữ liệu is data, not a dose (liều).
  // Shorter replacements cannot push a real nearby medical object outside the
  // existing span. Split and soft-wrapped actual dose directives stay visible.
  const medicalDirectiveOutput = normalize(text.normalize('NFKC')
    .replace(/\bnền\s+tảng\b/giu, 'base').replace(/\bdữ\s+liệu\b/giu, 'data'));
  // Financial scans preserve Vietnamese lexical distinctions before folding:
  // "đầu từ" is start-from, "tiên" is not money ("tiền"), and "bạn" is a
  // pronoun rather than the sell verb "bán". Other safety scans use the original
  // normalized text. Vietnamese directive prefixes still recognize mapped you.
  const financialOutput = normalize(text.normalize('NFKC').replace(/đầu\s+từ/giu, 'start from')
    .replace(/\btiên\b/giu, 'priority').replace(/\bbạn\b/giu, 'you'));
  return (conversational ? unsafeConversationalCertainty(output) : certainOutput.test(removeNegatedCertainty(output)))
    || privateOutput.test(removeExplicitPrivateUnknowns(output))
    || unsafeOutput.test(output) || treatmentDirective.test(medicalDirectiveOutput) || personalDiagnosis.test(output) || unsafeFinancialDirective(financialOutput)
    || unsafeCoerciveDirective(output) || consentNegation.test(output)
    || exclusivityClaim.test(output) || compulsiveDrawDirective.test(output) || redrawThreat.test(output) || personalSymptomCause.test(output)
    || predictedOutcome.test(output) || (!chat && legacyFutureOrTreatment.test(output)) || /100\s*%/.test(output);
}

export type ChatTextRejection = 'empty' | 'length' | 'controls' | 'markup' | 'unsafe_claim';
export type ChatTextInspection = { accepted: true; text: string } | { accepted: false; reason: ChatTextRejection };

/** Legacy advisory content inspection. Live reply parsers use technical inspectGeneratedText instead. */
export function inspectChatReplyText(value: unknown, maximum = 6000, conversational = false): ChatTextInspection {
  if (typeof value !== 'string' || !value.trim()) return { accepted: false, reason: 'empty' };
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 6000 || value.length > maximum) return { accepted: false, reason: 'length' };
  if (CONTROLS.test(value.replace(/\n/g, ''))) return { accepted: false, reason: 'controls' };
  if (MARKUP_OR_URL.test(value)) return { accepted: false, reason: 'markup' };
  if (unsafeResponse(value, true, conversational)) return { accepted: false, reason: 'unsafe_claim' };
  return { accepted: true, text: value.trim() };
}

export function validateChatReply(value: unknown): ChatReply | null {
  if (!exactObject(value, ['reply'])) return null;
  const inspected = inspectChatReplyText(value.reply);
  return inspected.accepted ? { reply: inspected.text } : null;
}

export type PrivateFactRule = 'birth_derived' | 'other_person_state' | 'relationship_state' | 'user_state'
  | 'user_history' | 'user_ability' | 'relative_personal_past' | 'presupposed_recovery';
export type GroundedTextInspection = { accepted: true; text: string }
  | { accepted: false; reason: ChatTextRejection | 'unsupported_private_fact'; privateFactRule?: PrivateFactRule };
export type GroundingFact = { id: string; text: string };

const privatePerson = '(?:anh ay|co ay|nguoi ay|nguoi yeu(?: cua ban)?|doi phuong|ban doi|nguoi kia|he|she|they|your (?:partner|spouse|boyfriend|girlfriend|husband|wife)|the other person)';
const privateState = '(?:cam thay|cam nhan|nghi|muon|mong|yeu|nho|lo lang|ap luc|buon|hanh phuc|cang thang|ton thuong|tinh cam|giu bi mat|giau bi mat|che giau|giu kin|feels?|thinks?|wants?|hopes?|misses?|loves?|anxious|stressed|happy|hurt|hiding|keeping secrets)';
const privateModifiers = '(?:(?:co the|co le|duong nhu|thuc ra|dang|van|da|se|deu|thuc su|rat|may|might|could|perhaps|probably|actually|is|are|both|still|really|seems? to|be) ){0,5}';
const assertedPrivateState = new RegExp(`\\b(?:${privatePerson}|ban va ${privatePerson}|you and ${privatePerson}) ${privateModifiers}${privateState}\\b`, 'g');
// Relationship symbolism is educational. Claiming that the actual relationship
// contains openness, warmth or mutual tension is a different claim, including
// when a card is presented as the source or "may" is prepended.
const relationshipState = /\b(?:(?:moi )?quan he (?:cua (?:ban|hai ban)|nay|giua (?:hai ban|ban va nguoi ay)) (?:(?:co the|dang|van|da|se|con|co|la|rat|day|su|nang luong) ){0,6}(?:tich cuc|coi mo|hanh phuc|am ap|cang thang|ap luc|gan ket|xa cach)|(?:van con|dang co|co the co) (?:nang luong )?(?:tich cuc|su coi mo|su gan ket|su am ap|ap luc|cang thang)[^.!?;:]{0,65}trong (?:moi )?quan he|(?:(?:your|this) relationship|the relationship between you)[^.!?;:]{0,45}\b(?:positive|openness|open|warmth|happy|tension|stress|strained|connected|distant)|(?:positive energy|openness|warmth|tension|stress)[^.!?;:]{0,45}\b(?:in|within) (?:your|this|the) relationship)\b/g;

// These predicates are assertions, including when embedded inside an optional
// task ("record what you have learned") or preceded by a mere may/could hedge.
// Optional future actions such as "you can try a worksheet" are not predicates
// of an already-existing state, skill or past event.
const assertedUserState = /\b(?:ban (?:(?:co the|co le|duong nhu|thuc ra) )?(?:(?:co )?(?:dang|hien dang|van|tung|thuong|da(?! (?:chia se|cho biet|noi rang))|cam thay|cam nhan|gap kho khan|mat nang luong|lo(?: lang)?|met|buon|cang thang)|co (?:ky nang|kinh nghiem|nang luc|so truong|kha nang)|biet cach|gioi|thanh thao)|you (?:(?:may|might|could|perhaps|probably|actually) )?(?:are (?:(?:currently|still|already|really) )?(?:anxious|sad|tired|lonely|overwhelmed|stressed|happy|hurt|afraid|confused|losing|struggling|carrying|feeling|thinking|hiding|keeping|skilled|experienced|good at)|were|have(?! (?:(?:the )?(?:right|choice|option)|shared|told me))|had|did|feel(?! free to)|felt|learned|learnt|experienced|usually|often|regularly|tend to|know how|be (?:losing|struggling|feeling|carrying|good|skilled|experienced)|(?:can )?already))\b/g;
const assertedUserAbility = /\b(?:(?:ky nang|kinh nghiem|nang luc|so truong)[^.!?;:,]{0,50}cua ban (?:la|rat|tot|giup|mang lai|cho phep)|your (?:[a-z-]+ ){0,3}(?:skills?|experience|ability|strengths?) (?:is|are|have|has|will|means?|gives?|helps?))\b/g;
// A task can presuppose a personal past even when Vietnamese omits its subject:
// "ghi lại một điều đã cảm thấy" is not a prospective experiment. These bounded
// noun-relative constructions do not classify every occurrence of a past verb.
const impliedPersonalHistory = /\b(?:(?:(?:mot|[1-9]|nhung|cac) )?(?:dieu|viec|suy nghi|cam giac|trai nghiem|bai hoc|quyet dinh|ky nang) (?:ma )?(?:(?:ban|minh) )?(?:da|tung|thuong) (?:cam thay|cam nhan|hoc(?: duoc)?|trai qua|co gang|dua ra|ngai|lo|buon|met)|(?:one |an? |the |some |your )?(?:things?|experiences?|feelings?|skills?|lessons?) (?:(?:that|which) )?(?:previously |already )?(?:felt|learned|learnt|experienced|developed))\b/g;
const presupposedPersonalState = /\b(?:(?:giam|bot) (?:su )?tu phan xet|(?:lay lai|khoi phuc) (?:nang luong|su tu tin)|(?:reduce|lessen) your self[- ]judg(?:e)?ment|regain your (?:energy|confidence))\b/g;
const birthDerivedFact = /\b(?:sinh ngay|ngay sinh|birth date|date of birth)\b[^.!?;:,]*?\b(?:cho thay|noi len|nghia la|means?|shows?|reveals?|makes?)\b[^.!?;:,]*?\b(?:ban|you|your)\b/g;
const claimConjunction = /\b(?:nhung|va|roi|vi|song|but|and|then|because|however|yet)\b/;

function normalizedFactClause(text: string): string {
  // Subject-only coreference is the sole permitted rewrite: no synonym,
  // skill inference or factual object is added to the user's source clause.
  return normalize(text.normalize('NFKC').trim().replace(/^(?:tôi|mình)\b/iu, 'bạn')
    .replace(/^i am\b/iu, 'you are').replace(/^i was\b/iu, 'you were').replace(/^i\b/iu, 'you'));
}

function explicitlySupportedClaim(output: string, index: number, facts: readonly GroundingFact[]): boolean {
  const clause = output.slice(index).split(/[.!?;:]/)[0].trim();
  // Evidence is the user's statement, not a required attribution catchphrase.
  // Subject-only coreference does not create a new skill, past event or state.
  return facts.some(fact => typeof fact.text === 'string'
    && Array.from(fact.text.matchAll(/([^.!?;:]+)([.!?;:]|$)/g)).some(source => source[2] !== '?'
      && !/^(?:(?:(?:minh|toi|i|we) )?(?:khong (?:the )?biet|do not know|cannot know)|lieu|whether|what|how|if)\b/.test(normalize(source[1]))
      && normalizedFactClause(source[1]) === clause));
}

/** A question or condition is not a statement of an unknown private fact. */
function questionOrHypotheticalClaim(output: string, index: number, personalPast = false): boolean {
  const prefix = output.slice(0, index).split(/[.!?;:]/).at(-1) ?? '';
  const localPrefix = prefix.split(/,|\b(?:nhung|va|roi|vi|song|but|and|then|because|however|yet)\b/).at(-1) ?? '';
  const conditionalAction = /\b(?:viet|ghi|chon|chia se|thu|write|note|choose|share|record|list|describe|remember|recall|try)\b/.test(localPrefix);
  if ((!conditionalAction && /\b(?:neu|gia su|if|suppose|assuming)\b[^,]*$/.test(localPrefix))
    || /\b(?:tinh huong gia dinh|vi du gia dinh|hypothetical example)\s*,?\s*$/.test(prefix)) return true;
  if (/\b(?:khong (?:the )?(?:biet|xac dinh|cho (?:(?:minh|toi) )?(?:biet|thay)|chung minh)|khong co nghia(?: la| rang)?|cannot (?:know|tell|determine|show)(?: (?:me|us))?(?: that)?|(?:does|do) not (?:show|reveal|mean|tell)(?: (?:me|us))?(?: that)?|not evidence that)\s*$/.test(localPrefix)) return true;
  const tail = output.slice(index);
  // A generic example disclaimer says the exercise is hypothetical, rather
  // than asserting a personal past. Its scope cannot waive a specific event
  // or a later independent assertion.
  if (/\b(?:vi du|examples?|hypothetical exercise)\b/.test(prefix)
    && /\b(?:khong phai (?:dieu|viec)(?: ma)?|not (?:something|a thing)(?: (?:that|which))?)\s*$/.test(localPrefix)
    && /^(?:ban da lam|you (?:have (?:already )?done|did))(?=\s*(?:[.!?;,]|hoac\b|or\b|$))/.test(tail)) return true;
  const boundary = /[.!?;:,]|\b(?:nhung|va|roi|vi|song|but|and|then|because|however|yet)\b/.exec(tail);
  const firstClause = tail.slice(0, boundary?.index ?? tail.length).trim();
  const selectedObject = /\b(?:cau hoi|dieu|viec|suy nghi|cam giac|trai nghiem|quyet dinh|ky nang|questions?|things?|experiences?|feelings?|skills?) (?:ma |that |which )?$/.test(prefix);
  if (!selectedObject && !personalPast && (boundary?.[0] === '?' || /\b(?:khong|hay chua|the nao|ra sao|luc nao|khi nao|dieu gi|gi)\s*$/.test(firstClause))) return true;
  const selectedPast = selectedObject && /^(?:ban (?:(?:da|tung|thuong)|co (?:ky nang|kinh nghiem|nang luc)|biet cach|gioi|thanh thao)|you (?:have|had|were|did|learned|learnt|experienced|usually|often|regularly|know how))\b/.test(tail);
  // An indirect request asks the user/partner for information. Its scope ends
  // at the conjunction or sentence, so it cannot waive a subsequent assertion.
  if (!selectedPast && /\b(?:(?<!\bdu )lieu|whether|what|how|when|dieu gi|hoi|ask|kiem tra xem|quan sat xem|tu hoi xem|muon (?:nghe|biet|hieu))\b[^.!?;:]*$/.test(localPrefix)) return true;
  // Choosing a present topic/feeling to discuss is an invitation. A selected
  // past, habit or ability still presupposes a fact and requires user evidence.
  if (selectedObject && !personalPast
    && /\b(?:(?:ban )?co the|(?:you )?(?:can|could|may)|(?:can|could|may|would) you|thu|try)\b/.test(prefix)
    && /^(?:ban|you)\b/.test(tail) && !/^(?:ban va|you and)\b/.test(tail)
    && !selectedPast) return true;
  const scopedTail = tail.split(/[.!?;:]/)[0].split(claimConjunction)[0];
  return /(?:,\s*|\s+)(?:neu co|if any)(?:\s*,|\s*$)/.test(scopedTail);
}

function personalExerciseSelection(output: string, index: number, actionStartsHere = false): boolean {
  const prefix = output.slice(0, index).split(/[.!?;:]/).at(-1) ?? '';
  if (actionStartsHere && /^\s*(?:(?:ban )?(?:co the|can|nen|phai) (?:thu )?|(?:hay|thu) |(?:you )?(?:can|could|may|might|should) (?:try to )?|(?:can|could|may|would) you |please |try to )?\s*$/.test(prefix)) return true;
  return /(?:^|,\s*|\b(?:roi|va|then|and)\s+)\s*(?:(?:ban )?(?:co the|can|nen|phai) (?:thu )?|(?:hay|thu) |(?:you )?(?:can|could|may|might|should) (?:try to )?|(?:can|could|may|would) you |please |try to )?(?:viet(?: ra)?|ghi(?: lai| nhan)?|chon|chia se|neu|dat|thu|giam|bot|lay lai|khoi phuc|write(?: down)?|note|choose|share|record|list|describe|remember|recall|reduce|lessen|regain)\b[^.!?;:]*$/.test(prefix);
}

// Conversational acknowledgment and ordinary present context are model prose,
// not newly established profile facts. Hard checks focus on identifiable
// private history/abilities, another person's states and birth-derived claims.
const assertedConversationHistory = /\b(?:ban (?:(?:co the|co le|duong nhu|thuc ra) )?(?:(?:da(?! (?:chia se|cho biet|noi|hoi|ke)\b)|tung|thuong)\b|co (?:ky nang|kinh nghiem|nang luc|so truong|kha nang)|biet cach|gioi|thanh thao)|you (?:(?:may|might|could|perhaps|probably|actually) )?(?:were|had|did|felt|learned|learnt|experienced|usually|often|regularly|tend to|know how|(?:can )?already|have (?:already |previously )?(?:learned|learnt|experienced|developed|worked|studied|felt|skills?|experience|ability|abilities)))\b/g;

// Finite affirmative engagement pressure, not a semantic topic/closure router.
// Optional sharing and rights to stop remain allowed. Negation is local to the
// matched clause; an earlier reassurance cannot excuse a later demand.
const requiredCompanionEngagement = /\b(?:ban (?:phai|bat buoc|can)|you (?:must|have to|need to|are required to))\s+(?:(?:(?:tiep tuc )?(?:tro chuyen|nhan tin|noi chuyen)|(?:keep|continue|stay) (?:chatting|talking|messaging))(?:[^.!?;,]{0,50}\b(?:voi (?:minh|toi|tripp)|(?:with|to) (?:me|us|tripp))|(?=\s*(?:[.!?;,]|$)))|(?:ke|noi|chia se) (?:het|tat ca|toan bo|moi thu|moi chuyen)[^.!?;,]{0,45}\b(?:cho|voi) (?:minh|toi|tripp)|(?:tra loi|answer)[^.!?;,]{0,75}\b(?:de (?:minh|toi) (?:giup|ho tro)|(?:so (?:that )?)?(?:i|we) (?:can )?(?:help|support)))\b/g;
const disclosureOrNoStopDemand = /(?:^|[.!?;:,]\s*|\b(?:va|and|nhung|but)\s+)(?:(?:hay|vui long|please)\s+)?(?:(?:ke|noi|chia se) (?:cho )?(?:minh|toi|tripp) (?:tat ca|moi thu|toan bo)|tell (?:me|us|tripp) (?:everything|all (?:(?:the|your) )?(?:private )?details)|(?:dung|khong duoc) (?:dung|ngung) (?:tro chuyen|noi chuyen|nhan tin)|(?:do not|don't) stop (?:chatting|talking|messaging))\b/g;
const conditionalCompanionHelp = /\b(?:i|we) (?:can|will) only (?:help|support)(?: you)? (?:if|when|after) you (?:keep|continue|stay) (?:chatting|talking|messaging) (?:with|to) (?:me|us|tripp)\b/g;
function unsafeEngagementPressure(output: string): boolean {
  for (const match of [...output.matchAll(requiredCompanionEngagement), ...output.matchAll(disclosureOrNoStopDemand), ...output.matchAll(conditionalCompanionHelp)]) {
    const prefix = output.slice(0, match.index).split(/[.!?;,:]/).at(-1) ?? '';
    if (!/\b(?:khong (?:phai|can|nen)|dung|do not|don't|never|should not|must not|need not)\s*$/.test(prefix)) return true;
  }
  return false;
}

function unsupportedPrivateState(text: string, facts: readonly GroundingFact[], conversational = false): PrivateFactRule | null {
  const output = removeExplicitPrivateUnknowns(normalize(text.replace(/\n/g, '. ')));
  for (const match of output.matchAll(birthDerivedFact)) {
    if (!/\b(?:khong (?:the )?(?:cho thay|noi len|nghia la)|khong co nghia(?: la| rang)?|does not (?:show|reveal|mean)|cannot (?:show|reveal))\b/.test(match[0])) return 'birth_derived';
  }
  const patterns: readonly [RegExp, PrivateFactRule][] = [
    [assertedPrivateState, 'other_person_state'], [relationshipState, 'relationship_state'],
    [conversational ? assertedConversationHistory : assertedUserState, conversational ? 'user_history' : 'user_state'],
    [assertedUserAbility, 'user_ability'], [impliedPersonalHistory, 'relative_personal_past'],
    ...(conversational ? [] : [[presupposedPersonalState, 'presupposed_recovery'] as [RegExp, PrivateFactRule]]),
  ];
  for (const [pattern, rule] of patterns) {
    for (const match of output.matchAll(pattern)) {
      if ((pattern === impliedPersonalHistory || pattern === presupposedPersonalState)
        && !/\b(?:ban|minh|you|your)\b/.test(match[0])
        && !personalExerciseSelection(output, match.index, pattern === presupposedPersonalState)) continue;
      if (!explicitlySupportedClaim(output, match.index, facts)
        && !questionOrHypotheticalClaim(output, match.index, pattern === impliedPersonalHistory || pattern === assertedUserAbility || pattern === presupposedPersonalState)) return rule;
    }
  }
  return null;
}

/** Narrow reading-only grounding checks; this is not a semantic fact verifier. */
export function inspectGroundedReflectionTextWithDiagnostics(value: unknown, facts: readonly GroundingFact[] = [], maximum = 6000): GroundedTextInspection {
  const inspected = inspectChatReplyText(value, maximum);
  if (!inspected.accepted) return inspected;
  const privateFactRule = unsupportedPrivateState(inspected.text, facts);
  if (privateFactRule) return { accepted: false, reason: 'unsupported_private_fact', privateFactRule };
  return inspected;
}

/** Natural chat may paraphrase/translate supplied present context; no state is inferred here. */
export function inspectConversationalReplyTextWithDiagnostics(value: unknown, facts: readonly GroundingFact[] = [], maximum = 6000): GroundedTextInspection {
  const inspected = inspectChatReplyText(value, maximum, true);
  if (!inspected.accepted) return inspected;
  // Even a full model copy is bounded to the latest 100 turns. Exact, complete
  // recall of the user's entire history cannot be established from that copy.
  // Direct affirmative forms only: ordinary acknowledgments and explicit
  // uncertainty about omitted history remain conversational.
  const memory = normalize(inspected.text);
  if (unsafeEngagementPressure(memory)) return { accepted: false, reason: 'unsafe_claim' };
  if (/\b(?:minh|toi|tripp) (?:da )?(?:doc (?:(?:day du|het) )?(?:toan bo|tat ca) lich su|nho (?:chinh xac )?(?:toan bo|tat ca|moi) chi tiet)\b/.test(memory)
    || /\b(?:i|we) (?:have )?(?:read (?:all (?:of )?(?:your |the )?history|(?:your |the )?(?:entire|complete|whole) history)|remember (?:exactly )?(?:every|all) (?:single )?details?)\b/.test(memory)) return { accepted: false, reason: 'unsafe_claim' };
  const privateFactRule = unsupportedPrivateState(inspected.text, facts, true);
  if (privateFactRule) return { accepted: false, reason: 'unsupported_private_fact', privateFactRule };
  return inspected;
}

// Existing callers retain their small reason-only inspection contract. Reading
// parsers opt into finite diagnostic enums; neither path exposes matched text.
function withoutPrivateFactDiagnostics(inspected: GroundedTextInspection): GroundedTextInspection {
  return inspected.accepted ? inspected : { accepted: false, reason: inspected.reason };
}
export function inspectGroundedReflectionText(value: unknown, facts: readonly GroundingFact[] = [], maximum = 6000): GroundedTextInspection {
  return withoutPrivateFactDiagnostics(inspectGroundedReflectionTextWithDiagnostics(value, facts, maximum));
}
export function inspectConversationalReplyText(value: unknown, facts: readonly GroundingFact[] = [], maximum = 6000): GroundedTextInspection {
  return withoutPrivateFactDiagnostics(inspectConversationalReplyTextWithDiagnostics(value, facts, maximum));
}

export function validateReading(value: unknown): Reading | null {
  if (!exactObject(value, ['reflection', 'action', 'question'])) return null;
  const fields = ['reflection', 'action', 'question'] as const;
  const limits = { reflection: 1200, action: 400, question: 300 };
  const result: Reading = { reflection: '', action: '', question: '' };
  for (const field of fields) {
    const text = value[field];
    if (!safeOutputText(text, limits[field])) return null;
    result[field] = text.trim();
  }
  if (unsafeResponse(`${result.reflection} ${result.action} ${result.question}`)) return null;
  return result;
}

/** The server supplies context from its bounded session state, not raw input. */
export function decideSuggestion(context: SuggestionContext): SuggestionDecision {
  const skip = (reason: string): SuggestionDecision => ({
    ...decision('block', reason), action: 'skip', inference: false,
  });
  if (!exactObject(context, ['topic', 'hasReading', 'active', 'lastSuggestedAt', 'now', 'quotaAvailable', 'trigger'])
    || typeof context.hasReading !== 'boolean' || typeof context.active !== 'boolean'
    || typeof context.quotaAvailable !== 'boolean' || !Number.isFinite(context.lastSuggestedAt)
    || !Number.isFinite(context.now) || context.lastSuggestedAt < 0 || context.now < 0
    || (context.trigger !== 'tick' && context.trigger !== 'preview')) return skip('invalid_request');
  if (context.topic !== 'general' && context.topic !== 'food' && context.topic !== 'activity' && context.topic !== 'love' && context.topic !== 'work' && context.topic !== 'self') {
    return skip('suggestion_topic');
  }
  if (!context.hasReading) return skip('suggestion_no_context');
  if (!context.active) return skip('suggestion_inactive');
  if (!context.quotaAvailable) return skip('suggestion_quota');
  // Preview observes the same cooldown so repeated preview events cannot flood
  // the conversation. Successful display must be recorded by the server.
  if (context.lastSuggestedAt > 0 && context.now - context.lastSuggestedAt < SUGGESTION_COOLDOWN_MS) {
    return skip('suggestion_cooldown');
  }
  return { ...decision('pass', 'suggestion_ready'), action: 'show_template', inference: false, templateId: `tripp-${context.topic}-v1` };
}

export function suggestionTemplate(topic: string): SuggestionTemplate {
  switch (topic) {
    case 'food':
      return {
        title: 'Một lựa chọn nhẹ cho bữa ăn',
        body: 'Bạn có thể chọn một món đơn giản dựa vào nguyên liệu đang có, sở thích và thời gian hôm nay.',
        question: 'Mình có thể chọn món ăn nào để chăm sóc bản thân hôm nay?',
      };
    case 'activity':
      return {
        title: 'Một hoạt động nhỏ trong tầm tay',
        body: 'Bạn có thể thử một hoạt động nhẹ phù hợp với năng lượng và thời gian của mình.',
        question: 'Mình có thể chọn hoạt động nhỏ nào hôm nay để chăm sóc bản thân?',
      };
    case 'love':
      return {
        title: 'Một khoảng lặng cho mối quan hệ',
        body: 'Bạn có thể nhìn lại điều mình cần, rồi chọn một cách nói rõ ràng và tôn trọng ranh giới của cả hai.',
        question: 'Mình có thể bày tỏ nhu cầu nào trong mối quan hệ một cách dịu dàng hơn?',
      };
    case 'work':
      return {
        title: 'Một bước nhỏ trong công việc',
        body: 'Sau phần suy ngẫm, một bước nhỏ trong tầm tay có thể giúp bạn thử hướng đi phù hợp với mình.',
        question: 'Mình có thể thử bước nhỏ nào trong công việc để hiểu rõ hơn hướng đi của mình?',
      };
    case 'self':
      return {
        title: 'Dành một chút chú ý cho mình',
        body: 'Bạn có thể kiểm tra cảm xúc hiện tại và chọn một việc đơn giản để chăm sóc nhu cầu của bản thân.',
        question: 'Cảm xúc nào của mình đang cần được lắng nghe hôm nay?',
      };
    default:
      return {
        title: 'Mang suy ngẫm vào hôm nay',
        body: 'Bạn có thể giữ lại một điều hữu ích từ phần đọc bài và thử áp dụng vào một lựa chọn nhỏ.',
        question: 'Mình có thể chủ động làm gì hôm nay để hiểu rõ hơn điều đang quan trọng với mình?',
      };
  }
}

/** Wakeup requests never accept topic, summary or Tarot intent from the client. */
export function decideWakeup(context: WakeupContext): WakeupDecision {
  if (!exactObject(context, ['topic', 'hasContext', 'active', 'lastSuggestedAt', 'now', 'quotaAvailable', 'trigger', 'tarotRequested'])
    || typeof context.tarotRequested !== 'boolean') {
    return { ...decision('block', 'invalid_request'), action: 'skip', inference: false, topic: 'general' };
  }
  const topic: ChatTopic = context.topic === 'food' || context.topic === 'activity' || context.topic === 'love' || context.topic === 'work' || context.topic === 'self' ? context.topic : 'general';
  const eligible = decideSuggestion({
    topic: context.topic, hasReading: context.hasContext, active: context.active,
    lastSuggestedAt: context.lastSuggestedAt, now: context.now,
    quotaAvailable: context.quotaAvailable, trigger: context.trigger,
  });
  if (eligible.action === 'skip') {
    return { ...decision('block', eligible.reason.replace('suggestion_', 'wakeup_')), action: 'skip', inference: false, topic };
  }
  const messages: Record<ChatTopic, string> = {
    general: 'Có điều nào trong chuyện bạn vừa chia sẻ đang cần được làm rõ? Bạn có thể chọn một bước nhỏ trong tầm tay hôm nay.',
    food: 'Bạn có thể chọn một món đơn giản từ nguyên liệu đang có. Bạn đang muốn một bữa nhanh gọn hay có thời gian nấu chậm hơn?',
    activity: 'Bạn có thể chọn một hoạt động nhỏ phù hợp với năng lượng hiện tại. Bạn đang muốn nghỉ ngơi, vận động nhẹ hay thử điều gì mới?',
    love: 'Trong mối quan hệ này, bạn muốn giữ ranh giới nào và bày tỏ nhu cầu gì một cách tôn trọng?',
    work: 'Với điều bạn vừa chia sẻ về công việc, bạn có thể chọn một việc nhỏ để thử hôm nay. Bước nào đang trong tầm tay bạn?',
    self: 'Bạn có thể dành một nhịp nhìn lại cảm xúc hiện tại. Lúc này, điều gì giúp bạn chăm sóc nhu cầu của mình?',
  };
  const action = context.tarotRequested ? 'tool' : 'template';
  const templateMessage = action === 'tool'
    ? 'Bạn đã chọn dùng Tarot trong cuộc trò chuyện này. Bạn có thể nhìn lại gợi ý từ lá bài đã có và chọn một bước nhỏ trong tầm tay hôm nay.'
    : messages[topic];
  return { ...decision('pass', `wakeup_${action}`), action, inference: false, topic, templateId: `tripp-wakeup-${topic}-v1`, templateMessage };
}

// These deterministic redirects do not draw cards or call a model.
export function safetyReading(reason: string): Reading {
  switch (reason) {
    case 'crisis_self_harm':
      return {
        reflection: 'Mình rất tiếc vì bạn đang phải chịu nhiều đau đớn. Bạn xứng đáng được hỗ trợ ngay lúc này. Mình sẽ dừng việc đọc bài để ưu tiên sự an toàn của bạn.',
        action: 'Nếu bạn có thể làm hại mình ngay, hãy gọi số khẩn cấp nơi bạn sống hoặc đến cơ sở cấp cứu gần nhất. Nhờ một người bạn tin ở bên và tránh xa những thứ có thể gây hại.',
        question: 'Bạn có thể liên hệ với ai để họ ở bên bạn ngay bây giờ?',
      };
    case 'crisis_harm':
      return {
        reflection: 'Tình huống này cần sự hỗ trợ ngoài đời thực. Mình sẽ dừng việc đọc bài để ưu tiên an toàn cho bạn và những người liên quan.',
        action: 'Nếu có nguy hiểm ngay, hãy gọi số khẩn cấp nơi bạn sống. Đến nơi an toàn nếu có thể, tránh đối đầu và nhờ một người đáng tin hỗ trợ.',
        question: 'Bạn có thể đến đâu hoặc gọi cho ai để được an toàn ngay lúc này?',
      };
    case 'medical':
      return {
        reflection: 'Lá bài không thể xác định tình trạng sức khỏe hay lựa chọn điều trị. Điều bạn đang lo cần được trao đổi với chuyên gia y tế phù hợp.',
        action: 'Nếu đang đau ngực, khó thở hoặc có dấu hiệu nguy hiểm ngay, hãy tìm cấp cứu tại nơi bạn sống. Với câu hỏi khác, ghi lại triệu chứng và điều cần hỏi để trao đổi với bác sĩ hoặc dược sĩ.',
        question: 'Bạn muốn chuẩn bị câu hỏi nào cho buổi trao đổi với chuyên gia y tế?',
      };
    case 'legal':
      return {
        reflection: 'Lá bài không thể kết luận đúng sai pháp lý hoặc chọn hành động pháp lý thay bạn. Một người có chuyên môn và đủ thông tin sẽ giúp bạn đánh giá rõ hơn.',
        action: 'Tập hợp các giấy tờ, mốc thời gian và câu hỏi để trao đổi với luật sư hoặc dịch vụ trợ giúp pháp lý phù hợp.',
        question: 'Thông tin nào bạn cần làm rõ trước khi tìm tư vấn pháp lý?',
      };
    case 'financial':
      return {
        reflection: 'Lá bài không dự đoán lợi nhuận hoặc kết quả cá cược. Các quyết định tài chính cần dựa vào dữ liệu, khả năng chịu rủi ro và hoàn cảnh của bạn.',
        action: 'Tạm dừng quyết định vội, kiểm tra nguồn thông tin độc lập và cân nhắc trao đổi với chuyên gia tài chính phù hợp.',
        question: 'Bạn cần bảo vệ nhu cầu thiết yếu nào trước khi cân nhắc rủi ro tài chính?',
      };
    case 'coercion':
      return {
        reflection: 'Một mối quan hệ cần sự tự nguyện và tôn trọng ranh giới. Mình có thể giúp bạn suy ngẫm về nhu cầu của mình mà không điều khiển lựa chọn của người khác.',
        action: 'Viết ra điều bạn mong muốn, điều bạn có thể chủ động làm và ranh giới bạn muốn tôn trọng.',
        question: 'Bạn có thể bày tỏ nhu cầu của mình một cách tôn trọng như thế nào?',
      };
    case 'certainty':
      return {
        reflection: 'Mình không thể biết chắc tương lai, suy nghĩ của người khác hay những sự kiện như mang thai hoặc thời điểm qua đời từ lá bài. Bạn có thể dùng câu hỏi này để nhìn lại điều mình cần.',
        action: 'Chuyển câu hỏi sang điều bạn có thể quan sát, trao đổi trực tiếp hoặc chủ động chuẩn bị. Với vấn đề sức khỏe, hãy tìm nguồn kiểm tra y tế phù hợp.',
        question: 'Có điều gì trong tình huống này bạn có thể chủ động làm rõ hôm nay?',
      };
    case 'injection':
      return {
        reflection: 'TRIPP hỗ trợ những câu hỏi suy ngẫm về cuộc sống, cảm xúc và lựa chọn của bạn.',
        action: 'Hãy viết một câu hỏi về điều bạn đang trải qua, chẳng hạn áp lực công việc hoặc cách giao tiếp trong một mối quan hệ.',
        question: 'Bạn muốn nhìn lại điều gì trong cuộc sống lúc này?',
      };
    default:
      return {
        reflection: 'Mình cần một câu hỏi rõ ràng để cùng bạn suy ngẫm về cuộc sống, cảm xúc hoặc lựa chọn cá nhân.',
        action: 'Thử viết một câu hỏi như: “Mình nên nhìn lại điều gì để bớt căng thẳng trong công việc?”',
        question: 'Bạn đang muốn hiểu rõ hơn điều gì về chính mình?',
      };
  }
}
