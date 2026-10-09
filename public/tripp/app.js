"use strict";

const byId = (id) => document.getElementById(id);
const elements = {
  form: byId("chat-form"), input: byId("message-input"), send: byId("send-button"), error: byId("form-error"),
  errorPanel: byId("error-panel"), retry: byId("retry-button"), cancelRetry: byId("cancel-retry"),
  messages: byId("messages"), scroll: byId("conversation-scroll"), empty: byId("empty-state"), panel: byId("step-panel"), status: byId("flow-status"),
  menuButton: byId("menu-button"), menu: byId("chat-menu"), reset: byId("reset-button"), newButton: byId("new-button"), language: byId("language"),
  privacy: byId("privacy-dialog"), resetDialog: byId("reset-dialog"),
  quickOptions: byId("quick-options"), quickOptionsList: byId("quick-options-list"),
  buildInfo: byId("build-info"),
};
const state = { busy: false, loading: true, reading: null, history: { turns: [] }, spreads: [], language: "vi", pending: null, contextDraft: null, newConfirm: false, provisionalMessage: null, suggestedSpreadId: null, automaticReadings: new Set(), minIntervalMs: 2000, lastModelResponseAt: 0, resumeReading: false, resumeRequest: null, quickOptions: null, quickOptionsGeneration: 0, optionDraft: null, buildInfo: null, clientToolPending: null, clientToolGeneration: 0, clientToolError: false, spreadOfferDismissed: false };
const SPREAD_PICKER_CAPABILITY = Object.freeze({ name: "ui.open_spread_picker", version: 1, schemaId: "tripp.ui.open-spread-picker.v1" });
const SPREAD_OFFER_DISMISSAL_KEY = "tripp-spread-offer-dismissed";
const MODEL_ACTIONS = new Set(["suggest_spread", "save_context", "interpret", "followup", "propose_extra"]);
const INITIAL_MESSAGE_CHARS = 600;
const ESTABLISHED_MESSAGE_CHARS = 10000;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FAILURE_CODES = {
  stage: new Set(["decision", "reply"]),
  reason: new Set(["timeout", "output_gate", "context_budget", "context_configuration", "all_cards_must_be_flipped", "session_changed", "provider_error"]),
  replyBranch: new Set(["not_selected", "interpret", "extra_interpret", "new_reading_offer", "conversation", "suggest_spread", "clarify_reading", "emotional_support", "new_topic", "supplement", "knowledge", "ambiguous"]),
  gate: new Set(["provider_envelope", "malformed_json", "unexpected_keys", "invalid_reply", "invalid_proposal", "card_contract", "context_references", "field_bounds", "unsafe_text", "rendered_bounds", "empty", "length", "controls", "markup", "unsafe_claim", "unsupported_private_fact", "knowledge_contract", "metadata_claim"]),
  outputPart: new Set(["plain_reply", "proposal", "key_point", "card_application", "next_step", "knowledge_application", "knowledge_question", "combined_dynamic_text", "rendered_body"]),
  privateFactRule: new Set(["birth_derived", "other_person_state", "relationship_state", "user_state", "user_history", "user_ability", "relative_personal_past", "presupposed_recovery"]),
};
const errorRequestId = node("small", "error-request-id");
errorRequestId.id = "error-request-id"; errorRequestId.dataset.testid = "error-request-id"; errorRequestId.hidden = true;
const errorDiagnostics = node("small", "error-diagnostics");
errorDiagnostics.id = "error-diagnostics"; errorDiagnostics.dataset.testid = "error-diagnostics"; errorDiagnostics.hidden = true;
elements.errorPanel.append(errorRequestId, errorDiagnostics);
const text = (value, limit = 6000) => typeof value === "string" ? value.slice(0, limit) : "";
const t = (vi, en) => state.language === "en" ? en : vi;
const localized = (value) => typeof value === "string" ? value : text(value?.[state.language] || value?.vi || value?.en);
const dateToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

function node(tag, className, content) {
  const element = document.createElement(tag); if (className) element.className = className; if (content !== undefined) element.textContent = content; return element;
}
function button(label, action, className = "primary-button", testId) {
  const element = node("button", className, label); element.type = "button"; element.disabled = state.busy;
  if (testId) element.dataset.testid = testId;
  element.addEventListener("click", action); return element;
}
function hasConversationContext() {
  const reading = state.reading;
  return Boolean(reading?.profile && Number.isSafeInteger(reading.profile.dataUseAcceptedAt)
    && reading.profile.dataUseAcceptedAt >= 0 && text(reading.context?.question, 600).trim()
    && ["ready_to_draw", "flipping", "ready_to_interpret", "interpreted", "extra_consent", "extra_flipping", "ready_to_extra_interpret"].includes(reading.step));
}
function messageLimit() { return hasConversationContext() ? ESTABLISHED_MESSAGE_CHARS : INITIAL_MESSAGE_CHARS; }
function ownValue(value, key) {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && Object.hasOwn(descriptor, "value") ? descriptor.value : undefined;
}
function normalizedQuickOptions(value) {
  try {
    if (!Array.isArray(value)) return [];
    const options = [];
    for (let index = 0; index < Math.min(value.length, 5); index++) {
      const candidate = ownValue(value, String(index));
      if (typeof candidate !== "string") continue;
      const option = candidate.trim();
      const characters = Array.from(option);
      if (!option || characters.length > 180 || new TextEncoder().encode(option).length > 512
        || characters.some(character => { const code = character.codePointAt(0); return code < 32 || code >= 127 && code <= 159 || code >= 0xd800 && code <= 0xdfff; })
        || /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>`*_#[\]]/u.test(option)
        || /(?:https?:\/\/|www\.|javascript:|data:)|\b[a-z0-9-]+\.(?:com|org|net|io|ai|vn|app|dev|co)(?:\/|\b)/iu.test(option)
        || options.some(existing => existing.normalize("NFC").toLocaleLowerCase() === option.normalize("NFC").toLocaleLowerCase())) continue;
      options.push(option);
    }
    return options;
  } catch { return []; }
}
function clearQuickOptions() {
  state.quickOptionsGeneration++; state.quickOptions = null; state.optionDraft = null; renderQuickOptions();
}
function acceptQuickOptions(value, fresh = false) {
  try {
    const options = normalizedQuickOptions(ownValue(value, "quickOptions"));
    const language = ownValue(value, "quickOptionsLanguage");
    const readingId = ownValue(value, "quickOptionsReadingId");
    if (!options.length || !["vi", "en", "es", "fr", "ja", "zh", "other"].includes(language)
      || !fresh && language !== state.language || readingId !== (state.reading?.id ?? null)) return;
    state.quickOptions = { options, language: state.language, readingId };
  } catch { /* Optional suggestions never prevent a reply from being shown. */ }
}
function renderQuickOptions() {
  elements.quickOptionsList.replaceChildren();
  byId("quick-options-label").textContent = t("Chọn một gợi ý hoặc tự viết bên dưới", "Choose a suggestion or write your own below");
  const current = state.quickOptions;
  const hidden = !current || state.busy || state.loading || Boolean(state.pending) || state.newConfirm || elements.input.disabled
    || current.language !== state.language || current.readingId !== (state.reading?.id ?? null);
  elements.quickOptions.hidden = hidden;
  if (hidden) return;
  const generation = state.quickOptionsGeneration;
  current.options.forEach((option, index) => {
    const choice = button(option, () => {
      if (state.quickOptions !== current || generation !== state.quickOptionsGeneration || state.busy || state.loading
        || state.pending || elements.input.disabled || elements.input.value && elements.input.value !== state.optionDraft) return;
      elements.input.value = option; state.optionDraft = option; clearError(); resizeInput(); elements.input.focus(); renderQuickOptions();
    }, "quick-option", `quick-option-${index}`);
    choice.disabled = Boolean(elements.input.value && elements.input.value !== state.optionDraft);
    elements.quickOptionsList.append(choice);
  });
}
function setBusy(busy) {
  state.busy = busy; const step = state.reading?.step; const chatAllowed = !step || step === "select_spread" || hasConversationContext();
  elements.input.disabled = busy || state.loading || !chatAllowed || Boolean(state.pending); elements.send.disabled = elements.input.disabled;
  elements.language.disabled = busy || state.loading || Boolean(state.pending); elements.reset.disabled = busy; elements.newButton.disabled = busy || !state.reading;
  elements.retry.disabled = busy || state.loading; elements.cancelRetry.disabled = busy || state.loading;
  elements.form.setAttribute("aria-busy", String(busy)); elements.panel.setAttribute("aria-busy", String(busy || state.loading));
  for (const control of elements.panel.querySelectorAll("button, input, select, textarea")) {
    control.disabled = busy || Boolean(state.pending) || control.dataset.locked === "true";
  }
  renderQuickOptions();
}
function failureDiagnostics(value, action, reason) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null) {
      const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor");
      if (!constructor || !Object.hasOwn(constructor, "value") || typeof constructor.value !== "function"
        || Function.prototype.toString.call(constructor.value) !== Function.prototype.toString.call(Object)
        || constructor.value.prototype !== prototype) return null;
    }
    const required = ["version", "action", "stage", "reason", "replyBranch", "providerStatus"];
    const optional = ["gate", "outputPart", "privateFactRule"];
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== "string" || !required.includes(key) && !optional.includes(key))
      || required.some(key => !keys.includes(key))) return null;
    const diagnostic = {};
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value") || !descriptor.enumerable) return null;
      diagnostic[key] = descriptor.value;
    }
    if (diagnostic.version !== 1 || diagnostic.action !== action || !MODEL_ACTIONS.has(diagnostic.action)
      || diagnostic.providerStatus !== "unavailable" && (!Number.isInteger(diagnostic.providerStatus) || diagnostic.providerStatus < 100 || diagnostic.providerStatus > 599)) return null;
    for (const key of ["stage", "reason", "replyBranch", ...optional.filter(key => keys.includes(key))]) {
      if (!FAILURE_CODES[key].has(diagnostic[key])) return null;
    }
    if (reason !== undefined && reason !== `${diagnostic.stage}_${diagnostic.reason}`) return null;
    if ((diagnostic.gate || diagnostic.outputPart || diagnostic.privateFactRule)
      && (diagnostic.stage !== "reply" || diagnostic.reason !== "output_gate")) return null;
    if (diagnostic.outputPart && !diagnostic.gate || diagnostic.privateFactRule && diagnostic.gate !== "unsupported_private_fact") return null;
    return diagnostic;
  } catch { return null; }
}
function clearError() { elements.errorPanel.hidden = true; elements.error.textContent = ""; errorRequestId.textContent = ""; errorRequestId.hidden = true; errorDiagnostics.textContent = ""; errorDiagnostics.hidden = true; elements.retry.hidden = true; elements.cancelRetry.hidden = true; }
function renderRetryLabel() {
  const pending = state.pending || state.resumeRequest;
  elements.retry.textContent = state.resumeReading && !pending ? t("Tiếp tục", "Continue")
    : pending?.providerRetry && MODEL_ACTIONS.has(pending.body.action) ? t("Thử lại · thêm hạn mức AI", "Retry · more AI allowance") : t("Thử lại", "Retry");
}
function showError(message, retry = false, failure = state.pending || state.resumeRequest, preserveOptions = false) {
  if (!preserveOptions) clearQuickOptions();
  elements.error.textContent = message; elements.errorPanel.hidden = false; elements.retry.hidden = !retry; elements.cancelRetry.hidden = !retry || !state.pending;
  const requestId = failure?.body.requestId;
  const diagnostic = failureDiagnostics(failure?.failureDiagnostics, failure?.body.action);
  errorRequestId.hidden = !retry && !diagnostic || typeof requestId !== "string" || !REQUEST_ID_PATTERN.test(requestId);
  errorRequestId.textContent = errorRequestId.hidden ? "" : t(`Mã hỗ trợ: ${requestId}`, `Support ID: ${requestId}`);
  errorDiagnostics.hidden = errorRequestId.hidden || !diagnostic;
  errorDiagnostics.textContent = errorDiagnostics.hidden ? "" : t(
    `Chi tiết hỗ trợ · Hành động: ${diagnostic.action} · Giai đoạn: ${diagnostic.stage} · Lý do: ${diagnostic.reason} · Nhánh: ${diagnostic.replyBranch} · Kiểm tra: ${diagnostic.gate || "unavailable"} · Trường: ${diagnostic.outputPart || "unavailable"} · Quy tắc: ${diagnostic.privateFactRule || "unavailable"} · Trạng thái nhà cung cấp: ${diagnostic.providerStatus}`,
    `Support details · Action: ${diagnostic.action} · Stage: ${diagnostic.stage} · Reason: ${diagnostic.reason} · Branch: ${diagnostic.replyBranch} · Check: ${diagnostic.gate || "unavailable"} · Field: ${diagnostic.outputPart || "unavailable"} · Rule: ${diagnostic.privateFactRule || "unavailable"} · Provider status: ${diagnostic.providerStatus}`);
  renderRetryLabel();
}
function scrollToLatest() { elements.scroll.scrollTop = elements.scroll.scrollHeight; }
function showCurrentStep() { elements.panel.scrollIntoView({ block: "start" }); elements.panel.focus({ preventScroll: true }); }
function resizeInput() { elements.input.style.height = "auto"; elements.input.style.height = `${Math.min(132, elements.input.scrollHeight)}px`; }
function addMessage(author, message) {
  const row = node("article", `message-row ${author}`); row.setAttribute("aria-label", author === "user" ? t("Bạn", "You") : "TRIPP");
  if (author === "assistant") row.append(node("span", "message-author", "TRIPP")); row.append(node("div", "message-bubble", message)); elements.messages.append(row);
}
function renderHistory() {
  elements.messages.replaceChildren();
  for (const turn of state.history?.turns || []) {
    if (typeof turn.user === "string" && turn.user) addMessage("user", turn.user);
    const readinessNotice = ["ready_to_draw", "flipping", "ready_to_interpret"].includes(state.reading?.step)
      && !state.reading.interpretation && turn.terminalStatus === "completed" && turn.user === state.reading.context?.question
      && ["Mình đã giữ câu hỏi và ngữ cảnh. Khi sẵn sàng, bạn hãy rút bài rồi lật đủ các lá nhé.", "Your question and context are saved. Draw when ready, then flip every card."].includes(turn.assistant);
    if (text(turn.assistant) && turn.terminalStatus !== "unavailable" && !readinessNotice) addMessage("assistant", text(turn.assistant));
  }
  if (state.provisionalMessage && !(state.history?.turns || []).some(turn => turn.messageId === state.pending?.body.requestId)) addMessage("user", state.provisionalMessage);
  elements.empty.hidden = elements.messages.children.length > 0 || Boolean(state.reading && state.reading.step !== "select_spread");
}
function privacyCopy() {
  return t("Tên gọi, ngày sinh đầy đủ, hoàn cảnh bạn chia sẻ, bài đã rút và cuộc trò chuyện được dùng để giữ mạch phiên và cá nhân hóa cách diễn giải. Chúng có thể được gửi tới Cloudflare Workers AI để xử lý; khi dùng GPT-6 Luna, dữ liệu cũng được gửi tới OpenAI qua Cloudflare AI Gateway. Ngày sinh không dùng để suy ra tính cách, sức khỏe hay chuyện riêng tư. Phiên được lưu trên máy chủ Cloudflare tối đa 24 giờ; 100 tin nhắn gần nhất của bạn được giữ nguyên văn. Khi gửi cho AI, phần lịch sử cũ có thể dùng trích đoạn rút gọn có đánh dấu để vừa giới hạn xử lý. Tránh chia sẻ thông tin của người khác khi chưa được phép. Bạn có thể xóa hồ sơ và nội dung trong menu. Số lượt đã dùng và mã kỹ thuật chống trả lời lặp được giữ, không chứa hồ sơ hay nội dung.", "Your preferred name, full birth date, shared context, drawn cards and conversation keep this session coherent and personalize the wording. They may be sent to Cloudflare Workers AI for processing; when GPT-6 Luna is used, data also goes to OpenAI through Cloudflare AI Gateway. Your birth date is never used to infer personality, health or private facts. Sessions are stored on Cloudflare servers for up to 24 hours. Your latest 100 messages stay verbatim in the session. Older history may use explicitly marked excerpts when sent to AI to fit the processing limit. Avoid sharing another person's information without permission. Delete your profile and conversation in the menu. Usage counters and content-free technical request IDs are retained.");
}
function renderLanguage() {
  document.documentElement.lang = state.language; elements.language.value = state.language;
  byId("welcome-eyebrow").textContent = t("MỘT KHOẢNG NHỎ CHO BẠN", "A LITTLE SPACE FOR YOU");
  byId("welcome-title").textContent = t("Một chút dịu dàng,\nmột góc nhìn mới.", "A softer moment.\nA fresh perspective.");
  byId("welcome-description").textContent = t("Bạn mang theo câu hỏi. Mình cùng lắng nghe.\nTarot là một cách suy ngẫm, không phải lời hứa về tương lai.", "Bring what is on your mind. Let's reflect together.\nTarot offers symbols to explore, never a promise about the future.");
  elements.input.placeholder = hasConversationContext() ? t("Bạn muốn kể thêm điều gì?", "What would you like to share?") : t("Điều gì đang ở trong lòng bạn?", "What is on your mind?"); elements.send.setAttribute("aria-label", t("Gửi tin nhắn", "Send message"));
  if (hasConversationContext()) elements.input.removeAttribute("maxlength");
  else elements.input.maxLength = INITIAL_MESSAGE_CHARS;
  elements.messages.setAttribute("aria-label", t("Cuộc trò chuyện", "Conversation")); elements.panel.setAttribute("aria-label", t("Bước tiếp theo", "Next step"));
  elements.menuButton.setAttribute("aria-label", t("Tùy chọn trò chuyện", "Conversation options"));
  byId("privacy-button").textContent = t("Hồ sơ & quyền riêng tư", "Profile & privacy"); elements.newButton.textContent = t("Một trải bài mới", "Start a new reading"); elements.reset.textContent = t("Xóa hồ sơ & cuộc trò chuyện", "Delete profile & conversation");
  byId("privacy-title").textContent = t("Bạn biết mình đang chia sẻ gì", "Know what you share"); byId("privacy-content").textContent = privacyCopy();
  byId("reset-title").textContent = t("Xóa phiên này?", "Delete this session?"); byId("reset-description").textContent = t("Hồ sơ, ngày sinh, bài đã rút và nội dung trò chuyện sẽ được xóa. Số lượt đã dùng và mã kỹ thuật không chứa nội dung vẫn giữ.", "Your profile, birth date, cards and conversation will be deleted. Usage counters and content-free technical request IDs are retained.");
  byId("reset-cancel").textContent = t("Giữ lại", "Keep session"); byId("reset-confirm").textContent = t("Xóa phiên", "Delete session");
  renderRetryLabel(); elements.cancelRetry.textContent = t("Dừng", "Cancel");
  byId("privacy-note").textContent = t("Hồ sơ và tin nhắn có thể gửi tới Cloudflare Workers AI; khi dùng GPT-6 Luna, dữ liệu cũng được gửi tới OpenAI qua Cloudflare AI Gateway. Phiên được giữ tối đa 24 giờ; bạn có thể xóa bất cứ lúc nào.", "Profile and messages may be sent to Cloudflare Workers AI; when GPT-6 Luna is used, data also goes to OpenAI through Cloudflare AI Gateway. Sessions last up to 24 hours. You can delete them anytime.");
  renderBuildInfo();
}
function acceptPublicConfig(config) {
  const interval = ownValue(config, "minIntervalMs");
  if (Number.isInteger(interval) && interval >= 2000 && interval <= 60000) state.minIntervalMs = interval;
  const version = ownValue(config, "version"); const buildTime = ownValue(config, "buildTime");
  if (typeof version !== "string" || !/^\d{1,3}\.\d{1,3}\.\d{1,3}(?:-[a-z0-9.-]{1,24})?$/u.test(version)) { state.buildInfo = null; return; }
  const validTime = typeof buildTime === "string" && /^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(buildTime)
    && Number.isFinite(Date.parse(buildTime)) && new Date(buildTime).toISOString() === buildTime;
  const buildCommit = ownValue(config, "buildCommit");
  state.buildInfo = { version, buildTime: validTime ? buildTime : null,
    buildCommit: typeof buildCommit === "string" && /^[a-f0-9]{40}$/u.test(buildCommit) ? buildCommit : null };
}
function renderBuildInfo() {
  const build = state.buildInfo; elements.buildInfo.hidden = !build;
  if (!build) { elements.buildInfo.textContent = ""; elements.buildInfo.removeAttribute("title"); elements.buildInfo.removeAttribute("aria-label"); return; }
  const stamp = build.buildTime ? `${build.buildTime.slice(8, 10)}/${build.buildTime.slice(5, 7)} ${build.buildTime.slice(11, 16)}Z` : "";
  elements.buildInfo.textContent = `v${build.version}${stamp ? ` · ${stamp}` : ""}`;
  const metadata = `${build.buildTime ? ` · Build ${build.buildTime}` : ""}${build.buildCommit ? ` · Commit ${build.buildCommit}` : ""}`;
  const label = t(`Phiên bản ${build.version}${metadata}`, `Version ${build.version}${metadata}`);
  elements.buildInfo.setAttribute("title", label); elements.buildInfo.setAttribute("aria-label", label);
}
function clientToolSnapshot() {
  return JSON.stringify([state.reading?.id ?? null, state.reading?.updatedAt ?? null, state.history.turns?.at(-1)?.messageId ?? null, state.language]);
}
function invalidateClientTool() { state.clientToolGeneration++; state.clientToolPending = null; state.clientToolError = false; }
function contextualSpreadOfferAvailable() {
  return state.reading?.step === "interpreted" && state.reading.newSessionOffered === true && !state.spreadOfferDismissed && !state.newConfirm;
}
function setSpreadOfferDismissed(dismissed) {
  state.spreadOfferDismissed = dismissed;
  try {
    if (dismissed && REQUEST_ID_PATTERN.test(state.reading?.id ?? "")) window.sessionStorage.setItem(SPREAD_OFFER_DISMISSAL_KEY, state.reading.id);
    else window.sessionStorage.removeItem(SPREAD_OFFER_DISMISSAL_KEY);
  } catch { /* In-memory dismissal still keeps chat available when storage is unavailable. */ }
}
function dismissSpreadOffer() { setSpreadOfferDismissed(true); state.newConfirm = false; invalidateClientTool(); render(); }
async function revokeClientTool(registrationId) {
  try { await requestJson("/api/client-tools/revoke", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, registrationId }) }, 12000); }
  catch { /* Expiring server registration never authorizes a draw or an AI call. */ }
}
async function openContextualSpreadOffer(snapshot, generation) {
  if (!contextualSpreadOfferAvailable() || state.busy || state.loading || state.pending || state.clientToolPending
    || generation !== state.clientToolGeneration || snapshot !== clientToolSnapshot()) return;
  const pending = { snapshot, generation }; state.clientToolPending = pending; state.clientToolError = false; render();
  const current = () => state.clientToolPending === pending && pending.generation === state.clientToolGeneration
    && pending.snapshot === clientToolSnapshot() && contextualSpreadOfferAvailable() && !state.busy && !state.loading && !state.pending;
  let registrationId = null; let callSubmitted = false;
  try {
    const registered = await requestJson("/api/client-tools/register", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: 1, capabilities: [SPREAD_PICKER_CAPABILITY] }) }, 12000);
    const data = registered.data; const challenge = data?.consentChallenge;
    if (!registered.response.ok || data?.ok !== true || typeof data.registrationId !== "string" || !REQUEST_ID_PATTERN.test(data.registrationId)
      || !Number.isSafeInteger(data.expiresAt) || data.expiresAt <= Date.now() || data.expiresAt > Date.now() + 301000
      || typeof challenge?.id !== "string" || !REQUEST_ID_PATTERN.test(challenge.id)
      || challenge.capability !== SPREAD_PICKER_CAPABILITY.name || challenge.decision !== "accept") throw new TypeError("invalid_registration");
    registrationId = data.registrationId;
    if (!current()) return;
    const requestId = crypto.randomUUID(); callSubmitted = true;
    const called = await requestJson("/api/client-tools/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      version: 1, requestId, registrationId, capability: SPREAD_PICKER_CAPABILITY.name, schemaId: SPREAD_PICKER_CAPABILITY.schemaId,
      args: {}, consent: { challengeId: challenge.id, decision: "accept" },
    }) }, 12000);
    if (!current()) return;
    if (!called.response.ok || called.data?.ok !== true || called.data.requestId !== requestId || called.data.inferenceCalls !== 0
      || called.data.reservedAttempts !== 0 || called.data.effect?.type !== "open_spread_picker"
      || Object.keys(called.data.effect).length !== 1) throw new TypeError("invalid_client_effect");
    clearQuickOptions(); state.newConfirm = true; state.clientToolGeneration++;
  } catch { if (current()) state.clientToolError = true; }
  finally {
    if (registrationId && !callSubmitted) await revokeClientTool(registrationId);
    if (state.clientToolPending === pending) { state.clientToolPending = null; render(); if (state.newConfirm) showCurrentStep(); }
  }
}
function contextualSpreadOffer() {
  if (!contextualSpreadOfferAvailable()) return;
  const snapshot = clientToolSnapshot(); const generation = state.clientToolGeneration;
  const offer = node("div", "spread-offer"); offer.dataset.testid = "spread-offer";
  offer.append(node("p", "step-description", t("Nếu muốn, bạn có thể mở trải bài mới cho câu hỏi này. Mình vẫn ở đây nếu bạn muốn tiếp tục trò chuyện.", "If you want, you can open a new reading for this question. You can also keep chatting here.")));
  const row = node("div", "button-row");
  const open = button(t("Mở một trải bài mới", "Start a new reading"), () => openContextualSpreadOffer(snapshot, generation), "secondary-button", "new-topic-offer");
  if (state.clientToolPending) { open.disabled = true; open.dataset.locked = "true"; }
  const decline = button(t("Tiếp tục trò chuyện", "Keep chatting"), () => {
    if (contextualSpreadOfferAvailable() && snapshot === clientToolSnapshot() && generation === state.clientToolGeneration && !state.busy && !state.pending) dismissSpreadOffer();
  }, "text-button", "new-topic-decline");
  row.append(open, decline); offer.append(row);
  if (state.clientToolError) { const error = node("p", "client-tool-note", t("Chưa mở được lựa chọn này. Bạn vẫn có thể trò chuyện bên dưới.", "This option could not be opened. You can still chat below.")); error.setAttribute("role", "status"); offer.append(error); }
  elements.panel.append(offer);
}
function heading(title, description) { elements.panel.append(node("h2", "step-title", title)); if (description) elements.panel.append(node("p", "step-description", description)); }
function validSpread(spread) {
  return Boolean(spread && typeof spread.id === "string" && Number.isInteger(spread.count) && spread.count >= 1 && spread.count <= 78 && Array.isArray(spread.positions) && spread.positions.length === spread.count && spread.positions.every(position => position && typeof position.id === "string" && localized(position.label) && localized(position.meaning)) && new Set(spread.positions.map(position => position.id)).size === spread.count);
}
function spreadChoices() {
  heading(t("Bạn muốn xem điều gì?", "What would you like to explore?"), t("Chọn trải bài hoặc trò chuyện bên dưới.", "Choose a spread or chat below."));
  const choices = node("div", "spread-choices");
  for (const spread of state.spreads) {
    if (!validSpread(spread)) continue;
    const choice = button("", () => act("select_spread", { spreadId: spread.id }), `spread-choice${state.suggestedSpreadId === spread.id ? " suggested" : ""}`, `spread-${spread.id}`);
    choice.append(node("span", "choice-title", localized(spread.name)), node("span", "choice-count", t(`${spread.count} lá`, `${spread.count} ${spread.count === 1 ? "card" : "cards"}`)), node("span", "choice-description", localized(spread.description))); choices.append(choice);
  }
  elements.panel.append(choices, node("p", "config-note", t("Số lá tham chiếu mô tả công khai. Ý nghĩa vị trí là cấu hình demo đề xuất khi chưa xác minh đầy đủ với ứng dụng gốc.", "Counts follow the public description. Position meanings are proposed demo configuration where original app details remain unverified.")));
}
function positions(spread) {
  const list = node("ol", "position-list"); for (const position of spread.positions) { const item = node("li"); item.append(node("strong", "", localized(position.label)), node("span", "", localized(position.meaning))); list.append(item); } return list;
}
function field(form, id, label, type = "text", value = "", required = true) {
  const wrapper = node("div", "field"); const labelNode = node("label", "", label); labelNode.htmlFor = id;
  const input = node(type === "textarea" ? "textarea" : "input"); input.id = id; input.name = id; input.dataset.testid = id;
  if (type !== "textarea") input.type = type; input.value = value; input.required = required;
  if (type === "textarea") { input.rows = 3; input.maxLength = 600; } if (type === "text") input.maxLength = 120;
  wrapper.append(labelNode, input); form.append(wrapper); return input;
}
function selectField(form, id, label, choices, value) {
  const wrapper = node("div", "field"); const labelNode = node("label", "", label); labelNode.htmlFor = id;
  const select = node("select"); select.id = id; select.name = id; select.dataset.testid = id;
  for (const [key, name] of choices) { const option = node("option", "", name); option.value = key; select.append(option); } select.value = value;
  wrapper.append(labelNode, select); form.append(wrapper); return select;
}
function submitButton(form, label, testId) { const submit = button(label, () => {}, "primary-button", testId); submit.type = "submit"; form.append(submit); }
function profileStep() {
  heading(t("Mình gọi bạn là gì?", "What shall I call you?"), t("Một chút thông tin để giữ mạch trò chuyện. Bạn quyết định có tiếp tục chia sẻ hay không.", "A little context keeps our conversation coherent. You decide whether to continue sharing."));
  const form = node("form", "step-form"); form.id = "profile-form";
  form.append(node("p", "data-disclosure", privacyCopy()));
  const draft = state.pending?.body.action === "save_profile" ? state.pending.body.payload : {};
  const name = field(form, "profile-name", t("Tên bạn muốn được gọi", "Preferred name"), "text", draft.preferredName || ""); name.autocomplete = "nickname"; name.maxLength = 60;
  const birth = field(form, "profile-birth", t("Ngày sinh đầy đủ", "Full birth date"), "date", draft.birthDate || ""); birth.max = dateToday(); birth.autocomplete = "bday";
  const label = node("label", "consent-label"); const consent = node("input"); consent.type = "checkbox"; consent.id = "profile-consent"; consent.dataset.testid = "profile-consent"; consent.required = true; consent.checked = draft.dataUseAccepted === true;
  label.append(consent, node("span", "", t("Mình đã hiểu và đồng ý cách dùng dữ liệu cho phiên này.", "I understand and agree to this use of my data for this session."))); form.append(label);
  submitButton(form, t("Tiếp tục", "Continue"), "profile-submit");
  form.addEventListener("submit", event => { event.preventDefault(); if (!form.reportValidity()) return; act("save_profile", { preferredName: name.value, birthDate: birth.value, language: state.language, dataUseAccepted: consent.checked }); }); elements.panel.append(form);
}
function contextStep() {
  const reading = state.reading; const id = reading.spread.id;
  const known = { ...reading.knownContext || {}, ...reading.context || {},
    ...(state.contextDraft?.readingId === reading.id ? state.contextDraft.payload : {}),
    ...(state.pending?.body.action === "save_context" ? state.pending.body.payload : {}) };
  heading(t("Câu hỏi của bạn", "Your question"));
  const form = node("form", "step-form"); form.id = "context-form";
  const allTopics = [["general", t("Nhìn lại chung", "General reflection")], ["love", t("Tình cảm", "Relationships")], ["work", t("Công việc", "Work")], ["money", t("Tiền bạc", "Money")], ["self", t("Bản thân", "Personal wellbeing")]];
  const allowedTopics = allTopics.filter(([key]) => id === "love" ? key === "love" : id === "money" ? ["work", "money"].includes(key) : true);
  const fallbackTopic = id === "love" ? "love" : id === "money" ? "money" : "general";
  const defaultTopic = allowedTopics.some(([key]) => key === known.topic) ? known.topic : fallbackTopic;
  const topic = selectField(form, "context-topic", t("Chủ đề", "Topic"), allowedTopics, defaultTopic);
  const facts = node("div", "context-facts"); form.append(facts); let job; let relationship;
  function renderFacts() {
    const oldJob = job?.value || known.job || ""; const oldRelationship = relationship?.value || known.relationshipStatus || ""; facts.replaceChildren(); job = undefined; relationship = undefined;
    if (["work", "money"].includes(topic.value)) job = field(facts, "context-job", t("Công việc / tình trạng việc làm hiện tại", "Current work / employment situation"), "text", oldJob);
    if (topic.value === "love") relationship = field(facts, "context-relationship", t("Tình trạng quan hệ / hôn nhân hiện tại", "Current relationship / marital status"), "text", oldRelationship);
  }
  renderFacts(); topic.addEventListener("change", renderFacts);
  const defaultQuestion = text(known.question || reading.suggestedQuestion || "", 600) || (id === "daily" ? t("Hôm nay mình nên chú ý điều gì để sống nhẹ nhàng và chủ động hơn?", "What can I notice today to move with care and agency?") : "");
  const question = field(form, "context-question", id === "yes_no" ? t("Một câu hỏi rõ ràng", "One clear question") : t("Câu hỏi hoặc điều bạn đang băn khoăn", "Your question or concern"), "textarea", defaultQuestion);
  let viewingDate; let year;
  if (id === "daily") { viewingDate = field(form, "context-date", t("Ngày bạn đang xem", "Viewing date"), "date", known.viewingDate || dateToday()); viewingDate.readOnly = true; }
  if (id === "yearly") { year = field(form, "context-year", t("Năm bạn muốn nhìn lại / hướng tới", "Year to reflect on / look toward"), "number", String(known.year || new Date().getFullYear())); year.min = "1900"; year.max = "2200"; }
  if (id === "yes_no") form.append(node("p", "config-note", t("Bài chỉ gợi ý nghiêng về có / không / chưa rõ. Kết quả không xác nhận sự kiện hay thay bạn quyết định.", "The card can suggest yes / no / unclear. It never establishes a fact or decides for you.")));
  submitButton(form, t("Tiếp tục", "Continue"), "context-submit");
  form.addEventListener("submit", event => { event.preventDefault(); if (!form.reportValidity()) return; const payload = { question: question.value, topic: topic.value }; if (job) payload.job = job.value; if (relationship) payload.relationshipStatus = relationship.value; if (viewingDate) payload.viewingDate = viewingDate.value; if (year) payload.year = Number(year.value); act("save_context", payload); }); elements.panel.append(form);
}
function cardTool(extra = false) {
  const reading = state.reading; const cards = extra ? reading.extraCards : reading.cards; const flipped = cards.filter(card => card.flipped).length;
  heading(extra ? t("Bài bổ sung", "Additional cards") : t("Bài của bạn", "Your cards"));
  const progress = node("p", "flip-progress", t(`${flipped}/${cards.length} lá đã mở`, `${flipped}/${cards.length} cards revealed`)); progress.dataset.testid = "flip-progress"; progress.setAttribute("role", "status"); elements.panel.append(progress);
  const grid = node("div", "card-grid");
  for (let index = 0; index < cards.length; index += 1) {
    const card = cards[index]; const info = card.revealedCard || card; const position = reading.spread.positions.find(item => item.id === card.positionId);
    const label = position ? localized(position.label) : t(`Góc bổ sung ${index + 1}`, `Additional angle ${index + 1}`);
    const tile = node("div", "card-tile"); const flip = button("", () => act("flip", { index: typeof card.index === "number" ? card.index : index, ...(extra ? { extra: true } : {}) }), `tarot-card${card.flipped ? " revealed" : ""}`, `${extra ? "extra-" : ""}flip-${index}`);
    flip.setAttribute("aria-label", card.flipped ? `${label}: ${state.language === "en" ? info.english : info.name}, ${info.orientation === "reversed" ? t("ngược", "reversed") : t("xuôi", "upright")}` : t(`Lật lá ${index + 1}: ${label}`, `Reveal card ${index + 1}: ${label}`));
    if (card.flipped) { flip.disabled = true; flip.dataset.locked = "true"; flip.append(node("span", "card-glyph", text(info.glyph, 10) || "✦"), node("span", "card-name", text(state.language === "en" ? info.english : info.name, 80)), node("span", "card-orientation", info.orientation === "reversed" ? t("NGƯỢC", "REVERSED") : t("XUÔI", "UPRIGHT"))); }
    else flip.append(node("span", "card-back-mark", "✦"), node("span", "card-back-text", t("CHẠM ĐỂ LẬT", "TAP TO REVEAL")));
    tile.append(flip, node("span", "card-position", label)); grid.append(tile);
  }
  elements.panel.append(grid);
}
function readingRecap() {
  const details = node("details", "reading-recap"); details.append(node("summary", "", t("Trải bài & diễn giải đã lưu", "Saved cards & interpretation")), node("p", "", text(state.reading.context?.question, 600)));
  const cards = [...state.reading.cards || [], ...state.reading.extraCards || []];
  for (const card of cards.filter(item => item.flipped)) { const info = card.revealedCard || card; const position = state.reading.spread.positions.find(item => item.id === card.positionId); details.append(node("p", "recap-card", `${position ? localized(position.label) : t("Bổ sung", "Additional")}: ${text(state.language === "en" ? info.english : info.name, 80)} · ${info.orientation === "reversed" ? t("ngược", "reversed") : t("xuôi", "upright")}`)); }
  if (state.reading.interpretation) {
    details.append(node("h3", "saved-reading-title", t("Diễn giải của phiên này", "This reading's interpretation")));
    const interpretation = node("p", "saved-interpretation", text(state.reading.interpretation, 12002)); interpretation.dataset.testid = "saved-interpretation"; details.append(interpretation);
  }
  elements.panel.append(details);
}
function renderStep() {
  elements.panel.replaceChildren(); elements.status.textContent = "";
  if (state.loading) { heading(t("Đang mở lại khoảng nhỏ của bạn…", "Opening your space…")); return; }
  if (state.newConfirm) {
    heading(t("Mở một trải bài mới?", "Start a new reading?"), t("Trải bài hiện tại sẽ khép lại. Hồ sơ và cuộc trò chuyện vẫn được giữ; chỉ rút bài khi bạn xác nhận lại câu hỏi.", "The current reading will close. Your profile and conversation stay. Cards are only drawn after you confirm the new question."));
    const row = node("div", "button-row"); row.append(button(t("Mở phiên mới", "Start new reading"), () => { state.newConfirm = false; act("start_new"); }, "primary-button", "new-session-confirm"), button(t("Ở lại với bài này", "Stay with these cards"), dismissSpreadOffer, "secondary-button", "new-session-cancel")); elements.panel.append(row); return;
  }
  const reading = state.reading;
  if (!reading || reading.step === "select_spread") { spreadChoices(); return; }
  if (!validSpread(reading.spread)) { heading(t("Cấu hình trải bài chưa hợp lệ", "This spread configuration is invalid"), t("Chưa thể rút hoặc diễn giải. Bạn có thể bắt đầu lại để chọn một cấu hình hợp lệ.", "Cards cannot be drawn or interpreted. Start a new reading to choose a valid configuration.")); return; }
  if (reading.step === "confirm_spread") {
    heading(`${localized(reading.spread.name)} · ${reading.spread.count} ${t("lá", "cards")}`, localized(reading.spread.description));
    elements.panel.append(positions(reading.spread), node("p", "config-note", t("Ý nghĩa vị trí dưới đây là cấu hình demo đề xuất khi chưa xác minh đầy đủ với ứng dụng gốc. Mỗi lá giữ đúng vị trí này.", "The position meanings below are proposed demo configuration where original app details remain unverified. Every card keeps this position.")));
    const row = node("div", "button-row"); row.append(button(t("Chọn trải bài này", "Confirm this spread"), () => act("confirm_spread"), "primary-button", "confirm-spread"), button(t("Chọn lại", "Choose another"), () => { clearQuickOptions(); state.reading = null; render(); }, "secondary-button", "choose-spread")); elements.panel.append(row);
  } else if (reading.step === "profile") profileStep();
  else if (reading.step === "context") contextStep();
  else if (reading.step === "ready_to_draw") { heading(t("Rút bài", "Draw cards"), text(reading.context.question, 600)); elements.panel.append(node("p", "step-description", t(`${reading.spread.count} lá từ bộ 78 lá, rút một lần cho câu hỏi này.`, `${reading.spread.count} cards from the 78-card deck, drawn once for this question.`)), button(t("Rút bài", "Draw cards"), () => act("draw"), "primary-button", "draw")); }
  else if (["flipping", "ready_to_interpret"].includes(reading.step)) cardTool();
  else if (["extra_flipping", "ready_to_extra_interpret"].includes(reading.step)) cardTool(true);
  else if (reading.step === "extra_consent") {
    const pending = reading.pendingExtra; heading(t("Bạn muốn mở thêm góc nhìn này không?", "Would this additional perspective help?"), text(pending?.reason, 600));
    if (pending && [1, 2].includes(pending.count)) { elements.panel.append(node("p", "step-description", t(`Đề nghị ${pending.count} lá bổ sung. Bạn có thể từ chối; bài hiện tại vẫn giữ nguyên.`, `Proposing ${pending.count} additional ${pending.count === 1 ? "card" : "cards"}. You can decline and keep this reading.`))); for (const angle of pending.angles || []) elements.panel.append(node("p", "extra-angle", text(angle, 200)));
      const row = node("div", "button-row"); row.append(button(t(`Đồng ý rút ${pending.count} lá`, `Agree to ${pending.count} ${pending.count === 1 ? "card" : "cards"}`), () => act("consent_extra", { accept: true }), "primary-button", "supplement-consent"), button(t("Giữ nguyên bài này", "Keep these cards"), () => act("consent_extra", { accept: false }), "secondary-button", "supplement-cancel")); elements.panel.append(row); }
  } else if (reading.step === "interpreted") { readingRecap(); contextualSpreadOffer(); }
  else heading(t("Phiên đang chờ một bước hợp lệ", "This session needs a valid next step"));
}
function render() {
  renderLanguage(); renderHistory(); renderStep();
  if (hasConversationContext()) {
    const note = node("p", "step-description", t("Bạn có thể tiếp tục trò chuyện bên dưới, kể cả khi chưa muốn rút hoặc mở thêm bài.", "You can keep chatting below, even when you are not ready to draw or reveal more cards."));
    note.dataset.testid = "conversation-note"; elements.panel.append(note);
  }
  setBusy(state.busy);
}
async function requestJson(url, options = {}, timeout = 45000) {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeout);
  try { const response = await fetch(url, { ...options, credentials: "same-origin", signal: controller.signal, cache: "no-store" }); const data = await response.json().catch(() => null); return { response, data }; } finally { window.clearTimeout(timer); }
}
function acceptData(data) {
  if (Object.hasOwn(data, "reading")) {
    const previousId = state.reading?.id; state.reading = data.reading;
    if (previousId !== state.reading?.id) {
      state.spreadOfferDismissed = false;
      try { state.spreadOfferDismissed = REQUEST_ID_PATTERN.test(state.reading?.id ?? "") && window.sessionStorage.getItem(SPREAD_OFFER_DISMISSAL_KEY) === state.reading.id; }
      catch { /* A saved UI preference is optional; it never owns session state. */ }
    }
  }
  if (state.contextDraft && (state.reading?.id !== state.contextDraft.readingId || state.reading?.step !== "context")) state.contextDraft = null;
  if (data.history && Array.isArray(data.history.turns)) state.history = data.history;
  if (state.reading?.profile?.language) state.language = state.reading.profile.language === "en" ? "en" : "vi";
  state.suggestedSpreadId = data.suggestedSpreadId || null;
}
function automaticInterpretation(command) {
  if (command.action !== "flip" || !validSpread(state.reading?.spread)) return null;
  const reading = state.reading; const extra = command.payload.extra === true;
  if (reading.step !== (extra ? "ready_to_extra_interpret" : "ready_to_interpret")
    || reading.cards.length !== reading.spread.count || !reading.cards.every(card => card.flipped)
    || !reading.extraCards.every(card => card.flipped) || (extra && !reading.extraCards.length)) return null;
  const key = `${reading.id}:${extra ? "extra" : "main"}`;
  if (state.automaticReadings.has(key)) return null;
  state.automaticReadings.add(key);
  return { body: { requestId: crypto.randomUUID(), action: "interpret", payload: {} } };
}
function actionError(data) {
  const reason = text(data?.reason, 160);
  if (reason === "reply_configuration_invalid") return t("AI chưa được cấu hình phù hợp. Chưa gọi AI; bạn có thể gửi lại sau.", "AI configuration is unavailable. AI has not been called; you can try again later.");
  if (reason === "reply_output_gate") return t("Chưa đọc được định dạng phản hồi AI. Câu hỏi, bài đã rút và cuộc trò chuyện vẫn được giữ. Bạn có thể dừng; thử lại có thể vẫn thất bại và có thể dùng thêm hạn mức AI.", "The AI response format couldn't be read. Your question, drawn cards and conversation are still saved. You can stop; retrying may still fail and may use more AI allowance.");
  if (reason.includes("context_budget")) return t("AI chưa thể xử lý toàn bộ tin nhắn cùng lịch sử trong giới hạn hiện tại. Nội dung vẫn được giữ nguyên; bạn có thể sửa hoặc chia nhỏ tin nhắn.", "AI cannot process the entire message and history within the current limit. Your content is kept unchanged; you can edit or split the message.");
  if (reason === "rate_limit" || reason === "busy") return t("Bạn chờ một chút rồi thử lại nhé.", "Please wait a moment, then retry.");
  if (reason.includes("limit")) return t("Phiên đã chạm hạn mức.", "The session limit has been reached.");
  return t("Chưa trả lời được. Bạn thử lại nhé.", "Couldn't respond. Please retry.");
}
async function executePending() {
  if (!state.pending || state.busy) return; invalidateClientTool(); const pending = state.pending; const previousScroll = elements.scroll.scrollTop; clearQuickOptions(); const optionsGeneration = state.quickOptionsGeneration; clearError(); setBusy(true);
  delete pending.failureDiagnostics;
  if (["set_language", "followup"].includes(pending.body.action) && !pending.recovery) {
    pending.recovery = { readingId: state.reading?.id, resumeReading: state.resumeReading, resumeRequest: state.resumeRequest };
  }
  elements.status.textContent = pending.body.action === "interpret" ? t("Đang đọc bài…", "Reading your cards…") : "";
  try {
    const { response, data } = await requestJson("/api/reading/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending.body) });
    if (state.pending !== pending) return;
    if (MODEL_ACTIONS.has(pending.body.action)) state.lastModelResponseAt = Date.now();
    if (!data || typeof data !== "object" || typeof data.ok !== "boolean") throw new TypeError("invalid_response"); acceptData(data);
    if (!response.ok || !data.ok) {
      pending.failureDiagnostics = data.requestId === pending.body.requestId && typeof data.reason === "string" ? failureDiagnostics(data.failureDiagnostics, pending.body.action, data.reason) : null;
      if (!data.retryable) {
        if (data.reason === "reply_configuration_invalid" && pending.body.action === "save_context") {
          state.contextDraft = { readingId: state.reading?.id, payload: pending.body.payload };
        }
        state.pending = null; state.provisionalMessage = null;
        if ((pending.body.action === "followup" && text(data.reason, 160).includes("context_budget"))
          || (data.reason === "reply_configuration_invalid" && ["followup", "suggest_spread"].includes(pending.body.action))) {
          elements.input.value = pending.body.payload.message; resizeInput();
        }
      } else pending.providerRetry = true;
      render(); showError(actionError(data), Boolean(data.retryable), pending); return;
    }
    const preserveRecovery = ["set_language", "followup"].includes(pending.body.action) && pending.recovery?.resumeReading
      && pending.recovery.readingId === state.reading?.id && ["ready_to_interpret", "ready_to_extra_interpret"].includes(state.reading?.step);
    if (pending.body.action === "save_context") state.contextDraft = null;
    state.pending = null; state.provisionalMessage = null; state.resumeReading = Boolean(preserveRecovery);
    // A successful conversation turn invalidates older provider retries on the
    // server. Keep the explicit Continue step, but use a fresh request for it.
    state.resumeRequest = preserveRecovery && pending.body.action === "set_language" ? pending.recovery.resumeRequest : null;
    if (["reset", "start_new"].includes(pending.body.action)) setSpreadOfferDismissed(false);
    if (pending.body.action === "reset") { state.newConfirm = false; state.history = { turns: [] }; elements.input.value = ""; }
    if (MODEL_ACTIONS.has(pending.body.action) && optionsGeneration === state.quickOptionsGeneration) acceptQuickOptions(data, true);
    render();
    if (state.resumeReading) showError(t("Chưa có diễn giải.", "No interpretation yet."), true, undefined, true);
    // The persisted history is the source of truth; request replays never add another answer.
    const canonicalReply = (state.history.turns || []).some(turn => turn.assistant === data.message
      && (turn.messageId === pending.body.requestId || pending.body.action === "interpret" && turn.user === state.reading?.context?.question));
    if (data.mode !== "ready" && text(data.message) && !canonicalReply) addMessage("assistant", text(data.message));
    const interpretation = automaticInterpretation(pending.body);
    if (interpretation) {
      state.pending = interpretation; setBusy(true); elements.status.textContent = t("Đang đọc bài…", "Reading your cards…");
      // Wait before the first submission only. A failed model request is never retried here.
      const wait = Math.max(0, state.minIntervalMs - (Date.now() - state.lastModelResponseAt));
      if (wait) await new Promise(resolve => window.setTimeout(resolve, wait));
      setBusy(false); await executePending(); return;
    }
    setBusy(false);
    if (pending.body.action === "flip") {
      elements.scroll.scrollTop = previousScroll;
      const cards = pending.body.payload.extra ? state.reading?.extraCards : state.reading?.cards;
      const nextIndex = cards?.findIndex(card => !card.flipped);
      const focusTarget = nextIndex >= 0 ? elements.panel.querySelector(`[data-testid="${pending.body.payload.extra ? "extra-" : ""}flip-${nextIndex}"]`) : elements.panel;
      focusTarget?.focus({ preventScroll: true });
    } else if (pending.body.action === "followup") scrollToLatest();
    else if (state.reading && state.reading.step !== "interpreted") showCurrentStep();
    else scrollToLatest();
  } catch { render(); showError(t("Chưa kết nối được. Bạn thử lại nhé.", "Couldn't connect. Please retry."), true); }
  finally {
    setBusy(false);
    if (!elements.input.disabled && ["followup", "suggest_spread"].includes(pending.body.action)) elements.input.focus();
  }
}
function act(action, payload = {}) { if (state.busy || state.pending) return Promise.resolve(); state.pending = { body: { requestId: crypto.randomUUID(), action, payload } }; return executePending(); }
elements.form.addEventListener("submit", async event => {
  event.preventDefault(); if (state.busy || elements.input.disabled) return; clearError(); const message = elements.input.value;
  if (!message.trim()) { elements.input.focus(); return; }
  const limit = messageLimit();
  const length = hasConversationContext() ? Array.from(message).length : message.length;
  if (length > limit) { showError(t(`Bạn giữ tin nhắn trong ${limit} ký tự nhé.`, `Please keep your message within ${limit} characters.`)); return; }
  state.provisionalMessage = message; elements.input.value = ""; resizeInput(); renderHistory(); await act(hasConversationContext() ? "followup" : "suggest_spread", { message });
});
elements.input.addEventListener("input", () => { state.optionDraft = null; if (!state.pending) clearError(); resizeInput(); renderQuickOptions(); });
elements.input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); elements.form.requestSubmit(); } });
elements.retry.addEventListener("click", () => {
  if (state.busy || state.loading) return;
  if (!state.pending && state.resumeReading) state.pending = state.resumeRequest || { body: { requestId: crypto.randomUUID(), action: "interpret", payload: {} } };
  if (state.pending?.providerRetry) state.pending.body.retry = true;
  state.resumeReading = false; state.resumeRequest = null;
  return executePending();
});
elements.cancelRetry.addEventListener("click", async () => {
  if (state.busy) return;
  state.resumeRequest = state.pending?.body.action === "interpret" ? state.pending : null;
  state.pending = null; state.provisionalMessage = null; clearError(); await restore(false);
});
function setMenu(open) { elements.menu.hidden = !open; elements.menuButton.setAttribute("aria-expanded", String(open)); }
elements.menuButton.addEventListener("click", () => { const open = elements.menu.hidden; setMenu(open); if (open) byId("privacy-button").focus(); });
document.addEventListener("click", event => { if (!elements.menu.contains(event.target) && !elements.menuButton.contains(event.target)) setMenu(false); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !elements.menu.hidden) { setMenu(false); elements.menuButton.focus(); } });
byId("privacy-button").addEventListener("click", () => { setMenu(false); elements.privacy.showModal(); });
elements.newButton.addEventListener("click", () => { setMenu(false); if (!state.reading) return; invalidateClientTool(); setSpreadOfferDismissed(false); clearQuickOptions(); state.newConfirm = true; render(); scrollToLatest(); });
elements.reset.addEventListener("click", () => { setMenu(false); invalidateClientTool(); clearQuickOptions(); elements.resetDialog.showModal(); });
byId("reset-cancel").addEventListener("click", () => elements.resetDialog.close());
byId("reset-confirm").addEventListener("click", () => { if (state.busy) return; elements.resetDialog.close(); clearQuickOptions(); state.pending = null; act("reset"); });
elements.language.addEventListener("change", () => {
  invalidateClientTool(); clearQuickOptions();
  const language = elements.language.value === "en" ? "en" : "vi";
  if (state.reading?.profile) return act("set_language", { language });
  state.language = language; render();
});
async function restore(recoverPending = true) {
  invalidateClientTool(); clearQuickOptions(); const optionsGeneration = state.quickOptionsGeneration; state.loading = true; render();
  try {
    const results = await Promise.allSettled([requestJson("/api/spreads", {}, 12000), requestJson("/api/reading", {}, 12000), requestJson("/api/config", {}, 12000)]); const spreadResult = results[0]; const readingResult = results[1];
    const configResult = results[2];
    if (configResult.status === "fulfilled" && configResult.value.response.ok) acceptPublicConfig(configResult.value.data);
    if (spreadResult.status !== "fulfilled" || !spreadResult.value.response.ok || !Array.isArray(spreadResult.value.data?.spreads)) throw new TypeError("spread_response"); state.spreads = spreadResult.value.data.spreads;
    if (readingResult.status !== "fulfilled" || !readingResult.value.response.ok || !readingResult.value.data || !Object.hasOwn(readingResult.value.data, "reading")) throw new TypeError("reading_response");
    acceptData(readingResult.value.data); state.loading = false;
    const pending = readingResult.value.data.pendingRequest;
    const diagnostic = typeof pending?.requestId === "string" && REQUEST_ID_PATTERN.test(pending.requestId)
      ? failureDiagnostics(pending.failureDiagnostics, pending.action) : null;
    if (recoverPending && pending?.retryable && typeof pending.requestId === "string" && typeof pending.action === "string") state.pending = { body: { requestId: pending.requestId, action: pending.action, payload: pending.payload }, providerRetry: true, failureDiagnostics: diagnostic };
    state.resumeReading = !state.pending && ["ready_to_interpret", "ready_to_extra_interpret"].includes(state.reading?.step);
    if (state.resumeReading && pending?.action === "interpret" && pending.retryable) state.resumeRequest = { body: { requestId: pending.requestId, action: pending.action, payload: pending.payload }, providerRetry: true };
    if (!state.resumeReading) state.resumeRequest = null;
    const latestTurn = state.history.turns?.at(-1);
    if (!state.pending && !pending && !state.resumeReading && latestTurn?.assistant && latestTurn.terminalStatus !== "unavailable"
      && optionsGeneration === state.quickOptionsGeneration) acceptQuickOptions(latestTurn);
    render();
    if (state.pending) showError(state.pending.failureDiagnostics
      ? actionError({ reason: `${state.pending.failureDiagnostics.stage}_${state.pending.failureDiagnostics.reason}` })
      : MODEL_ACTIONS.has(state.pending.body.action)
      ? t("Yêu cầu này chưa hoàn tất. Câu hỏi, bài đã rút và cuộc trò chuyện vẫn được giữ. Bạn có thể dừng; thử lại có thể vẫn thất bại và có thể dùng thêm hạn mức AI.", "This request is incomplete. Your question, drawn cards and conversation are still saved. You can stop; retrying may still fail and may use more AI allowance.")
      : t("Yêu cầu này chưa hoàn tất. Bạn có thể dừng hoặc thử lại.", "This request is incomplete. You can stop or retry."), true);
    else if (state.resumeReading) showError(t("Chưa có diễn giải.", "No interpretation yet."), true);
    if (state.reading && state.reading.step !== "select_spread") { if (state.reading.step === "interpreted") scrollToLatest(); else showCurrentStep(); }
  } catch { state.loading = false; render(); showError(t("Chưa mở được phiên. Bạn tải lại trang nhé.", "Couldn't restore this session. Please reload.")); }
}
void restore();
