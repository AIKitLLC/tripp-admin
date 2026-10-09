const BRANCHES = ['conversation', 'new_reading_offer', 'interpret', 'extra_interpret', 'knowledge', 'practical', 'clarify_reading', 'suggest_spread', 'supplement', 'ambiguous', 'emotional_support', 'new_topic'];
const BRANCH_LABELS = { conversation: 'Trò chuyện', new_reading_offer: 'Đề nghị trải bài mới', interpret: 'Giải trải bài', extra_interpret: 'Giải góc nhìn bổ sung', knowledge: 'Kiến thức Tarot', practical: 'Bước thực tế', clarify_reading: 'Làm rõ trải bài', suggest_spread: 'Gợi ý cách trải bài', supplement: 'Đề nghị góc nhìn bổ sung', ambiguous: 'Làm rõ câu hỏi', emotional_support: 'Lắng nghe cảm xúc', new_topic: 'Tiếp nối chủ đề mới' };
const TONES = { warm: 'Ấm áp', concise: 'Gọn gàng', supportive: 'Nâng đỡ' };
const DEPTHS = { brief: 'Ngắn', balanced: 'Cân bằng', deep: 'Sâu hơn' };
const QUALITY_LABELS = { OWNER_QUALITY: 'Chỉ dẫn chất lượng · chủ sở hữu', TESTER_QUALITY: 'Chỉ dẫn chất lượng · kiểm thử' };
const INSTRUCTION_ORDERS = { owner_then_tester: 'Chủ sở hữu → kiểm thử', tester_then_owner: 'Kiểm thử → chủ sở hữu' };
const DATA_ORDERS = { summary_then_history: 'Tóm tắt → lịch sử', history_then_summary: 'Lịch sử → tóm tắt' };
const HISTORY_TURNS = { 4: '4 lượt gần nhất', 12: '12 lượt gần nhất', 24: '24 lượt gần nhất', 100: 'Tối đa 100 lượt' };
const HISTORY_BYTES = { 2048: '2.048 byte', 4096: '4.096 byte', 8192: '8.192 byte', 16000: '16.000 byte' };
const MAX_QUALITY_BYTES = 2048;
const ROLES = { owner: 'Chủ sở hữu', editor: 'Biên tập', viewer: 'Chỉ xem' };
const STATUSES = { active: 'Hoạt động', suspended: 'Tạm khóa' };
const NODE_LABELS = { router: 'Router quyết định', policy_guard: 'Quy tắc an toàn', prompt_part: 'Chỉ dẫn nguồn', presentation: 'Trình bày & thứ tự chỉ dẫn', server_grounding: 'Dữ kiện server', history: 'Lịch sử & tóm tắt', current_input: 'Câu hỏi hiện tại', native_schema: 'Hợp đồng đầu ra', budget: 'Giới hạn ngữ cảnh', reply_provider: 'Model trả lời', output_gate: 'Kiểm tra đầu ra' };
const NODE_HELP = { router: 'Phân loại ý định bằng hợp đồng cố định. Bản nháp không đổi tiêu chí hay tuyến xử lý.', policy_guard: 'Giữ Tarot như một cách suy ngẫm. Quy tắc an toàn và quyền chủ động của người dùng luôn được giữ.', presentation: 'Chọn cách diễn đạt trong danh sách được phép. Các quy tắc an toàn, dữ kiện và giới hạn vẫn giữ nguyên.', server_grounding: 'Dữ kiện và bài đã lật được lấy từ server. Bản nháp không thể rút bài, sửa vị trí hoặc tạo dữ kiện.', history: 'Lịch sử được đặt trong vùng dữ liệu; không trở thành chỉ dẫn hay quyền thực hiện công cụ.', current_input: 'Câu hỏi mới nhất là dữ liệu người dùng. Nội dung này không thay thế quy tắc hệ thống.', native_schema: 'Cấu trúc JSON và giới hạn đầu ra do server kiểm tra.', budget: 'Toàn bộ prompt, dữ liệu và schema đều được tính vào giới hạn trước khi gọi model.', reply_provider: 'Provider và tham số được cấu hình tại server; studio không nhận API key hay URL model.', output_gate: 'Đầu ra phải qua parser và các kiểm tra hiện có. Bản nháp không bỏ qua các cổng này.' };
const TRUST_LABELS = { trusted_instruction: 'CHỈ DẪN ĐƯỢC TIN CẬY', server_owned_data: 'DỮ LIỆU SERVER', untrusted_data: 'DATA · KHÔNG CÓ QUYỀN CHỈ DẪN', native_contract: 'HỢP ĐỒNG JSON', locked_control: 'KIỂM SOÁT CỐ ĐỊNH' };
const ACTION_LABELS = { draft_saved: 'Lưu bản nháp', publish: 'Phát hành', published: 'Phát hành', flow_published: 'Phát hành', rollback: 'Khôi phục phiên bản', rolled_back: 'Khôi phục phiên bản', flow_rolled_back: 'Khôi phục phiên bản', account_updated: 'Đổi quyền tài khoản', account_invited: 'Cấp quyền tài khoản', login: 'Đăng nhập', logout: 'Đăng xuất' };

export function adminAuthorizationUrl(value) {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'oauth.telegram.org' || url.port || url.username || url.password || url.pathname !== '/auth' || url.hash) return null;
    return url.href;
  } catch { return null; }
}
export function adminErrorMessage(reason, status = 0) {
  if (status === 409 || ['revision_conflict', 'draft_conflict', 'production_conflict', 'operation_conflict', 'conflict'].includes(reason)) return 'Phiên bản trên server đã thay đổi. Các chỉnh sửa trong tab này vẫn được giữ. Chọn “Tải bản server” khi bạn sẵn sàng bỏ thay đổi chưa lưu.';
  if (status === 401 || ['unauthorized', 'session_expired', 'authentication_required'].includes(reason)) return 'Phiên quản trị đã hết hạn. Đăng nhập lại để tiếp tục; các thay đổi chưa lưu vẫn còn trong tab này.';
  if (status === 403 || ['forbidden', 'role_forbidden', 'csrf_invalid', 'invalid_csrf', 'account_suspended'].includes(reason)) return 'Bạn chưa có quyền thực hiện thao tác này, hoặc phiên xác thực cần được làm mới.';
  if (reason === 'admin_disabled' || reason === 'admin_not_configured') return 'Đăng nhập quản trị chưa được bật hoặc chưa cấu hình xong.';
  if (status === 400 || ['invalid_flow', 'invalid_request', 'invalid_admin_request', 'invalid_context_flow', 'invalid_account', 'invalid_revision', 'validation_failed'].includes(reason)) return 'Thay đổi chưa hợp lệ. Hãy kiểm tra tên, nhánh và các lựa chọn được phép.';
  if (status === 429) return 'Có quá nhiều thao tác trong thời gian ngắn. Chưa tự gửi lại; hãy chờ rồi thử lại khi phù hợp.';
  if (reason === 'context_budget' || reason === 'preview_budget_exceeded') return 'Ngữ cảnh vượt giới hạn được phép. Chưa lưu hoặc phát hành thay đổi này.';
  if (reason === 'unsafe_authorization_url') return 'Không nhận được địa chỉ đăng nhập Telegram hợp lệ. Chưa chuyển trang.';
  if (reason === 'malformed_response') return 'Server trả về dữ liệu chưa hợp lệ. Các thay đổi trong tab này được giữ.';
  if (reason === 'mutation_confirmed_snapshot_unavailable') return 'Server đã xác nhận thao tác, nhưng chưa tải được phiên bản mới. Không tự gửi lại. Chọn “Tải bản server” để đối chiếu trước khi thay đổi tiếp.';
  if (reason === 'request_timeout') return 'Chưa nhận được xác nhận từ server. Không tự gửi lại thao tác; hãy kiểm tra phiên bản trên server trước khi tiếp tục.';
  return 'Chưa hoàn tất thao tác. Không tự gửi lại; các thay đổi trong tab này được giữ.';
}
export function flowDiff(before, after) {
  const changes = [];
  if (before?.schemaVersion !== after?.schemaVersion) changes.push({ label: 'Cấu trúc ngữ cảnh', before: before ? `v${before.schemaVersion}` : 'Chưa phát hành', after: `v${after?.schemaVersion}` });
  for (const [key, label] of [['name', 'Tên luồng'], ['branch', 'Nhánh hội thoại']]) if (before?.[key] !== after?.[key]) changes.push({ label, before: before?.[key] ?? 'Chưa phát hành', after: after?.[key] ?? '—' });
  const first = before?.nodes?.find(node => node.kind === 'presentation');
  const last = after?.nodes?.find(node => node.kind === 'presentation');
  for (const [key, label, choices] of [['tone', 'Giọng điệu', TONES], ['depth', 'Độ sâu', DEPTHS], ['instructionOrder', 'Thứ tự hai chỉ dẫn chất lượng', INSTRUCTION_ORDERS]]) if (first?.[key] !== last?.[key]) changes.push({ label, before: choices[first?.[key]] ?? 'Mặc định cấu trúc cũ', after: choices[last?.[key]] ?? '—' });
  for (const [partName, label] of Object.entries(QUALITY_LABELS)) {
    const old = before?.nodes?.find(node => node.kind === 'prompt_part' && node.partName === partName);
    const next = after?.nodes?.find(node => node.kind === 'prompt_part' && node.partName === partName);
    if (old?.text !== next?.text) changes.push({ label, before: old?.text ?? (before ? 'Chỉ dẫn gốc trong mã · cấu trúc cũ' : 'Chưa phát hành'), after: next?.text ?? 'Chỉ dẫn gốc trong mã · cấu trúc cũ' });
  }
  const oldHistory = before?.nodes?.find(node => node.kind === 'history');
  const nextHistory = after?.nodes?.find(node => node.kind === 'history');
  for (const [key, label, choices] of [['maxTurns', 'Số lượt lịch sử tối đa', HISTORY_TURNS], ['maxBytes', 'Ngân sách lịch sử', HISTORY_BYTES], ['includeAssistant', 'Đưa câu trả lời trước vào dữ liệu', { true: 'Có', false: 'Không' }], ['includeReadingSummary', 'Đưa tóm tắt trải bài vào dữ liệu', { true: 'Có', false: 'Không' }], ['dataOrder', 'Thứ tự dữ liệu', DATA_ORDERS]]) if (oldHistory?.[key] !== nextHistory?.[key]) changes.push({ label, before: choices[String(oldHistory?.[key])] ?? 'Mặc định cấu trúc cũ', after: choices[String(nextHistory?.[key])] ?? '—' });
  const protectedNodes = flow => (flow?.nodes ?? []).map(node => {
    const copy = { ...node };
    if (node.kind === 'presentation') { delete copy.tone; delete copy.depth; delete copy.instructionOrder; }
    if (node.kind === 'history') for (const key of ['maxTurns', 'maxBytes', 'includeAssistant', 'includeReadingSummary', 'dataOrder']) delete copy[key];
    if (node.kind === 'prompt_part' && Object.hasOwn(QUALITY_LABELS, node.partName)) delete copy.text;
    return copy;
  });
  if (before && JSON.stringify(protectedNodes(before)) !== JSON.stringify(protectedNodes(after))) changes.push({ label: 'Nguồn và pipeline do server quản lý', before: `${protectedNodes(before).length} bước cố định`, after: `${protectedNodes(after).length} bước cố định · phiên bản nguồn mới` });
  return changes;
}
export function adminTextBytes(value) { return new TextEncoder().encode(value).byteLength; }
function record(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function revision(value) { return Number.isSafeInteger(value) && value >= 1; }
function qualityNode(node) { return node?.kind === 'prompt_part' && Object.hasOwn(QUALITY_LABELS, node.partName); }
function validFlow(flow) {
  if (!record(flow) || ![1, 2].includes(flow.schemaVersion) || typeof flow.name !== 'string' || !BRANCHES.includes(flow.branch) || !Array.isArray(flow.nodes) || flow.nodes.length < 1 || flow.nodes.length > 64 || !flow.nodes.every(node => record(node) && typeof node.id === 'string' && Object.hasOwn(NODE_LABELS, node.kind) && typeof node.locked === 'boolean')) return false;
  const presentations = flow.nodes.filter(node => node.kind === 'presentation');
  if (presentations.length !== 1 || !Object.hasOwn(TONES, presentations[0].tone) || !Object.hasOwn(DEPTHS, presentations[0].depth)) return false;
  if (flow.schemaVersion === 1) return true;
  const histories = flow.nodes.filter(node => node.kind === 'history');
  return Object.hasOwn(INSTRUCTION_ORDERS, presentations[0].instructionOrder) && histories.length === 1 && histories[0].locked === false && Object.hasOwn(HISTORY_TURNS, histories[0].maxTurns) && Object.hasOwn(HISTORY_BYTES, histories[0].maxBytes) && typeof histories[0].includeAssistant === 'boolean' && typeof histories[0].includeReadingSummary === 'boolean' && Object.hasOwn(DATA_ORDERS, histories[0].dataOrder) && Object.keys(QUALITY_LABELS).every(partName => {
    const nodes = flow.nodes.filter(node => node.kind === 'prompt_part' && node.partName === partName);
    return nodes.length === 1 && nodes[0].locked === false && typeof nodes[0].text === 'string' && nodes[0].text.trim().length > 0 && nodes[0].text === nodes[0].text.normalize('NFC') && adminTextBytes(nodes[0].text) <= MAX_QUALITY_BYTES;
  });
}
function validSnapshot(value, branch) { return record(value) && record(value.draft) && Number.isSafeInteger(value.draft.revision) && value.draft.revision >= 0 && validFlow(value.draft.flow) && value.draft.flow.branch === branch && (value.production === null || record(value.production) && revision(value.production.revision) && validFlow(value.production.flow) && value.production.flow.branch === branch && typeof value.production.releaseId === 'string') && Array.isArray(value.releases) && Array.isArray(value.audit); }
function formattedDate(value) { if (!Number.isFinite(value) || value < 0) return 'Chưa ghi nhận'; try { return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); } catch { return 'Chưa ghi nhận'; } }
function displayNumber(value) { return Number.isSafeInteger(value) && value >= 0 ? new Intl.NumberFormat('vi-VN').format(value) : '—'; }
function element(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = String(text); if (className) node.className = className; return node; }
function options(select, choices, selected) { select.replaceChildren(...Object.entries(choices).map(([value, label]) => { const option = element('option', label); option.value = value; option.selected = value === String(selected); return option; })); }
function setupOwnership(setup) {
  if (!record(setup)) return null;
  const keys = ['ownershipMode', 'firstOwnerBootstrap', 'bootstrapState'];
  if (keys.every(key => !Object.hasOwn(setup, key))) return { ownershipMode: 'allowlist', firstOwnerBootstrap: false, bootstrapState: 'closed' };
  if (!keys.every(key => Object.hasOwn(setup, key))) return null;
  if (setup.ownershipMode === 'allowlist' && setup.firstOwnerBootstrap === false && setup.bootstrapState === 'closed') return setup;
  if (setup.ownershipMode === 'first_owner' && setup.firstOwnerBootstrap === true && ['open', 'closed', 'unknown'].includes(setup.bootstrapState)) return setup;
  return null;
}
function setupLoginReady(setup) {
  const ownership = setupOwnership(setup);
  return setup?.state === 'ready' && Boolean(ownership) && ownership.bootstrapState !== 'unknown';
}
function validSetupStatus(value, origin) {
  const setup = value?.setup;
  const ownership = setupOwnership(setup);
  if (!record(value) || typeof value.enabled !== 'boolean' || typeof value.configured !== 'boolean' || !record(setup) || !ownership || !['missing', 'partial', 'invalid', 'disabled', 'unavailable', 'ready'].includes(setup.state) || !record(setup.present) || !['clientId', 'clientSecret', 'owners', 'origin'].every(key => typeof setup.present[key] === 'boolean') || typeof setup.originMatches !== 'boolean' || setup.productionOrigin !== origin || setup.callbackUrl !== `${origin}/api/admin/auth/callback` || setup.liveLogin !== 'not_verified') return false;
  return setup.state !== 'ready' || value.enabled && value.configured && setup.originMatches && ['clientId', 'clientSecret', 'origin'].every(key => setup.present[key]) && (ownership.firstOwnerBootstrap || setup.present.owners);
}

export async function initializeAdmin() {
  const $ = id => document.getElementById(id);
  const state = { account: null, csrf: '', snapshot: null, working: null, selectedNode: null, branch: 'conversation', dirty: false, busy: false, loginReady: false, setup: null, mutationUncertain: false, preview: null, accounts: [], pendingPublish: null, pendingRollback: null, pendingLoad: null };
  const isOwner = () => state.account?.role === 'owner';
  const canEdit = () => isOwner() || state.account?.role === 'editor';
  const canChangeFlow = () => canEdit() && state.working?.schemaVersion === 2;
  const canonicalUpgradeTemplate = () => { const template = state.snapshot?.catalog?.branches?.find(item => item.id === state.branch)?.flow; return validFlow(template) && template.schemaVersion === 2 && template.branch === state.branch ? template : null; };
  const notify = (message, error = false) => { const target = $(error ? 'error-notice' : 'notice'); target.textContent = message; target.hidden = false; if (error) { $('notice').hidden = true; for (const id of ['publish-dialog', 'rollback-dialog', 'discard-dialog']) if ($(id).open) { let note = $(`${id}-error`); if (!note) { note = element('p', undefined, 'notice error-notice'); note.id = `${id}-error`; note.setAttribute('role', 'alert'); $(id).append(note); } note.textContent = message; note.hidden = false; } } else $('error-notice').hidden = true; };
  const clearNotice = () => { $('error-notice').hidden = true; $('notice').hidden = true; };
  async function request(path, body, authentication = true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const headers = { Accept: 'application/json' };
      if (body !== undefined) { headers['Content-Type'] = 'application/json'; if (authentication) { if (!state.csrf) throw Object.assign(new Error('authentication_required'), { reason: 'authentication_required', status: 401 }); headers['X-CSRF-Token'] = state.csrf; } }
      const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      let data; try { data = await response.json(); } catch { throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response', status: response.status }); }
      if (!record(data)) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' });
      if (!response.ok || data.ok === false) throw Object.assign(new Error('request_failed'), { reason: typeof data.reason === 'string' ? data.reason : 'request_failed', status: response.status });
      return data;
    } catch (error) { if (error?.name === 'AbortError') throw Object.assign(new Error('request_timeout'), { reason: 'request_timeout' }); throw error; }
    finally { clearTimeout(timeout); }
  }
  function showSetup(open) { $('setup-panel').hidden = !open; $('show-setup').setAttribute('aria-expanded', String(open)); }
  function loginInvitation() {
    const ownership = setupOwnership(state.setup);
    if (ownership?.ownershipMode === 'first_owner' && ownership.bootstrapState === 'unknown') return 'Chưa xác nhận được trạng thái chủ sở hữu. Đăng nhập tạm tắt; kiểm tra lại khi server sẵn sàng.';
    if (!setupLoginReady(state.setup)) return 'Đăng nhập chưa sẵn sàng. Hoàn tất checklist cấu hình trên server rồi kiểm tra lại.';
    if (ownership?.ownershipMode === 'first_owner' && ownership.bootstrapState === 'open') return 'Chưa có chủ sở hữu. Tài khoản Telegram được xác thực thành công đầu tiên sẽ nhận quyền chủ sở hữu. Đọc cảnh báo trên trang công khai trước khi đăng nhập.';
    return 'Đăng nhập Telegram bằng tài khoản đã được cấp quyền. Đăng nhập thực tế chưa được xác minh.';
  }
  function renderSetup(message) {
    const origin = window.location.origin;
    $('setup-origin').textContent = origin; $('setup-callback').textContent = `${origin}/api/admin/auth/callback`;
    const labels = { missing: 'Chưa có cấu hình đăng nhập trên server.', partial: 'Cấu hình còn thiếu trường. Đăng nhập chưa sẵn sàng.', invalid: 'Có trường hiện diện nhưng cấu hình chưa hợp lệ hoặc origin không khớp.', disabled: 'Quản trị đang tắt. Đăng nhập chưa sẵn sàng.', unavailable: 'Chưa đọc được trạng thái chủ sở hữu trên server. Đăng nhập tạm tắt.', ready: 'Cấu hình cục bộ đầy đủ · chưa xác minh đăng nhập Telegram thực tế.' };
    $('setup-status').textContent = message || labels[state.setup?.state] || 'Chưa có kết quả cấu hình hiện tại. Đăng nhập được tắt cho đến khi kiểm tra lại thành công.';
    const ownership = setupOwnership(state.setup);
    const firstOwner = ownership?.ownershipMode === 'first_owner';
    const ownershipPanel = $('setup-ownership'); ownershipPanel.hidden = !firstOwner;
    ownershipPanel.dataset.state = firstOwner ? ownership.bootstrapState : '';
    ownershipPanel.setAttribute('role', firstOwner && ownership.bootstrapState !== 'closed' ? 'alert' : 'status');
    const ownershipCopy = {
      open: ['Đang mở xác lập chủ sở hữu đầu tiên', 'Ai đăng nhập Telegram thành công trước sẽ nhận quyền chủ sở hữu. Đây là trang công khai: một người khác có thể hoàn tất đăng nhập trước bạn và nhận quyền quản trị. Chỉ tiếp tục khi bạn chấp nhận rủi ro này. Quyền chủ sở hữu đầu tiên được ghi cố định; đăng xuất hoặc hết phiên không mở lại bước này.'],
      closed: ['Bước nhận quyền đầu tiên đã đóng', 'Bước nhận quyền đầu tiên đã đóng. Đăng nhập dành cho tài khoản quản trị đã được cấp quyền; tài khoản Telegram mới không tự nhận quyền. Trạng thái này không xác nhận một chủ sở hữu hiện đang hoạt động.'],
      unknown: ['Chưa xác nhận được trạng thái chủ sở hữu', 'Chưa xác nhận được trạng thái chủ sở hữu từ server. Đăng nhập tạm tắt để tránh dùng kết quả cũ. Bấm “Kiểm tra lại” khi server sẵn sàng.'],
    };
    const copy = firstOwner ? ownershipCopy[ownership.bootstrapState] : ['', ''];
    $('setup-ownership-title').textContent = copy[0]; $('setup-ownership-description').textContent = copy[1];
    const list = $('setup-checklist'); list.replaceChildren();
    for (const [key, label] of [['clientId', 'Telegram client ID'], ['clientSecret', 'Telegram client secret'], ['owners', firstOwner ? 'Cách xác lập chủ sở hữu' : 'Danh sách chủ sở hữu'], ['origin', 'Production origin']]) { const item = element('div', undefined, 'setup-check'); const presence = firstOwner && key === 'owners' ? 'Đã chọn chủ sở hữu đầu tiên · không cần danh sách ID' : state.setup ? state.setup.present[key] ? 'Đã có trường · không hiển thị giá trị' : 'Thiếu trường' : 'Chưa xác nhận'; item.append(element('strong', label), element('span', presence, 'muted')); list.append(item); }
    list.append(element('p', state.setup ? `Origin hiện tại: ${state.setup.originMatches ? 'khớp cấu hình server' : 'chưa khớp cấu hình server'}. Telegram thực tế: chưa xác minh.` : 'Kết quả cũ không được dùng để bật đăng nhập.', 'panel-footnote'));
  }
  async function refreshSetup() {
    state.loginReady = false; state.setup = null; updateControls(); renderSetup('Đang kiểm tra cấu hình hiện tại… Đăng nhập tạm tắt.');
    try {
      const status = await request('/api/admin/status', undefined, false);
      if (!validSetupStatus(status, window.location.origin)) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' });
      state.setup = status.setup; state.loginReady = setupLoginReady(state.setup) && !state.account; renderSetup();
      const ownership = setupOwnership(state.setup);
      if (!state.loginReady && !state.account || ownership?.ownershipMode === 'first_owner' && ownership.bootstrapState !== 'closed') showSetup(true);
      return setupLoginReady(state.setup);
    } catch (error) { renderSetup('Chưa kiểm tra được cấu hình hiện tại. Đăng nhập đã tắt; bấm “Kiểm tra lại” khi server sẵn sàng.'); showSetup(true); throw error; }
  }
  function updateControls() {
    const ready = Boolean(state.snapshot && state.working && state.account);
    const validWorking = validFlow(state.working);
    $('save-draft').disabled = state.busy || state.mutationUncertain || !ready || !canChangeFlow() || !validWorking || !state.dirty && state.snapshot.draft.revision !== 0;
    $('publish-flow').disabled = state.busy || state.mutationUncertain || !ready || !isOwner() || state.dirty || state.snapshot.draft.revision === 0;
    $('preview-flow').disabled = state.busy || !ready || !validWorking;
    $('reload-flow').disabled = state.busy || !ready;
    $('flow-name').disabled = state.busy || !ready || !canChangeFlow();
    $('branch-select').disabled = state.busy || !state.account;
    if (state.working) $('branch-select').value = state.branch;
    for (const control of $('node-inspector').querySelectorAll('input,select,textarea')) control.disabled = state.busy || !canChangeFlow();
    $('upgrade-flow').disabled = state.busy || state.mutationUncertain || !canEdit() || state.working?.schemaVersion !== 1 || !canonicalUpgradeTemplate();
    $('logout-button').disabled = state.busy;
    $('login-button').disabled = state.busy || !state.loginReady;
    $('refresh-setup').disabled = state.busy;
    for (const button of document.querySelectorAll('[data-owner-action]')) button.disabled = state.busy || !isOwner() || state.mutationUncertain && button.dataset.ownerAction === 'rollback';
    for (const control of $('users-table').querySelectorAll('select')) control.disabled = state.busy || !isOwner() || control.dataset.protected === 'true';
    for (const control of $('invite-form').querySelectorAll('input,select,button')) control.disabled = state.busy || !isOwner();
    $('publish-confirm').disabled = state.busy || state.mutationUncertain || !isOwner() || state.dirty || !state.snapshot?.draft.revision || !state.pendingPublish;
    $('rollback-confirm').disabled = state.busy || state.mutationUncertain || !isOwner() || !state.pendingRollback;
    $('draft-state').textContent = state.dirty ? 'Có thay đổi chưa lưu' : state.snapshot ? state.snapshot.draft.revision === 0 ? 'Cần lưu bản nháp đầu tiên' : 'Đã lưu trên server' : 'Đang tải…';
    $('flow-panel').setAttribute('aria-busy', String(state.busy));
  }
  async function act(callback) { if (state.busy) return; state.busy = true; updateControls(); try { await callback(); } catch (error) { const message = adminErrorMessage(error?.reason, error?.status); if (!$('admin-gate').hidden) $('gate-message').textContent = message; else notify(message, true); if (error?.status === 401) state.csrf = ''; } finally { state.busy = false; updateControls(); } }
  function markDirty() { state.dirty = JSON.stringify(state.working) !== JSON.stringify(state.snapshot?.draft.flow); state.preview = null; $('preview-panel').hidden = true; updateControls(); }
  function selectNode(id, focus = false) { state.selectedNode = id; for (const node of $('flow-canvas').querySelectorAll('button')) { const selected = node.dataset.nodeId === id; node.classList.toggle('active', selected); node.setAttribute('aria-pressed', String(selected)); } renderInspector(); updateControls(); if (focus) $('node-inspector').focus(); }
  function renderInspector() {
    const panel = $('node-inspector'); panel.replaceChildren(); panel.tabIndex = -1;
    panel.append(element('p', 'CHI TIẾT BƯỚC', 'eyebrow'));
    const node = state.working?.nodes.find(item => item.id === state.selectedNode);
    if (!node) { const title = element('h2', 'Chọn một bước'); title.id = 'inspector-title'; panel.append(title); return; }
    const source = state.snapshot?.catalog?.parts?.find(part => part.name === node.partName);
    const title = element('h2', node.partName || NODE_LABELS[node.kind] || node.kind); title.id = 'inspector-title'; panel.append(title);
    panel.append(element('p', node.locked ? 'DO SERVER QUẢN LÝ · CHỈ ĐỌC' : 'ĐƯỢC PHÉP ĐIỀU CHỈNH', 'badge'));
    panel.append(element('p', source?.purpose || NODE_HELP[node.kind] || 'Thành phần nguồn được lắp ghép theo hợp đồng cố định.', 'muted'));
    function selector(key, label, choices, numeric = false) {
        const field = element('div', undefined, 'field'); const caption = element('label', label); caption.htmlFor = `${key}-select`; const select = element('select'); select.id = `${key}-select`; options(select, choices, node[key]); select.disabled = !canEdit() || state.busy;
        select.addEventListener('change', () => { if (!canChangeFlow() || state.busy || node.locked || !Object.hasOwn(choices, select.value)) return; node[key] = numeric ? Number(select.value) : select.value; markDirty(); }); field.append(caption, select); panel.append(field);
    }
    if (node.kind === 'presentation') {
      for (const [key, label, choices] of [['tone', 'Giọng điệu', TONES], ['depth', 'Độ sâu', DEPTHS]]) selector(key, label, choices);
      if (state.working.schemaVersion === 2) selector('instructionOrder', 'Thứ tự hai chỉ dẫn chất lượng', INSTRUCTION_ORDERS);
      panel.append(element('p', 'Thứ tự chỉ thay đổi hai phần OWNER_QUALITY và TESTER_QUALITY trong SYSTEM. Khung an toàn, schema và quyền công cụ luôn được bảo vệ.', 'inspector-note'));
    }
    if (state.working.schemaVersion === 2 && qualityNode(node) && !node.locked) {
      const field = element('div', undefined, 'field'); const caption = element('label', 'Nội dung chỉ dẫn chất lượng'); caption.htmlFor = 'quality-text';
      const input = element('textarea'); input.id = 'quality-text'; input.value = node.text; input.rows = 10; input.maxLength = MAX_QUALITY_BYTES; input.spellcheck = false; input.setAttribute('aria-describedby', 'quality-byte-count quality-responsibility');
      const counter = element('p', undefined, 'byte-count'); counter.id = 'quality-byte-count'; counter.setAttribute('aria-live', 'polite');
      const count = () => { const bytes = adminTextBytes(node.text); const exceeded = bytes > MAX_QUALITY_BYTES; const empty = !node.text.trim(); counter.textContent = `${displayNumber(bytes)} / 2.048 byte UTF-8${exceeded ? ' · Vượt giới hạn: rút ngắn trước khi lưu hoặc xem trước' : empty ? ' · Cần có nội dung trước khi lưu' : ' · chuẩn hóa NFC'}`; counter.classList.toggle('over-limit', exceeded || empty); input.setAttribute('aria-invalid', String(exceeded || empty)); };
      input.addEventListener('input', () => { if (!canChangeFlow() || state.busy || node.locked) return; node.text = input.value.normalize('NFC'); if (input.value !== node.text) input.value = node.text; count(); markDirty(); });
      count(); field.append(caption, input, counter); panel.append(field);
      const note = element('p', 'Đây là chỉ dẫn chất lượng do quản trị viên biên tập, được đưa vào SYSTEM sau phát hành. Người phát hành cần đọc nội dung; kiểm tra cấu trúc và giới hạn byte không đánh giá ý nghĩa policy.', 'inspector-note'); note.id = 'quality-responsibility'; panel.append(note);
    }
    if (state.working.schemaVersion === 2 && node.kind === 'history' && !node.locked) {
      selector('maxTurns', 'Số lượt lịch sử tối đa', HISTORY_TURNS, true); selector('maxBytes', 'Ngân sách lịch sử · byte UTF-8', HISTORY_BYTES, true);
      for (const [key, label] of [['includeAssistant', 'Đưa câu trả lời trước vào dữ liệu'], ['includeReadingSummary', 'Đưa tóm tắt trải bài vào dữ liệu']]) {
        const field = element('div', undefined, 'toggle-field'); const input = element('input'); input.type = 'checkbox'; input.id = `${key}-toggle`; input.checked = node[key]; const caption = element('label', label); caption.htmlFor = input.id;
        input.addEventListener('change', () => { if (!canChangeFlow() || state.busy || node.locked) return; node[key] = input.checked; markDirty(); }); field.append(input, caption); panel.append(field);
      }
      selector('dataOrder', 'Thứ tự dữ liệu trong USER / DATA', DATA_ORDERS);
      panel.append(element('p', 'Lịch sử và tóm tắt vẫn là DATA không có quyền chỉ dẫn. Giới hạn có thể bỏ lượt cũ; xem các lượt được giữ và bị bỏ trong bản xem trước. Câu hỏi mới nhất và dữ kiện bài luôn được giữ theo hợp đồng server.', 'inspector-note'));
    }
    const metadata = element('dl', undefined, 'metadata-list');
    for (const [label, value] of [['ID', node.id], ['Bước tiếp theo', node.nextId ?? 'Kết thúc'], ['Phiên bản nguồn', node.sourceVersion || source?.version || state.snapshot?.catalog?.version || 'Server quản lý'], ['Nguồn', source?.provenance], ['Độ ưu tiên', source?.priority]]) if (value !== undefined) metadata.append(element('dt', label), element('dd', value));
    panel.append(metadata);
    if (typeof source?.text === 'string') { const detail = element('details'); detail.append(element('summary', qualityNode(node) && state.working.schemaVersion === 2 ? 'Đọc bản gốc trong mã' : 'Đọc chỉ dẫn nguồn')); detail.append(element('pre', source.text, 'source-text')); panel.append(detail); }
  }
  function renderFlow() {
    $('flow-name').value = state.working.name;
    options($('branch-select'), BRANCH_LABELS, state.branch);
    $('draft-revision').textContent = state.snapshot.draft.revision === 0 ? 'Mặc định' : `v${state.snapshot.draft.revision}`;
    $('production-revision').textContent = state.snapshot.production ? `v${state.snapshot.production.revision}` : 'Chưa có';
    $('legacy-flow-notice').hidden = state.working.schemaVersion !== 1;
    const canvas = $('flow-canvas'); canvas.replaceChildren();
    for (const [index, node] of state.working.nodes.entries()) {
      const row = element('li'); const button = element('button', undefined, 'flow-node'); button.type = 'button'; button.dataset.nodeId = node.id; button.dataset.kind = node.kind; button.setAttribute('aria-pressed', String(node.id === state.selectedNode));
      const editable = state.working.schemaVersion === 2 && !node.locked;
      button.append(element('span', String(index + 1).padStart(2, '0'), 'node-number')); const content = element('span', undefined, 'node-content'); content.append(element('span', QUALITY_LABELS[node.partName] || node.partName || NODE_LABELS[node.kind] || node.kind, 'node-name'), element('span', editable ? 'Có thể chỉnh · chỉ dẫn hoặc dữ liệu' : 'Server quản lý · chỉ đọc', 'node-kind')); button.append(content, element('span', editable ? '✎' : '⌑', 'node-lock')); button.addEventListener('click', () => selectNode(node.id)); row.append(button); canvas.append(row);
    }
    if (!state.working.nodes.some(node => node.id === state.selectedNode)) state.selectedNode = state.working.nodes.find(node => node.kind === 'presentation')?.id ?? state.working.nodes[0].id;
    selectNode(state.selectedNode); renderHistory(); updateControls();
  }
  function applySnapshot(data, branch, keepWorking = false) {
    if (!validSnapshot(data, branch)) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' });
    const working = state.working;
    state.snapshot = structuredClone(data); state.branch = branch;
    state.mutationUncertain = false;
    state.working = keepWorking && working?.branch === branch ? working : structuredClone(data.draft.flow);
    state.dirty = JSON.stringify(state.working) !== JSON.stringify(data.draft.flow); state.preview = null; $('preview-panel').hidden = true; renderFlow();
  }
  async function fetchFlow(branch = state.branch, keepWorking = false) { const data = await request(`/api/admin/flow?branch=${encodeURIComponent(branch)}`); applySnapshot(data, branch, keepWorking); }
  async function afterMutation(data, keepWorking = false) { if (validSnapshot(data, state.branch)) applySnapshot(data, state.branch, keepWorking); else { try { await fetchFlow(state.branch, keepWorking); } catch { state.mutationUncertain = true; throw Object.assign(new Error('mutation_confirmed_snapshot_unavailable'), { reason: 'mutation_confirmed_snapshot_unavailable' }); } } }
  function renderPreview(preview) {
    if (!record(preview) || preview.mode !== 'synthetic_dry_run' || preview.syntheticOnly !== true || preview.paidModelCalls !== 0 || !Array.isArray(preview.messages) || preview.messages.length !== 2 || preview.messages[0]?.role !== 'system' || preview.messages[1]?.role !== 'user' || preview.messages.some(message => typeof message.content !== 'string') || !record(preview.budget) || !Array.isArray(preview.segments)) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' });
    state.preview = preview;
    const budget = $('preview-budget'); budget.replaceChildren();
    for (const [label, value, caption] of [['Input đã lắp', displayNumber(preview.budget.inputBytes), 'byte UTF-8 · gồm schema'], ['Input ước tính', displayNumber(preview.budget.inputTokenUpperBound), 'giới hạn trên · chưa đo tokenizer'], ['Output dự phòng', displayNumber(preview.budget.outputTokenReserve), 'token tối đa'], ['Ngân sách ứng dụng', displayNumber(preview.budget.contextTokens), 'token · giới hạn giữ nguyên'], ['Schema đầu ra', displayNumber(preview.budget.schemaBytes), 'byte hợp đồng JSON'], ['Phần dự phòng', displayNumber(preview.budget.framingTokenReserve), 'token cho định dạng'], ['Dung lượng còn', displayNumber(preview.budget.remainingBytes), 'byte input theo giới hạn ứng dụng'], ['Gọi model', '0', 'chỉ lắp ghép dữ liệu giả lập']]) { const item = element('div', undefined, 'budget-item'); item.append(element('span', label), element('strong', value), element('span', caption)); budget.append(item); }
    const feeding = $('preview-feeding'); feeding.replaceChildren();
    if (record(preview.feeding)) {
      feeding.append(element('h3', 'Dữ liệu được đưa vào ngữ cảnh · fixture giả lập'));
      const metrics = element('dl', undefined, 'metadata-list');
      for (const [label, value] of [['Lượt có trong fixture', displayNumber(preview.feeding.storedTurnCount)], ['Lượt được giữ', displayNumber(preview.feeding.selectedTurnCount)], ['Lượt bị bỏ', displayNumber(preview.feeding.omittedTurnCount)], ['Giới hạn lượt', displayNumber(preview.feeding.maxTurns)], ['Ngân sách lịch sử', `${displayNumber(preview.feeding.maxBytes)} byte UTF-8`], ['Câu trả lời trước', preview.feeding.assistantIncluded === true ? 'Có trong DATA' : 'Không đưa vào DATA'], ['Tóm tắt trải bài', preview.feeding.readingSummaryIncluded === true ? 'Có trong DATA' : 'Không đưa vào DATA'], ['Thứ tự dữ liệu', DATA_ORDERS[preview.feeding.dataOrder] || 'Server quản lý'], ['Bỏ lượt cũ', preview.feeding.omissions?.olderTurns === true ? 'Có' : 'Không'], ['Bỏ câu trả lời trước', preview.feeding.omissions?.assistantText === true ? 'Có' : 'Không'], ['Bỏ tóm tắt', preview.feeding.omissions?.readingSummary === true ? 'Có' : 'Không']]) metrics.append(element('dt', label), element('dd', value));
      feeding.append(metrics);
    }
    if (Array.isArray(preview.compiledInstructionOrder) && preview.compiledInstructionOrder.every(value => typeof value === 'string')) feeding.append(element('p', `Thứ tự chỉ dẫn đã lắp: ${preview.compiledInstructionOrder.join(' → ')}`, 'inspector-note'));
    const segments = $('preview-segments'); segments.replaceChildren();
    for (const segment of preview.segments.slice(0, 64)) { const detail = element('details', undefined, 'segment-tag'); detail.append(element('summary', `${segment.label || segment.id} · ${TRUST_LABELS[segment.trust] || 'KIỂM SOÁT CỐ ĐỊNH'}`)); const metadata = element('dl', undefined, 'metadata-list'); for (const [label, value] of [['Nguồn', segment.source?.file || 'Server'], ['Phiên bản', segment.source?.version || preview.promptVersion || 'Server quản lý'], ['Xuất xứ', segment.source?.provenance || 'Nguồn server cố định'], ['Kích thước đoạn', `${displayNumber(segment.bytes)} byte · xem ngân sách đầy đủ ở trên`]]) metadata.append(element('dt', label), element('dd', value)); detail.append(metadata); segments.append(detail); }
    const messages = $('preview-messages'); messages.replaceChildren();
    for (const message of preview.messages) { const detail = element('details', undefined, 'message-preview'); detail.dataset.role = message.role; detail.open = message.role === 'user'; detail.append(element('summary', message.role === 'system' ? '01 · SYSTEM — Chỉ dẫn đã lắp · nguồn mã + bản nháp quản trị' : '02 · USER / DATA — Dữ liệu giả lập, không có quyền chỉ dẫn'), element('pre', message.content)); messages.append(detail); }
    $('preview-redactions').textContent = `Bản xem trước dùng dữ liệu giả lập; không chứa tên, ngày sinh hay lịch sử thật. ${Array.isArray(preview.limits) ? preview.limits.filter(value => typeof value === 'string').join(' ') : ''}`;
    $('preview-panel').hidden = false;
  }
  function renderHistory() {
    const releases = $('releases-list'); releases.replaceChildren();
    const entries = state.snapshot?.releases ?? [];
    if (!entries.length) releases.append(element('p', 'Chưa có phiên bản phát hành cho nhánh này.', 'muted'));
    for (const release of entries.slice(0, 50)) {
      if (!record(release) || typeof release.id !== 'string' || !revision(release.revision)) continue;
      const row = element('div', undefined, 'release-item'); const info = element('div'); info.append(element('strong', `v${release.revision} · ${release.flow?.name || 'Context flow'}`), element('p', `${formattedDate(release.createdAt)} · ${release.createdBy || 'Server'}`)); row.append(info);
      if (release.id === state.snapshot.production?.releaseId) row.append(element('span', 'Đang chạy', 'badge'));
      else if (isOwner()) { const button = element('button', 'Khôi phục', 'secondary-button'); button.type = 'button'; button.dataset.ownerAction = 'rollback'; button.dataset.releaseId = release.id; button.addEventListener('click', () => { if (state.busy || !isOwner()) return; state.pendingRollback = release; $('rollback-description').textContent = `Đưa nhánh “${BRANCH_LABELS[state.branch]}” về v${release.revision}, thay cho ${state.snapshot.production ? `v${state.snapshot.production.revision}` : 'phiên bản chưa phát hành'}.`; updateControls(); $('rollback-dialog').showModal(); }); row.append(button); }
      releases.append(row);
    }
    const audit = $('audit-list'); audit.replaceChildren();
    if (!state.snapshot?.audit.length) audit.append(element('li', isOwner() ? 'Chưa có thay đổi được ghi nhận.' : 'Chỉ chủ sở hữu được xem nhật ký quản trị.', 'muted'));
    for (const event of (state.snapshot?.audit ?? []).slice(0, 100)) { if (!record(event)) continue; const row = element('li'); row.append(element('p', ACTION_LABELS[event.action] || event.action || 'Hành động quản trị', 'audit-action'), element('p', `${formattedDate(event.createdAt)} · ${event.actorId || 'Server'}${revision(event.revision) ? ` · v${event.revision}` : ''}`, 'audit-meta')); audit.append(row); }
  }
  function renderUsers() {
    const list = $('users-table'); list.replaceChildren();
    $('users-permission').textContent = isOwner() ? 'Chủ sở hữu có thể cấp hoặc đổi quyền biên tập / chỉ xem. Tài khoản chủ sở hữu được bảo vệ. Đây là tài khoản quản trị, không phải hồ sơ người dùng trò chuyện.' : 'Bạn đang xem tài khoản quản trị của chính mình. Chỉ chủ sở hữu được xem danh sách và đổi quyền. Studio không hiển thị hồ sơ hay tin nhắn người dùng trò chuyện.';
    $('invite-form').hidden = !isOwner();
    if (!state.accounts.length) list.append(element('p', 'Chưa có tài khoản quản trị để hiển thị.', 'users-empty'));
    for (const account of state.accounts) {
      if (!record(account) || typeof account.id !== 'string' || !revision(account.revision) || !Object.hasOwn(ROLES, account.role) || !Object.hasOwn(STATUSES, account.status)) continue;
      const row = element('div', undefined, 'user-row'); const info = element('div', undefined, 'user-identity'); info.append(element('p', account.name || 'Thành viên', 'user-name'), element('p', `${account.username ? `@${account.username} · ` : ''}Telegram ID ${account.id}`, 'user-meta'), element('p', `Đăng nhập gần nhất: ${formattedDate(account.lastLoginAt)}`, 'user-meta')); row.append(info);
      const protectedAccount = account.role === 'owner'; const fields = {};
      for (const [key, label, choices] of [['role', 'Vai trò', protectedAccount ? { owner: ROLES.owner } : { editor: ROLES.editor, viewer: ROLES.viewer }], ['status', 'Trạng thái', STATUSES]]) { const field = element('div', undefined, 'field'); const select = element('select'); select.id = `account-${account.id}-${key}`; select.dataset.protected = String(protectedAccount); options(select, choices, account[key]); select.disabled = !isOwner() || protectedAccount || state.busy; const caption = element('label', label); caption.htmlFor = select.id; field.append(caption, select); row.append(field); fields[key] = select; }
      if (isOwner() && !protectedAccount) { const save = element('button', 'Lưu quyền', 'secondary-button'); save.type = 'button'; save.dataset.ownerAction = 'account'; save.addEventListener('click', () => act(async () => { if (!isOwner()) return; await request('/api/admin/users', { accountId: account.id, name: account.name, role: fields.role.value, status: fields.status.value, expectedRevision: account.revision, operationId: crypto.randomUUID() }); await fetchUsers(); notify('Đã cập nhật quyền tài khoản.'); })); row.append(save); } else row.append(element('span', protectedAccount ? 'Được bảo vệ' : 'Chỉ đọc', 'badge'));
      list.append(row);
    }
    updateControls();
  }
  async function fetchUsers() { if (!isOwner()) { state.accounts = [state.account]; renderUsers(); return; } const data = await request('/api/admin/users'); if (!Array.isArray(data.accounts)) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' }); state.accounts = data.accounts.slice(0, 200); renderUsers(); }
  function showView(view, focus = true) { for (const section of ['flow', 'users', 'history']) { $(`${section}-panel`).hidden = view !== section; const button = $(`nav-${section}`); button.classList.toggle('active', view === section); if (view === section) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current'); } if (focus) { const heading = $(`${view}-title`); heading.tabIndex = -1; heading.focus(); } }
  function requestLoad(branch) { if (!BRANCHES.includes(branch) || state.busy) return; if (state.dirty) { state.pendingLoad = branch; $('branch-select').value = state.branch; $('discard-description').textContent = branch === state.branch ? 'Tải bản server sẽ bỏ các thay đổi chưa lưu trong tab này.' : `Chuyển sang “${BRANCH_LABELS[branch]}” sẽ bỏ các thay đổi chưa lưu của nhánh hiện tại.`; $('discard-dialog').showModal(); } else act(async () => { await fetchFlow(branch); clearNotice(); }); }
  $('show-setup').addEventListener('click', () => showSetup($('setup-panel').hidden));
  $('refresh-setup').addEventListener('click', () => act(async () => { await refreshSetup(); if (!state.account) $('gate-message').textContent = loginInvitation(); }));
  for (const key of ['origin', 'callback']) $(`copy-setup-${key}`).addEventListener('click', async () => { const text = $(`setup-${key}`).textContent; try { if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) throw new Error('clipboard_unavailable'); await navigator.clipboard.writeText(text); $('setup-status').textContent = 'Đã sao chép địa chỉ hiển thị. Checklist không xác minh đăng nhập thực tế.'; } catch { $('setup-status').textContent = 'Trình duyệt chưa cho phép sao chép. Chọn và sao chép địa chỉ hiển thị bên trên.'; } });
  $('branch-select').addEventListener('change', () => requestLoad($('branch-select').value));
  $('reload-flow').addEventListener('click', () => requestLoad(state.branch));
  $('discard-cancel').addEventListener('click', () => { state.pendingLoad = null; $('discard-dialog').close(); });
  $('discard-dialog').addEventListener('cancel', () => { state.pendingLoad = null; });
  $('discard-confirm').addEventListener('click', () => act(async () => { if (!state.pendingLoad) return; const branch = state.pendingLoad; await fetchFlow(branch); state.pendingLoad = null; $('discard-dialog').close(); clearNotice(); }));
  $('upgrade-flow').addEventListener('click', () => { if (!canEdit() || state.busy || state.mutationUncertain || state.working?.schemaVersion !== 1) return; const template = canonicalUpgradeTemplate(); if (!template) { notify('Chưa có mẫu nâng cấp hợp lệ cho nhánh này từ server. Bản nháp cũ được giữ.', true); return; } const upgraded = structuredClone(template); upgraded.name = state.working.name; const old = state.working.nodes.find(node => node.kind === 'presentation'); const next = upgraded.nodes.find(node => node.kind === 'presentation'); next.tone = old.tone; next.depth = old.depth; state.working = upgraded; markDirty(); renderFlow(); notify('Đã tạo bản nháp cấu trúc mới trong tab. Hai chỉ dẫn dùng bản gốc từ server; hãy kiểm tra và lưu trước khi phát hành.'); });
  $('flow-name').addEventListener('input', () => { if (!canChangeFlow() || state.busy || !state.working) return; state.working.name = $('flow-name').value; markDirty(); });
  $('save-draft').addEventListener('click', () => act(async () => { if (!canChangeFlow() || !validFlow(state.working) || state.mutationUncertain || !state.dirty && state.snapshot.draft.revision !== 0) return; const saved = structuredClone(state.working); const data = await request('/api/admin/flow/draft', { flow: saved, expectedRevision: state.snapshot.draft.revision, operationId: crypto.randomUUID() }); await afterMutation(data); notify('Đã lưu bản nháp. Phiên bản đang chạy chưa thay đổi.'); }));
  $('preview-flow').addEventListener('click', () => act(async () => { if (!validFlow(state.working)) return; const data = await request('/api/admin/flow/preview', { flow: structuredClone(state.working), operationId: crypto.randomUUID() }); renderPreview(data.preview); notify('Đã lắp ghép ngữ cảnh giả lập · 0 lượt gọi model.'); }));
  $('publish-flow').addEventListener('click', () => { if (!isOwner() || state.busy || state.mutationUncertain || state.dirty || !state.snapshot?.draft.revision) return; const diff = flowDiff(state.snapshot.production?.flow, state.snapshot.draft.flow); const list = $('publish-diff'); list.replaceChildren(); if (!diff.length) list.append(element('p', 'Nội dung giống phiên bản đang chạy. Phát hành sẽ ghi thêm một phiên bản và nhật ký.', 'muted')); for (const change of diff) { const row = element('div', undefined, 'diff-item'); row.append(element('strong', change.label), element('span', `Trước: ${change.before}`, 'diff-before'), element('span', `Sau: ${change.after}`, 'diff-after')); list.append(row); } state.pendingPublish = { branch: state.branch, expectedRevision: state.snapshot.draft.revision, expectedProductionRevision: state.snapshot.production?.revision ?? 0, flow: JSON.stringify(state.snapshot.draft.flow) }; if ($('publish-dialog-error')) $('publish-dialog-error').hidden = true; updateControls(); $('publish-dialog').showModal(); });
  $('publish-cancel').addEventListener('click', () => { state.pendingPublish = null; $('publish-dialog').close(); updateControls(); });
  $('publish-dialog').addEventListener('cancel', () => { state.pendingPublish = null; updateControls(); });
  $('publish-confirm').addEventListener('click', () => act(async () => { const pending = state.pendingPublish; if (!$('publish-dialog').open || !pending || !isOwner() || state.mutationUncertain || state.dirty || pending.branch !== state.branch || pending.expectedRevision !== state.snapshot?.draft.revision || pending.flow !== JSON.stringify(state.snapshot?.draft.flow)) return; const data = await request('/api/admin/flow/publish', { branch: pending.branch, expectedRevision: pending.expectedRevision, expectedProductionRevision: pending.expectedProductionRevision, operationId: crypto.randomUUID() }); await afterMutation(data); state.pendingPublish = null; $('publish-dialog').close(); notify('Đã phát hành bản nháp đã lưu. Phiên bản mới và nhật ký đã được cập nhật.'); }));
  $('rollback-cancel').addEventListener('click', () => { state.pendingRollback = null; $('rollback-dialog').close(); });
  $('rollback-dialog').addEventListener('cancel', () => { state.pendingRollback = null; });
  $('rollback-confirm').addEventListener('click', () => act(async () => { if (!$('rollback-dialog').open || !isOwner() || state.mutationUncertain || !state.pendingRollback) return; const data = await request('/api/admin/flow/rollback', { branch: state.branch, releaseId: state.pendingRollback.id, expectedProductionRevision: state.snapshot.production?.revision ?? 0, operationId: crypto.randomUUID() }); await afterMutation(data, true); state.pendingRollback = null; $('rollback-dialog').close(); notify('Đã khôi phục phiên bản đang chạy. Bản nháp và các chỉnh sửa trong tab này được giữ.'); }));
  $('invite-form').addEventListener('submit', event => { event.preventDefault(); if (!isOwner() || state.busy) return; const id = $('invite-id').value.trim(); const name = $('invite-name').value.trim(); if (!/^[1-9][0-9]{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)) || !name || name.length > 80) { notify('Điền Telegram ID dạng số hợp lệ và tên hiển thị tối đa 80 ký tự.', true); return; } act(async () => { await request('/api/admin/users', { accountId: id, name, role: $('invite-role').value, status: $('invite-status').value, expectedRevision: 0, operationId: crypto.randomUUID() }); await fetchUsers(); $('invite-form').reset(); notify('Đã cấp quyền tài khoản Telegram. Thành viên có thể đăng nhập studio.'); }); });
  for (const view of ['flow', 'users', 'history']) $(`nav-${view}`).addEventListener('click', () => { showView(view); if (view === 'users') act(fetchUsers); });
  $('login-button').addEventListener('click', () => act(async () => { if (!state.loginReady) return; const data = await request('/api/admin/auth/start', {}, false); const url = adminAuthorizationUrl(data.authorizationUrl); if (!url) throw Object.assign(new Error('unsafe_authorization_url'), { reason: 'unsafe_authorization_url' }); window.location.assign(url); }));
  $('logout-button').addEventListener('click', () => act(async () => { await request('/api/admin/logout', {}); state.account = null; state.csrf = ''; state.snapshot = null; state.working = null; state.dirty = false; state.accounts = []; state.loginReady = setupLoginReady(state.setup); $('admin-workspace').hidden = true; $('session-controls').hidden = true; $('admin-gate').hidden = false; $('gate-message').textContent = `Bạn đã đăng xuất. ${loginInvitation()}`; }));
  window.addEventListener('beforeunload', event => { if (!state.dirty) return; event.preventDefault(); event.returnValue = ''; });
  try {
    if (!await refreshSetup()) { $('gate-message').textContent = loginInvitation(); updateControls(); return; }
    try {
      const me = await request('/api/admin/me');
      if (!record(me.account) || !Object.hasOwn(ROLES, me.account.role) || me.account.status !== 'active' || typeof me.csrf !== 'string' || !me.csrf) throw Object.assign(new Error('malformed_response'), { reason: 'malformed_response' });
      state.account = me.account; state.csrf = me.csrf;
    } catch (error) { if (error?.status === 401) { $('gate-message').textContent = loginInvitation(); state.loginReady = setupLoginReady(state.setup); updateControls(); return; } throw error; }
    $('account-label').textContent = state.account.name || 'Thành viên'; $('account-role').textContent = ROLES[state.account.role];
    $('admin-gate').hidden = true; $('admin-workspace').hidden = false; $('session-controls').hidden = false;
    await act(() => fetchFlow('conversation')); showView('flow', false);
    const query = new URLSearchParams(window.location.search);
    if (query.has('error')) notify('Telegram chưa xác nhận đăng nhập. Bạn có thể thử lại bằng tài khoản đã được cấp quyền.', true);
  } catch (error) { $('gate-message').textContent = adminErrorMessage(error?.reason, error?.status); $('login-button').disabled = true; }
}
if (typeof document !== 'undefined') initializeAdmin();
