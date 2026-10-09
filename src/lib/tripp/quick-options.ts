import { inspectGeneratedText } from './reply-text';
export const MAX_QUICK_OPTIONS = 5;
export const MAX_QUICK_OPTION_CHARACTERS = 180;
export const MAX_QUICK_OPTION_BYTES = 512;
// Optional single-line button labels keep their existing format cleanup.
// Dropping a label never rejects its accompanying generated answer.
const OPTION_FORMAT = /[<>`*_#[\]]|(?:https?:\/\/|www\.|javascript:|data:)|\b[a-z0-9-]+\.(?:com|org|net|io|ai|vn|app|dev|co)(?:\/|\b)/i;
export const QUICK_OPTIONS_INSTRUCTION = 'Required quick_options: SAME JSON response; preferably 3–4, at most 5 editable contextual alternatives in reply language; <=180 Unicode chars/512 UTF-8 bytes each. No tools/consent/auto-send; [] only for closure/distress/no-questions. No extra call.';
/** Optional untrusted data: malformed entries never prevent a valid answer. */
export function normalizeQuickOptions(value: unknown): string[] {
  try {
    if (!Array.isArray(value)) return [];
    const options: string[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < Math.min(value.length, MAX_QUICK_OPTIONS); index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') continue;
      const option = descriptor.value.trim();
      if (Array.from(option).length > MAX_QUICK_OPTION_CHARACTERS || new TextEncoder().encode(option).byteLength > MAX_QUICK_OPTION_BYTES
        || /[\t\r\n\uD800-\uDFFF]/u.test(option) || OPTION_FORMAT.test(option) || !inspectGeneratedText(option).accepted) continue;
      const key = option.normalize('NFC').toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); options.push(option);
    }
    return options;
  } catch { return []; }
}
export function quickOptionsField(data: Record<string, unknown>): { quickOptions?: string[] } {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(data, 'quick_options');
    const quickOptions = normalizeQuickOptions(descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined);
    return quickOptions.length ? { quickOptions } : {};
  } catch { return {}; }
}
export function quickOptionsMetadata(value: unknown): { quickOptions?: string[]; quickOptionsLanguage?: string; quickOptionsReadingId?: string | null } {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const field = (key: string) => { const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined; };
    const quickOptions = normalizeQuickOptions(field('quickOptions'));
    if (!quickOptions.length) return {};
    const language = field('quickOptionsLanguage'), readingId = field('quickOptionsReadingId');
    if (typeof language !== 'string' || !['vi', 'en', 'es', 'fr', 'ja', 'zh', 'other'].includes(language)
      || !(readingId === null || typeof readingId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(readingId))) return {};
    return { quickOptions, quickOptionsLanguage: language, quickOptionsReadingId: readingId };
  } catch { return {}; }
}
