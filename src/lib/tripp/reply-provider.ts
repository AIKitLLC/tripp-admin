import { MAX_OUTPUT_TOKENS, MODEL } from './inference';
import { openAIReplyFormat, type ReplySchema } from './reply-schema';

export const LUNA_REPLY_MODEL = 'openai/gpt-6-luna' as const;
export interface ReplyProviderEnv { AI: Ai; REPLY_MODEL?: string; AI_GATEWAY_ID?: string }
export type ReplyProviderConfig = Readonly<{ provider: 'workers_ai'; model: typeof MODEL }>
  | Readonly<{ provider: 'openai_gateway'; model: typeof LUNA_REPLY_MODEL; gatewayId: string }>;
type ReplyMessage = { role: 'system' | 'user'; content: string };

export class ReplyConfigurationError extends Error {
  constructor() { super('reply_configuration_invalid'); }
}

function configurationValue(env: ReplyProviderEnv, key: 'REPLY_MODEL' | 'AI_GATEWAY_ID', absentValue: unknown = undefined): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(env, key);
    if (!descriptor) {
      if (key in env) throw new ReplyConfigurationError();
      return absentValue;
    }
    if (!descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw new ReplyConfigurationError();
    return descriptor.value;
  } catch { throw new ReplyConfigurationError(); }
}

function validGatewayId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(value);
}

export function resolveReplyProvider(env: ReplyProviderEnv): ReplyProviderConfig {
  const model = configurationValue(env, 'REPLY_MODEL');
  if (model === undefined || model === MODEL) return Object.freeze({ provider: 'workers_ai', model: MODEL });
  if (model !== LUNA_REPLY_MODEL) throw new ReplyConfigurationError();
  const gatewayId = configurationValue(env, 'AI_GATEWAY_ID', 'default');
  if (!validGatewayId(gatewayId)) throw new ReplyConfigurationError();
  return Object.freeze({ provider: 'openai_gateway', model: LUNA_REPLY_MODEL, gatewayId });
}

// These suffixes belong to fixed system instructions, before the branch/language
// framing. User JSON is never searched or rewritten.
const SYSTEM_SUFFIXES = [
  'Follow the native schema; no reasoning. /no_think',
  'Prefer readable paragraphs within JSON strings; no reasoning. /no_think',
  'Return only the branch\'s exact JSON, no reasoning. /no_think',
  'Return only the branch\'s required JSON fields and optional quick_options, no reasoning. /no_think',
  'Return branch JSON only; no reasoning. /no_think',
  'No markdown, HTML, URLs, keys other than reply/quick_options, or reasoning. /no_think',
  'No markdown, HTML, URLs, other keys or reasoning. /no_think',
  'Không giải thích quy tắc. /no_think',
];
function lunaMessages(messages: readonly ReplyMessage[]): ReplyMessage[] {
  return messages.map(message => {
    let content = message.content;
    if (message.role === 'system') for (const suffix of SYSTEM_SUFFIXES) {
      content = content.replace(suffix, suffix.slice(0, -' /no_think'.length));
    }
    if (message.role === 'user' && content.endsWith('\n/no_think')) content = content.slice(0, -'\n/no_think'.length);
    return { role: message.role, content };
  });
}

function plainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
  catch { return false; }
}
function ownValue(value: unknown, key: string): unknown {
  if (!plainObject(value)) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
  } catch { return undefined; }
}
function dataObject(value: unknown): value is Record<string, unknown> {
  if (!plainObject(value)) return false;
  try {
    return Reflect.ownKeys(value).every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return typeof key === 'string' && descriptor?.enumerable && Object.hasOwn(descriptor, 'value');
    });
  } catch { return false; }
}
function reportedUsage(result: unknown) {
  const usage = ownValue(result, 'usage');
  const input = ownValue(usage, 'prompt_tokens');
  const output = ownValue(usage, 'completion_tokens');
  const finite = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
  if (!finite(input) && !finite(output)) return undefined;
  return { prompt_tokens: finite(input) ? input : 0, completion_tokens: finite(output) ? output : 0 };
}

function singleChoice(value: unknown): unknown {
  if (!Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Array.prototype && prototype !== null) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== 2 || !keys.includes('0') || !keys.includes('length')) return undefined;
    const length = Object.getOwnPropertyDescriptor(value, 'length');
    const choice = Object.getOwnPropertyDescriptor(value, '0');
    if (length?.value !== 1 || !choice?.enumerable || !Object.hasOwn(choice, 'value')) return undefined;
    return choice.value;
  } catch { return undefined; }
}

/** Only one completed final answer reaches the existing JSON/output gates. */
export function normalizeLunaReply(result: unknown): { response?: string; usage?: { prompt_tokens: number; completion_tokens: number } } {
  const usage = reportedUsage(result);
  const rejected = usage ? { usage } : {};
  if (!dataObject(result) || ['response', 'output', 'output_text', 'error'].some(key => Object.hasOwn(result, key))) return rejected;
  if (Object.hasOwn(result, 'object') && ownValue(result, 'object') !== 'chat.completion') return rejected;
  const choice = singleChoice(ownValue(result, 'choices'));
  if (!dataObject(choice) || ownValue(choice, 'index') !== 0 || ownValue(choice, 'finish_reason') !== 'stop'
    || Object.hasOwn(choice, 'delta')) return rejected;
  const message = ownValue(choice, 'message');
  if (!dataObject(message) || ownValue(message, 'role') !== 'assistant'
    || ['tool_calls', 'function_call'].some(key => Object.hasOwn(message, key))) return rejected;
  const refusal = ownValue(message, 'refusal');
  if (refusal !== undefined && refusal !== null) return rejected;
  const response = ownValue(message, 'content');
  if (typeof response !== 'string' || !response.trim()) return rejected;
  return { response, ...rejected };
}

function providerFailure(error: unknown): Error {
  const failure = new Error('provider_error');
  if (!error || typeof error !== 'object') return failure;
  try {
    const descriptors = ['status', 'statusCode'].map(key => Object.getOwnPropertyDescriptor(error, key))
      .filter(descriptor => descriptor !== undefined);
    if (descriptors.some(descriptor => !Object.hasOwn(descriptor, 'value'))) return failure;
    const statuses = descriptors.map(descriptor => descriptor!.value);
    if (statuses.length && statuses.every(status => Number.isInteger(status) && status >= 100 && status <= 599)
      && new Set(statuses).size === 1) Object.assign(failure, { status: statuses[0] });
  } catch { /* Unavailable structured status stays absent. */ }
  return failure;
}

export async function runReplyProvider(env: ReplyProviderEnv, config: ReplyProviderConfig,
  messages: readonly ReplyMessage[], qwenTemperature: number, schema: ReplySchema): Promise<unknown> {
  if (config.provider === 'workers_ai' && config.model === MODEL) {
    return env.AI.run(MODEL, { messages: [...messages], max_tokens: MAX_OUTPUT_TOKENS,
      temperature: qwenTemperature, response_format: { type: 'json_schema', json_schema: schema.schema } });
  }
  if (config.provider !== 'openai_gateway' || config.model !== LUNA_REPLY_MODEL || !validGatewayId(config.gatewayId)) {
    throw new ReplyConfigurationError();
  }
  let result: unknown;
  try {
    result = await env.AI.run(LUNA_REPLY_MODEL, { messages: lunaMessages(messages),
      max_completion_tokens: MAX_OUTPUT_TOKENS, reasoning_effort: 'none', response_format: openAIReplyFormat(schema),
      store: false, stream: false, n: 1, service_tier: 'default' },
    { gateway: { id: config.gatewayId, skipCache: true, collectLog: false, retries: { maxAttempts: 1 } } });
  } catch (error) { throw providerFailure(error); }
  return normalizeLunaReply(result);
}
