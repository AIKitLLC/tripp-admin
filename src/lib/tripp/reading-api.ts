import { DECISION_MODEL } from './decision';
import { summarizeChat } from './inference';
import { preflightChat, MAX_ESTABLISHED_MESSAGE_CHARS, MAX_QUESTION_CHARS } from './policy';
import { offTopicRedirect } from './decision';
import { buildReadingDecisionInput, parseReadingDecision, READING_DECISION_VERSION } from './reading-decision';
import { buildReadingMessages, parseReadingReplyResult } from './reading-inference';
import { applyReadingAction, hasEstablishedReadingContext, publicReading, validateReadingCommand, type ReadingCommand } from './reading-flow';
import type { ReadingSession } from './reading-schema';
import type { ConversationHistory } from './conversation';
import { diagnosticReplyBranch, READING_FAILURE_REASONS, sanitizeReadingFailureResponse, sanitizeReadingPendingRequest, type DiagnosticReplyBranch, type ReadingFailureDiagnostics, type ReadingFailureReason } from './reading-diagnostics';
import type { ReadingOutputDiagnostics, ReadingOutputRejection } from './reading-output';
import { resolveReplyProvider, runReplyProvider, type ReplyProviderConfig, type ReplyProviderEnv } from './reply-provider';
import { validateClientToolCall, validateClientToolManifest, validateClientToolRevocation } from './client-tools';
import type { AdminAuthEnv } from './admin-auth';
import { resolvePublishedContextFlows, checkContextFlowPreflight, applyPublishedContextFlow,
  preflightContextOptions, preflightOmissionOptions, publishedContextOptions } from './admin-runtime';

interface ReadingEnv extends ReplyProviderEnv, AdminAuthEnv { DEMO_STATE: DurableObjectNamespace; AI_ENABLED: string }
interface BeginResult { ok: boolean; reason?: string; cached?: boolean; response?: Record<string, unknown>; ticket?: string; reading?: ReadingSession; candidate?: ReadingSession; history?: ConversationHistory; reservedAttempts?: number; model?: boolean; remaining?: number }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const MODEL_ACTIONS = new Set<ReadingCommand['action']>(['suggest_spread', 'save_context', 'interpret', 'followup', 'propose_extra']);

export function readingSessionId(request: Request): string | null {
  const match = request.headers.get('cookie')?.match(/(?:^|;\s*)tripp_session=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return match && UUID.test(match) ? match : null;
}
function state(env: ReadingEnv) { return env.DEMO_STATE.get(env.DEMO_STATE.idFromName('tripp-demo-v1')); }
async function call(env: ReadingEnv, path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await state(env).fetch(`https://state${path}`, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error('state_unavailable');
  return response.json();
}
/** Session-owned UI requests use a separate endpoint and cannot become reading commands. */
export async function handleClientToolAction(request: Request, env: ReadingEnv, action: 'register' | 'call' | 'revoke', raw: unknown) {
  let command;
  try { command = action === 'register' ? validateClientToolManifest(raw) : action === 'call' ? validateClientToolCall(raw) : validateClientToolRevocation(raw); }
  catch { return { data: { ok: false, reason: 'invalid_client_tool', inferenceCalls: 0, reservedAttempts: 0 }, status: 400 }; }
  const sessionId = readingSessionId(request);
  if (!sessionId) return { data: { ok: false, reason: 'session_initialization_required', inferenceCalls: 0, reservedAttempts: 0 }, status: 409 };
  const now = Date.now();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tripp:${Math.floor(now / 3600000)}:${request.headers.get('cf-connecting-ip') ?? 'local'}`));
  const ipKey = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const data = await call(env, `/client-tools/${action}`, { sessionId, ipKey, now, command });
  return { data: { ...data, inferenceCalls: 0, reservedAttempts: 0 }, status: data.ok ? 200 : ['rate_limit', 'action_quota', 'action_limit', 'busy'].includes(String(data.reason)) ? 429 : 409 };
}
export async function readReading(request: Request, env: ReadingEnv, establishedSessionId?: string) {
  const sessionId = establishedSessionId ?? readingSessionId(request);
  if (!sessionId) return { reading: null, history: { version: 1, turns: [] }, pendingRequest: null };
  const result = await call(env, '/reading', { sessionId, now: Date.now() });
  return { ...result, reading: publicReading(result.reading as ReadingSession | null), pendingRequest: sanitizeReadingPendingRequest(result.pendingRequest) };
}
function safeResponse(data: Record<string, unknown>, action: ReadingCommand['action']) {
  return { ...sanitizeReadingFailureResponse(data, action), ...(Object.hasOwn(data, 'reading') ? { reading: publicReading(data.reading as ReadingSession | null) } : {}) };
}
function usage(value: unknown) {
  const data = value && typeof value === 'object' ? (value as { usage?: Record<string, unknown> }).usage : null;
  const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
  return { input: count(data?.input_tokens ?? data?.prompt_tokens), output: count(data?.output_tokens ?? data?.completion_tokens) };
}
class ReadingCallFailure extends Error {
  constructor(readonly reason: ReadingFailureReason) { super(reason); }
}
async function timed(call: () => Promise<unknown>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([call(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new ReadingCallFailure('timeout')), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}
// Only an explicit numeric HTTP status on the binding's structured rejection
// is available here. Error text, response content and the app's own 503 are
// never used to infer an upstream status; accessors are never invoked.
function structuredProviderStatus(error: unknown): number | 'unavailable' {
  if (!error || typeof error !== 'object') return 'unavailable';
  try {
    const statuses = ['status', 'statusCode'].map(key => Object.getOwnPropertyDescriptor(error, key))
      .filter(descriptor => descriptor && Object.hasOwn(descriptor, 'value')).map(descriptor => descriptor!.value);
    if (!statuses.length || statuses.some(status => !Number.isInteger(status) || status < 100 || status > 599)
      || new Set(statuses).size !== 1) return 'unavailable';
    return statuses[0] as number;
  } catch { return 'unavailable'; }
}

function localized(language: string, kind: 'emotion' | 'new_topic' | 'medical' | 'boundary' | 'danger' | 'error' | 'budget' | 'ai_disabled') {
  const texts = {
    vi: {
      emotion: 'Cảm ơn bạn đã chia sẻ cảm xúc này. Mình đang lắng nghe; bạn có thể dành một nhịp dịu dàng cho bản thân, không cần rút thêm bài đâu.',
      new_topic: 'Mình có thể cùng bạn nhìn chuyện mới này trong một phiên riêng. Phần đọc bài hiện tại vẫn được giữ. Bạn muốn bắt đầu phiên mới chứ?',
      medical: 'Tarot không thể xác định nguyên nhân triệu chứng hay chẩn đoán sức khỏe. Bạn có thể trao đổi với bác sĩ về điều đang lo; mình có thể cùng bạn chuẩn bị câu hỏi hoặc nhìn lại cách chăm sóc bản thân.',
      boundary: 'Lá bài là gợi ý để tự suy ngẫm, không thể biết suy nghĩ hay chuyện riêng của người khác, bảo đảm tương lai hoặc quyết định chuyên môn thay bạn. Mình có thể giúp bạn nhìn lại dữ kiện và một bước trong tầm tay.',
      danger: 'Lúc này, an toàn của bạn và người liên quan quan trọng nhất. Nếu có nguy hiểm ngay lúc này, hãy gọi dịch vụ khẩn cấp tại nơi bạn sống hoặc tìm một người tin cậy ở bên. Mình có thể cùng bạn chọn bước tìm hỗ trợ.',
      error: 'AI chưa hoàn tất phần trả lời này. Câu hỏi và các lá bài vẫn được giữ. Bạn có thể thử lại chủ động; ứng dụng sẽ không tự rút lại bài hoặc tự gọi thêm AI.',
      budget: 'AI chưa thể xử lý toàn bộ tin nhắn cùng lịch sử và lá bài trong giới hạn hiện tại. Nội dung vẫn được giữ nguyên; chưa gửi nội dung vượt giới hạn hay tự cắt tin nhắn. Bạn có thể sửa hoặc chia nhỏ tin nhắn; lượt AI đã giữ chỗ vẫn được tính.',
      ai_disabled: 'AI đang tạm nghỉ. Hồ sơ, câu hỏi và bài vẫn được giữ; chưa gọi provider.',
    },
    en: {
      emotion: 'Thank you for sharing how you feel. I’m listening; you can take a gentle moment for yourself without another draw.',
      new_topic: 'We can explore this new topic in a separate session. Your current reading stays saved. Would you like to start a new session?',
      medical: 'Tarot cannot identify the cause of symptoms or diagnose health conditions. A clinician can help with that concern. We can reflect on self-care or prepare questions to ask them.',
      boundary: 'Cards support reflection; they cannot reveal another person’s private thoughts, guarantee the future or make professional decisions for you. We can look at known facts and one practical step.',
      danger: 'Your safety and the safety of others come first. If danger is immediate, contact local emergency services or a trusted person who can stay with you. We can consider a step toward support.',
      error: 'AI did not complete this response. Your question and cards are saved. You may explicitly retry; the app will not redraw cards or automatically call AI.',
      budget: 'AI cannot process this complete message together with the history and cards within the current limit. Your content stays saved; no oversized input was sent or user message silently cut. You can edit or split the message; reserved AI allowance remains counted.',
      ai_disabled: 'AI is paused. Your profile, question and cards stay saved; no provider was called.',
    },
  };
  // Other supported languages use translated templates for zero-generation branches.
  const translated: Record<string, Partial<Record<typeof kind, string>>> = {
    es: { emotion: 'Gracias por compartir cómo te sientes. Te escucho; puedes darte un momento amable sin sacar más cartas.', new_topic: 'Podemos explorar este nuevo tema en otra sesión. La lectura actual sigue guardada. ¿Quieres empezar una sesión nueva?', medical: 'El Tarot no puede identificar causas de síntomas ni diagnosticar. Puedes consultar a un profesional de salud; podemos preparar preguntas o reflexionar sobre tu cuidado.', boundary: 'Las cartas ayudan a reflexionar; no revelan pensamientos privados ni garantizan el futuro ni toman decisiones profesionales. Podemos revisar los hechos y un paso práctico.', danger: 'La seguridad es lo primero. Si hay peligro inmediato, contacta a emergencias locales o a una persona de confianza.', error: 'La IA no completó la respuesta. Tu pregunta y cartas siguen guardadas. Puedes reintentar; no habrá nuevas cartas ni reintentos automáticos.' },
    fr: { emotion: 'Merci de partager ce que vous ressentez. Je vous écoute; prenez un moment doux pour vous sans tirer d’autres cartes.', new_topic: 'Nous pouvons explorer ce nouveau sujet dans une autre séance. La lecture actuelle reste enregistrée. Souhaitez-vous commencer une nouvelle séance ?', medical: 'Le Tarot ne peut expliquer les causes de symptômes ni poser un diagnostic. Consultez un professionnel de santé; nous pouvons préparer des questions ou réfléchir à votre bien-être.', boundary: 'Les cartes aident à réfléchir; elles ne révèlent pas les pensées privées et ne garantissent ni l’avenir ni une décision professionnelle. Regardons les faits et une action possible.', danger: 'La sécurité passe avant tout. En cas de danger immédiat, contactez les secours locaux ou une personne de confiance.', error: 'L’IA n’a pas terminé la réponse. Votre question et vos cartes restent enregistrées. Vous pouvez réessayer; aucun nouveau tirage ni appel automatique.' },
    ja: { emotion: '気持ちを伝えてくれてありがとうございます。お話を聴いています。追加のカードを引かず、自分に優しい時間をとってください。', new_topic: '新しい話題は別のセッションで考えられます。今のリーディングは保存されています。新しいセッションを始めますか？', medical: 'タロットでは症状の原因や診断は分かりません。医療の専門家に相談できます。セルフケアを考えたり、相談する質問を一緒に準備できます。', boundary: 'カードは振り返りのためのものです。他人の私的な考えや確実な未来、専門的な判断を示しません。分かっている事実と小さな行動を考えましょう。', danger: 'まず安全を優先してください。差し迫った危険がある場合は、地域の緊急窓口や信頼できる人に連絡してください。', error: 'AIの回答が完了しませんでした。質問とカードは保存されています。必要なら再試行できます。自動でカードを引き直したりAIを呼び出したりしません。' },
    zh: { emotion: '谢谢你分享此刻的感受。我在认真听你说；给自己一点温柔的时间，不需要再抽牌。', new_topic: '我们可以在新会话里讨论这个新话题。目前的解读仍已保存。你想开始新会话吗？', medical: '塔罗无法判断症状原因或作出诊断。你可以咨询医疗专业人员；我们也可以一起思考自我照顾或准备咨询问题。', boundary: '牌只帮助反思，不能知道他人的私密想法、保证未来或代替专业决定。我们可以看看已知事实和一个实际步骤。', danger: '安全最重要。如有即时危险，请联系当地急救服务或可信赖的人。', error: 'AI尚未完成回答。问题和牌已保存。你可以主动重试；系统不会自动重新抽牌或调用AI。' },
  };
  return translated[language]?.[kind] ?? (language === 'vi' ? texts.vi : texts.en)[kind];
}

export async function handleReadingAction(request: Request, env: ReadingEnv, raw: unknown) {
  const command: ReadingCommand = validateReadingCommand(raw);
  let replyProvider: ReplyProviderConfig | undefined;
  if (env.AI_ENABLED === 'true' && MODEL_ACTIONS.has(command.action)) {
    try { replyProvider = resolveReplyProvider(env); }
    catch {
      const message = command.action === 'followup' || command.action === 'suggest_spread' ? command.payload.message
        : command.action === 'save_context' ? command.payload.question : undefined;
      const safety = typeof message === 'string' ? preflightChat(message, MAX_ESTABLISHED_MESSAGE_CHARS) : null;
      if (!safety || safety.verdict === 'pass' || !['template', 'skip'].includes(safety.action)) {
        return { data: { ok: false, requestId: command.requestId, mode: 'unavailable', reason: 'reply_configuration_invalid',
          message: 'AI chưa được cấu hình phù hợp. Chưa gọi AI; bạn có thể gửi lại sau.', retryable: false, inferenceCalls: 0, reservedAttempts: 0 }, status: 503 };
      }
    }
  }
  const sessionId = readingSessionId(request) ?? crypto.randomUUID();
  const cookie = `tripp_session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`;
  if (!readingSessionId(request) && ['suggest_spread', 'save_context', 'interpret', 'followup', 'propose_extra'].includes(command.action)) {
    return { data: { ok: false, requestId: command.requestId, reason: 'session_initialization_required', retryable: true,
      message: 'Phiên đã được khởi tạo. Bạn có thể gửi lại yêu cầu này; chưa gọi AI.', inferenceCalls: 0, reservedAttempts: 0 }, status: 409, cookie };
  }
  const now = Date.now();
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tripp:${Math.floor(now / 3600000)}:${request.headers.get('cf-connecting-ip') ?? 'local'}`));
  const ipKey = [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const begin = await call(env, '/reading-begin', { sessionId, ipKey, now, command, aiEnabled: env.AI_ENABLED === 'true' }) as unknown as BeginResult;
  if (!begin.ok) return { data: { ok: false, requestId: command.requestId, reason: begin.reason, retryable: ['busy', 'rate_limit'].includes(begin.reason ?? '') }, status: begin.reason === 'busy' || begin.reason === 'rate_limit' ? 429 : 409, cookie };
  if (begin.cached || !begin.model) return { data: safeResponse(begin.response ?? {}, command.action), status: Number(begin.response?.status ?? 200), cookie };
  const reading = begin.reading!; const candidate = begin.candidate!; const history = begin.history!;
  const message = command.action === 'propose_extra' ? JSON.stringify(command.payload) : command.action === 'suggest_spread' || command.action === 'followup' ? String(command.payload.message) : candidate.context?.question ?? '';
  let attempted = 0, successful = 0, inputs = 0, outputs = 0;
  const language = reading.profile?.language ?? 'vi';
  let next = structuredClone(command.action === 'save_context' ? { ...candidate, step: 'context' as const } : reading);
  let stage: ReadingFailureDiagnostics['stage'] = 'decision';
  let replyBranch: DiagnosticReplyBranch = 'not_selected';
  let providerStatus: number | 'unavailable' = 'unavailable';
  let outputRejection: ({ gate: ReadingOutputRejection } & ReadingOutputDiagnostics) | undefined;
  const establishedConversation = command.action === 'followup' && hasEstablishedReadingContext(reading);
  const establishedDecision = ['followup', 'propose_extra'].includes(command.action) && hasEstablishedReadingContext(reading);
  const supplementalOfferAvailable = reading.step === 'interpreted' && Boolean(reading.interpretation) && !reading.extraCards.length;
  const checkAuthorization = async () => {
    const current = await call(env, '/reading-check', { sessionId, requestId: command.requestId, ticket: begin.ticket, now: Date.now() });
    if (!current.ok) throw new ReadingCallFailure('session_changed');
  };
  const finish = async (response: Record<string, unknown>, retryable = false) => {
    const completed = await call(env, '/reading-finish', { sessionId, requestId: command.requestId, ticket: begin.ticket, now, completedAt: Date.now(),
      reading: next, response: sanitizeReadingFailureResponse({ ...response, requestId: command.requestId, inferenceCalls: attempted, reservedAttempts: begin.reservedAttempts }, command.action),
      successfulCalls: successful, rejectedCalls: attempted - successful, inputTokens: inputs, outputTokens: outputs, retryable });
    if (!completed.ok) return { data: { ok: false, requestId: command.requestId, reason: completed.reason, message: localized(language, 'error'), retryable: false, inferenceCalls: attempted, reservedAttempts: begin.reservedAttempts }, status: 409, cookie };
    return { data: safeResponse(completed.response as Record<string, unknown>, command.action), status: Number(response.status ?? 200), cookie };
  };
  if (env.AI_ENABLED !== 'true') return finish({ ok: false, mode: 'unavailable', reason: 'ai_disabled', message: localized(language, 'ai_disabled'), status: 503, retryable: true }, true);
  try {
    const preflight = preflightChat(message, establishedConversation ? MAX_ESTABLISHED_MESSAGE_CHARS : MAX_QUESTION_CHARS);
    if (preflight.verdict !== 'pass' && ['template', 'skip'].includes(preflight.action)) {
      return finish({ ok: true, mode: 'safety', reason: preflight.reason, message: localized(language, preflight.reason.startsWith('crisis') ? 'danger' : 'boundary'), status: 200 });
    }
    const contextSnapshots = await resolvePublishedContextFlows(env);
    const contextPreflight = preflightContextOptions(contextSnapshots);
    // Baseline keeps its established admission probe. Configurable v2 feeding
    // fits against a conservative universal probe before routing; the selected
    // branch is measured again with its pinned instructions and native schema.
    const buildBudgetInput = (options: typeof contextPreflight) => buildReadingMessages(message, command.action === 'save_context' ? candidate : reading, history,
      contextPreflight?.history ? 'budget_probe' : command.action === 'interpret' ? reading.step === 'ready_to_extra_interpret' ? 'extra_interpret' : 'interpret'
        : command.action === 'save_context' ? 'budget_probe_context' : command.action === 'propose_extra' ? 'budget_probe_supplement'
          : establishedConversation ? 'budget_probe_established' : 'budget_probe_followup',
      { intent: 'emotional_support', risk: 'crisis_self_harm', topic: 'general', language: 'other', spread: 'yearly', extra_count: 'none', domain: 'in_domain', knowledgeGoal: contextPreflight?.history ? 'applications' : 'none', knowledgeAreas: contextPreflight?.history ? 'general' : 'none' }, options);
    const budgetInput = buildBudgetInput(contextPreflight);
    checkContextFlowPreflight(contextSnapshots, budgetInput.bytes);
    const omissionPreflight = preflightOmissionOptions(contextSnapshots, contextPreflight);
    if (omissionPreflight) checkContextFlowPreflight(contextSnapshots, buildBudgetInput(omissionPreflight).bytes);
    const decisionInput = buildReadingDecisionInput(message, command.action === 'save_context' ? candidate : reading, history,
      command.action === 'interpret' ? 'interpret' : establishedDecision ? 'established' : 'conversation');
    const binding = env.AI as unknown as { run(model: string, payload: unknown): Promise<unknown> };
    const runProvider = async (dispatch: () => Promise<unknown>, timeoutMs: number) => {
      try { return await timed(dispatch, timeoutMs); }
      catch (error) {
        providerStatus = structuredProviderStatus(error);
        throw error instanceof ReadingCallFailure ? error : new ReadingCallFailure('provider_error');
      }
    };
    await checkAuthorization();
    attempted++;
    const classified = await runProvider(() => binding.run(DECISION_MODEL, decisionInput.payload), 7000);
    const decisionUsage = usage(classified); inputs += decisionUsage.input; outputs += decisionUsage.output;
    const semantic = parseReadingDecision(classified, decisionInput.mode);
    if (!semantic) throw new ReadingCallFailure('output_gate');
    successful++;
    const replyLanguage = semantic.language === 'other' ? language : semantic.language;
    // Language is an explicit conversational preference; DOB never infers it.
    if (next.profile) next.profile.language = replyLanguage as typeof next.profile.language;
    if (semantic.risk !== 'none') return finish({ ok: true, mode: 'safety', reason: semantic.risk,
      message: localized(replyLanguage, semantic.risk === 'medical' ? 'medical' : semantic.risk.startsWith('crisis') ? 'danger' : 'boundary'), status: 200 });
    if (decisionInput.mode === 'conversation' && semantic.domain === 'off_topic') return finish({ ok: true, mode: 'redirect', reason: 'off_topic', message: offTopicRedirect(replyLanguage), status: 200 });
    if (command.action === 'save_context' && semantic.intent !== 'ambiguous') {
      next = candidate; if (next.profile) next.profile.language = replyLanguage as typeof next.profile.language;
      return finish({ ok: true, mode: 'ready', message: replyLanguage === 'vi' ? 'Mình đã giữ câu hỏi và ngữ cảnh. Khi sẵn sàng, bạn hãy rút bài rồi lật đủ các lá nhé.' : 'Your question and context are saved. Draw when ready, then flip every card.', status: 200 });
    }
    const newReadingOffer = establishedConversation && semantic.intent === 'suggest_spread' && semantic.spread !== 'none';
    if (newReadingOffer) {
      next.newSessionOffered = true;
    }
    if (command.action === 'propose_extra' && (semantic.intent !== 'supplement' || semantic.extra_count === 'none')) return finish({ ok: true, mode: 'clarification', reason: 'extra_not_helpful', message: replyLanguage === 'vi' ? 'Mình có thể làm rõ phần đọc bài đang có trước. Bạn muốn hiểu sâu hơn điểm nào?' : 'We can clarify the existing reading first. Which point would you like to explore?', status: 200 });
    stage = 'reply';
    const allowProposal = supplementalOfferAvailable && semantic.intent === 'supplement' && semantic.extra_count !== 'none'
      && ['followup', 'propose_extra'].includes(command.action);
    const branch = command.action === 'interpret' ? reading.step === 'ready_to_extra_interpret' ? 'extra_interpret' : 'interpret'
      : establishedConversation ? newReadingOffer ? 'new_reading_offer' : allowProposal ? 'supplement' : 'conversation' : semantic.intent;
    replyBranch = diagnosticReplyBranch(branch);
    const inputReading = command.action === 'save_context' ? { ...candidate, step: 'context' as const } : next;
    const configuredBranch = branch === 'knowledge' && semantic.knowledgeGoal === 'practical' ? 'practical' : branch;
    const replyInput = buildReadingMessages(message, inputReading, history, branch, semantic,
      publishedContextOptions(contextSnapshots, configuredBranch));
    const configuredReply = applyPublishedContextFlow(contextSnapshots,
      configuredBranch,
      replyLanguage, replyInput.messages, replyInput.replySchema);
    // Reset/expiry can occur while Clef is awaiting its provider. Revalidate the
    // private lease before disclosing any profile/history to the next stage.
    await checkAuthorization();
    attempted++;
    const generated = await runProvider(() => runReplyProvider(env, replyProvider ?? resolveReplyProvider(env), configuredReply.messages, 0.5, replyInput.replySchema), 30000);
    const replyUsage = usage(generated); inputs += replyUsage.input; outputs += replyUsage.output;
    const parsed = parseReadingReplyResult(generated, allowProposal, replyInput.outputContract,
      replyInput.groundingFacts, replyInput.readingMetadata);
    if (!parsed.ok) {
      outputRejection = { gate: parsed.reason, ...(parsed.outputPart ? { outputPart: parsed.outputPart } : {}),
        ...(parsed.reason === 'unsupported_private_fact' && parsed.privateFactRule ? { privateFactRule: parsed.privateFactRule } : {}) };
      console.log('reading_output_rejected', JSON.stringify({ requestId: command.requestId, action: command.action, replyBranch, gate: parsed.reason,
        ...(parsed.outputPart ? { outputPart: parsed.outputPart } : {}), ...(parsed.privateFactRule ? { privateFactRule: parsed.privateFactRule } : {}) }));
      throw new ReadingCallFailure('output_gate');
    }
    const reply = parsed.value;
    if (command.action === 'save_context') { successful++; next = inputReading; return finish({ ok: true, mode: 'clarification', reason: 'question_ambiguous', message: reply.reply, ...(reply.quickOptions?.length ? { quickOptions: reply.quickOptions, quickOptionsLanguage: replyLanguage, quickOptionsReadingId: next.id } : {}),
      ...(configuredReply.snapshot ? { contextFlow: configuredReply.snapshot } : {}), status: 200 }); }
    if (command.action === 'interpret') {
      next.step = 'interpreted';
      next.interpretation = branch === 'extra_interpret' ? `${next.interpretation}\n\n${reply.reply}` : reply.reply;
      next.summary = summarizeChat(next.summary, message, reply.reply, true);
    }
    if (reply.proposal) {
      if (semantic.extra_count === 'none' || (reply.proposal.count === 2 && semantic.extra_count !== 'two')) throw new ReadingCallFailure('output_gate');
      next = applyReadingAction(next, { requestId: command.requestId, action: 'propose_extra', payload: reply.proposal }, Date.now());
    } else if (semantic.intent === 'supplement' && command.action === 'propose_extra') throw new ReadingCallFailure('output_gate');
    if (command.action === 'suggest_spread' && semantic.intent === 'suggest_spread' && semantic.spread !== 'none') {
      next = applyReadingAction(next, { requestId: command.requestId, action: 'select_spread', payload: { spreadId: semantic.spread } }, Date.now());
      next.context = { question: message, topic: semantic.topic };
    }
    successful++;
    return finish({ ok: true, mode: reply.proposal ? 'extra_offer' : newReadingOffer ? 'new_session_offer' : 'ai', message: reply.reply, ...(reply.quickOptions?.length ? { quickOptions: reply.quickOptions, quickOptionsLanguage: replyLanguage, quickOptionsReadingId: next.id } : {}),
      ...(configuredReply.snapshot ? { contextFlow: configuredReply.snapshot } : {}),
      suggestedSpreadId: (newReadingOffer || command.action === 'suggest_spread' && semantic.intent === 'suggest_spread') && semantic.spread !== 'none' ? semantic.spread : null, status: 200 });
  } catch (error) {
    const reason = error instanceof Error && error.message === 'context_flow_unavailable' ? 'context_configuration' : error instanceof ReadingCallFailure ? error.reason
      : error instanceof Error ? READING_FAILURE_REASONS.find(reason => reason === error.message) ?? 'provider_error' : 'provider_error';
    // Operational metadata only: no names, DOB, chat, profile, prompts or replies.
    console.log('reading_call_failed', JSON.stringify({ requestId: command.requestId, action: command.action, stage, replyBranch, reason, attempted, successful, providerStatus, decisionVersion: READING_DECISION_VERSION }));
    next = command.action === 'save_context' ? { ...candidate, step: 'context' } : reading;
    const failureDiagnostics: ReadingFailureDiagnostics = { version: 1, action: command.action, stage, reason, replyBranch, providerStatus,
      ...(reason === 'output_gate' ? outputRejection : {}) };
    return finish({ ok: false, mode: 'unavailable', reason: `${stage}_${reason}`, failureDiagnostics, message: localized(language, reason === 'context_budget' ? 'budget' : 'error'), retryable: reason !== 'context_budget', status: 503 }, reason !== 'context_budget');
  }
}
