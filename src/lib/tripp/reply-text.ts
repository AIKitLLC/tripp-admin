/** Technical display validation only. Content judgments do not veto model replies. */
export type ReplyTextInspection = { accepted: true; text: string }
  | { accepted: false; reason: 'empty' | 'length' | 'controls' };
// eslint-disable-next-line no-control-regex
const CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u;
export function inspectGeneratedText(value: unknown, maximum = 6000): ReplyTextInspection {
  if (typeof value !== 'string' || !value.trim()) return { accepted: false, reason: 'empty' };
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 6000 || value.length > maximum) return { accepted: false, reason: 'length' };
  if (CONTROLS.test(value)) return { accepted: false, reason: 'controls' };
  // The UI uses textContent: markup, links and entities are inert reply data.
  // Preserve tabs and normalize ordinary line endings without parsing HTML.
  return { accepted: true, text: value.replace(/\r\n?/g, '\n').trim() };
}
