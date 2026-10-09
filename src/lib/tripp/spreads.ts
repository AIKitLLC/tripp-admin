export type SpreadId = 'daily' | 'three' | 'love' | 'money' | 'yes_no' | 'yearly';
export interface LocalizedText { readonly vi: string; readonly en: string }
export interface SpreadPosition {
  readonly id: string;
  readonly label: LocalizedText;
  readonly meaning: LocalizedText;
}
export interface SpreadConfig {
  readonly id: SpreadId;
  readonly version: string;
  readonly name: LocalizedText;
  readonly description: LocalizedText;
  readonly count: number;
  readonly positions: readonly SpreadPosition[];
  /** Exact native app labels/behavior are not verified; this config is a demo adaptation. */
  readonly proposed: true;
  readonly provenance: 'listing_adapted_demo';
  readonly countSource: 'developer_listing' | 'demo_proposal';
}

export const SPREAD_IDS: readonly SpreadId[] = Object.freeze(['daily', 'three', 'love', 'money', 'yes_no', 'yearly']);
export const SPREAD_CONFIG_VERSION = 'demo-spreads-v1';
export const LISTING_SPREAD_COUNTS: Readonly<Record<SpreadId, number>> = Object.freeze({ daily: 1, three: 3, love: 3, money: 3, yes_no: 1, yearly: 12 });
const text = (vi: string, en: string): LocalizedText => ({ vi, en });
const position = (id: string, vi: string, en: string, meaningVi: string, meaningEn: string): SpreadPosition =>
  ({ id, label: text(vi, en), meaning: text(meaningVi, meaningEn) });
function config(id: SpreadId, vi: string, en: string, descriptionVi: string, descriptionEn: string, positions: SpreadPosition[]): SpreadConfig {
  return snapshotSpread({ id, version: SPREAD_CONFIG_VERSION, name: text(vi, en), description: text(descriptionVi, descriptionEn),
    count: positions.length, positions, proposed: true, provenance: 'listing_adapted_demo', countSource: 'developer_listing' });
}

const monthVi = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
const monthEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Counts are described by the developer's public listing; labels/meanings are configurable original adaptations. */
export const SPREAD_CONFIGS: readonly SpreadConfig[] = Object.freeze([
  config('daily', 'Thông điệp hôm nay', 'Daily', 'Một điểm tựa nhẹ nhàng cho ngày đang xem.', 'A gentle anchor for the day you are viewing.', [
    position('focus', 'Điểm tựa hôm nay', 'Today’s anchor', 'Một biểu tượng để suy ngẫm về ngày đang xem và chọn một việc nhỏ trong tầm kiểm soát.', 'A symbol to reflect on the viewing day and choose one small step within your control.'),
  ]),
  config('three', 'Trải ba lá', 'Three-card spread', 'Nhìn lại, nhìn hiện tại và cân nhắc bước tới.', 'Reflect on the past, the present and a possible next step.', [
    position('past', 'Điều đã qua', 'Past', 'Bài học từ bối cảnh người dùng đã kể; không đoán thêm sự kiện trong quá khứ.', 'Lessons from the past context the user shared; do not invent past events.'),
    position('present', 'Điều đang có', 'Present', 'Nhu cầu, nguồn lực hoặc khó khăn hiện tại được người dùng xác nhận.', 'Needs, resources or difficulties in the user’s confirmed present context.'),
    position('next', 'Bước tới có thể chọn', 'Possible next step', 'Một hướng hành động có thể cân nhắc, không phải dự báo tương lai chắc chắn.', 'A possible action to consider, not a certain forecast.'),
  ]),
  config('love', 'Tarot tình cảm', 'Love tarot', 'Lắng nghe cảm xúc và chăm sóc sự kết nối bằng đối thoại.', 'Listen to feelings and care for connection through conversation.', [
    position('past_feelings', 'Cảm xúc từ điều đã qua', 'Past feelings', 'Soi chiếu trải nghiệm và nhu cầu mà người dùng tự chia sẻ, không đọc suy nghĩ của người khác.', 'Reflect on experiences and needs the user shared, without reading anyone else’s thoughts.'),
    position('present_connection', 'Sự kết nối hiện tại', 'Present connection', 'Nhìn nhịp giao tiếp, sự đồng thuận và cảm nhận hiện tại đã được kể; không kết luận phản bội.', 'Consider shared communication, consent and current feelings; do not infer betrayal.'),
    position('respectful_step', 'Bước chăm sóc kết nối', 'A respectful next step', 'Một bước giao tiếp hoặc ranh giới tôn trọng có thể thử; không khẳng định quan hệ sẽ đi về đâu.', 'A respectful communication or boundary step to try, without claiming where the relationship will go.'),
  ]),
  config('money', 'Tarot công việc & tiền bạc', 'Money tarot', 'Nhìn nguồn lực và một bước thực tế; không đưa lời khuyên đầu tư.', 'Review resources and a practical step, without investment advice.', [
    position('resources', 'Nguồn lực đang có', 'Current resources', 'Kỹ năng, thời gian và hỗ trợ liên quan đến công việc hoặc hoàn cảnh đã chia sẻ.', 'Skills, time and support relevant to the shared employment or life context.'),
    position('challenge', 'Điều cần lưu tâm', 'Current challenge', 'Một khó khăn hoặc giả định để kiểm tra bằng dữ kiện thực tế.', 'A difficulty or assumption to check against real evidence.'),
    position('practical_step', 'Bước thực tế tiếp theo', 'Practical next step', 'Một việc nhỏ để tìm thông tin, học hoặc lên kế hoạch; không chọn khoản đầu tư hay bảo đảm thu nhập.', 'A small information, learning or planning step; do not select investments or guarantee income.'),
  ]),
  config('yes_no', 'Một câu hỏi rõ', 'Yes / no', 'Suy ngẫm về một câu hỏi với hướng có thể là có, không hoặc chưa rõ.', 'Reflect on one question with a tentative yes, no or unclear direction.', [
    position('direction', 'Gợi ý để cân nhắc', 'Direction to consider', 'Dựa vào biểu tượng và bối cảnh, trình bày có thể là có, không hoặc chưa rõ, kèm lý do và quyền lựa chọn của người dùng.', 'Offer a tentative yes, no or unclear reflection grounded in the symbol and context, with reasons and the user’s agency.'),
  ]),
  config('yearly', 'Tarot theo năm', 'Yearly tarot', 'Mười hai điểm suy ngẫm cho năm đã xác nhận; không phải dự báo sự kiện.', 'Twelve reflection prompts for the confirmed year, not event predictions.',
    monthVi.map((label, index) => position(`month_${index + 1}`, label, monthEn[index],
      `Một chủ đề suy ngẫm và hành động vừa sức cho tháng ${index + 1} của năm đã xác nhận; không đoán sự kiện sẽ xảy ra.`,
      `A reflective theme and manageable action for ${monthEn[index]} of the confirmed year; do not predict events.`))),
]);

function localized(value: unknown): value is LocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return Object.keys(item).length === 2 && ['vi', 'en'].every(key => typeof item[key] === 'string' && String(item[key]).trim().length > 0 && String(item[key]).length <= 1000);
}

/** Validate configuration before confirmation/draw, including every exact position meaning. */
export function validateSpreadConfig(value: unknown): SpreadConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const keys = ['id', 'version', 'name', 'description', 'count', 'positions', 'proposed', 'provenance', 'countSource'];
  if (Object.keys(item).length !== keys.length || !keys.every(key => Object.hasOwn(item, key))
    || !SPREAD_IDS.includes(item.id as SpreadId) || typeof item.version !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(item.version)
    || !localized(item.name) || !localized(item.description) || !Number.isSafeInteger(item.count)
    || Number(item.count) < 1 || Number(item.count) > 78 || !Array.isArray(item.positions) || item.positions.length !== item.count
    || item.proposed !== true || item.provenance !== 'listing_adapted_demo'
    || !['developer_listing', 'demo_proposal'].includes(String(item.countSource))
    || (item.countSource === 'developer_listing' && item.count !== LISTING_SPREAD_COUNTS[item.id as SpreadId])) return null;
  const positionIds = new Set<string>();
  for (const pos of item.positions) {
    if (!pos || typeof pos !== 'object' || Array.isArray(pos) || Object.keys(pos).length !== 3
      || typeof pos.id !== 'string' || !/^[a-z][a-z0-9_]{0,39}$/.test(pos.id) || positionIds.has(pos.id)
      || !localized(pos.label) || !localized(pos.meaning)) return null;
    positionIds.add(pos.id);
  }
  return freezeSpread(JSON.parse(JSON.stringify(item)) as SpreadConfig);
}

function freezeSpread(config: SpreadConfig): SpreadConfig {
  Object.freeze(config.name); Object.freeze(config.description);
  for (const pos of config.positions) { Object.freeze(pos.label); Object.freeze(pos.meaning); Object.freeze(pos); }
  Object.freeze(config.positions);
  return Object.freeze(config);
}

/** Independent frozen snapshot: later admin edits cannot alter a confirmed reading. */
export function snapshotSpread(config: SpreadConfig): SpreadConfig {
  const validated = validateSpreadConfig(config);
  if (!validated) throw new Error('spread_config');
  return validated;
}

export function getSpreadConfig(id: string): SpreadConfig | null {
  const config = SPREAD_CONFIGS.find(item => item.id === id);
  return config ? snapshotSpread(config) : null;
}
