import type { ReadingSession } from './reading-schema';

/** Client registration is a UI capability request, never an executable tool or prompt. */
export const CLIENT_TOOL_VERSION = 1;
export const CLIENT_TOOL_NAME = 'ui.open_spread_picker';
export const CLIENT_TOOL_SCHEMA = 'tripp.ui.open-spread-picker.v1';
export const CLIENT_TOOL_TTL_MS = 5 * 60 * 1000;
export const CLIENT_TOOL_CONTRACT = Object.freeze({
  version: CLIENT_TOOL_VERSION,
  capabilities: Object.freeze([Object.freeze({ name: CLIENT_TOOL_NAME, version: 1, schemaId: CLIENT_TOOL_SCHEMA,
    inputSchema: Object.freeze({ type: 'object', properties: Object.freeze({}), additionalProperties: false }),
    effect: 'open_spread_picker', authority: 'ui_only', consent: 'single_use_session_state_challenge',
  })]),
});
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export interface ClientToolManifest { version: 1; capabilities: [{ name: typeof CLIENT_TOOL_NAME; version: 1; schemaId: typeof CLIENT_TOOL_SCHEMA }] }
export interface ClientToolCall { version: 1; requestId: string; registrationId: string; capability: typeof CLIENT_TOOL_NAME;
  schemaId: typeof CLIENT_TOOL_SCHEMA; args: Record<string, never>; consent: { challengeId: string; decision: 'accept' } }
export interface ClientToolRevocation { version: 1; registrationId: string }

function exact(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_client_tool');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).length !== keys.length || !keys.every(key => Object.hasOwn(item, key))) throw new Error('invalid_client_tool');
  return item;
}
export function validateClientToolManifest(value: unknown): ClientToolManifest {
  const item = exact(value, ['version', 'capabilities']);
  if (item.version !== CLIENT_TOOL_VERSION || !Array.isArray(item.capabilities) || item.capabilities.length !== 1) throw new Error('invalid_client_tool');
  const capability = exact(item.capabilities[0], ['name', 'version', 'schemaId']);
  if (capability.name !== CLIENT_TOOL_NAME || capability.version !== 1 || capability.schemaId !== CLIENT_TOOL_SCHEMA) throw new Error('invalid_client_tool');
  // Return a fresh trusted representation. No client descriptions, schema objects,
  // instructions, arbitrary names or functions ever reach storage or an LLM.
  return { version: 1, capabilities: [{ name: CLIENT_TOOL_NAME, version: 1, schemaId: CLIENT_TOOL_SCHEMA }] };
}
export function validateClientToolCall(value: unknown): ClientToolCall {
  const item = exact(value, ['version', 'requestId', 'registrationId', 'capability', 'schemaId', 'args', 'consent']);
  const consent = exact(item.consent, ['challengeId', 'decision']);
  exact(item.args, []);
  if (item.version !== 1 || item.capability !== CLIENT_TOOL_NAME || item.schemaId !== CLIENT_TOOL_SCHEMA
    || typeof item.requestId !== 'string' || !UUID.test(item.requestId) || typeof item.registrationId !== 'string' || !UUID.test(item.registrationId)
    || typeof consent.challengeId !== 'string' || !UUID.test(consent.challengeId) || consent.decision !== 'accept') throw new Error('invalid_client_tool');
  return { version: 1, requestId: item.requestId, registrationId: item.registrationId, capability: CLIENT_TOOL_NAME,
    schemaId: CLIENT_TOOL_SCHEMA, args: {}, consent: { challengeId: consent.challengeId, decision: 'accept' } };
}
export function validateClientToolRevocation(value: unknown): ClientToolRevocation {
  const item = exact(value, ['version', 'registrationId']);
  if (item.version !== 1 || typeof item.registrationId !== 'string' || !UUID.test(item.registrationId)) throw new Error('invalid_client_tool');
  return { version: 1, registrationId: item.registrationId };
}
export function clientToolState(reading: ReadingSession | null, latestMessageId: string): string {
  return JSON.stringify({ readingId: reading?.id ?? null, updatedAt: reading?.updatedAt ?? null, latestMessageId });
}
export function clientToolAvailable(reading: ReadingSession | null): boolean {
  return !reading || reading.step === 'select_spread' || reading.newSessionOffered;
}
