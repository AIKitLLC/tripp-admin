import { READING_ACTIONS, isModelAction, type ReadingAction } from './reading-flow';
import { READING_INTENTS } from './reading-decision';
import type { ReadingOutputPart, ReadingOutputRejection } from './reading-output';
import type { PrivateFactRule } from './policy';

export const DIAGNOSTIC_REPLY_BRANCHES = ['not_selected', 'interpret', 'extra_interpret', 'new_reading_offer', 'conversation', ...READING_INTENTS] as const;
export type DiagnosticReplyBranch = typeof DIAGNOSTIC_REPLY_BRANCHES[number];
export function diagnosticReplyBranch(branch: string): DiagnosticReplyBranch {
  return DIAGNOSTIC_REPLY_BRANCHES.find(candidate => candidate === branch) ?? 'not_selected';
}
const STAGES = ['decision', 'reply'] as const;
export const READING_FAILURE_REASONS = ['timeout', 'output_gate', 'context_budget', 'context_configuration', 'all_cards_must_be_flipped', 'session_changed', 'provider_error'] as const;
export type ReadingFailureReason = typeof READING_FAILURE_REASONS[number];
export interface ReadingFailureDiagnostics {
  version: 1;
  action: ReadingAction;
  stage: typeof STAGES[number];
  reason: ReadingFailureReason;
  replyBranch: DiagnosticReplyBranch;
  providerStatus: number | 'unavailable';
  gate?: ReadingOutputRejection;
  outputPart?: ReadingOutputPart;
  privateFactRule?: PrivateFactRule;
}
const GATES: Record<ReadingOutputRejection, true> = {
  provider_envelope: true, malformed_json: true, unexpected_keys: true, invalid_reply: true, invalid_proposal: true,
  card_contract: true, context_references: true, field_bounds: true, unsafe_text: true, rendered_bounds: true,
  empty: true, length: true, controls: true, markup: true, unsafe_claim: true, unsupported_private_fact: true,
  knowledge_contract: true, metadata_claim: true,
};
const PARTS: Record<ReadingOutputPart, true> = { plain_reply: true, proposal: true, key_point: true, card_application: true,
  next_step: true, knowledge_application: true, knowledge_question: true, combined_dynamic_text: true, rendered_body: true };
const RULES: Record<PrivateFactRule, true> = { birth_derived: true, other_person_state: true, relationship_state: true,
  user_state: true, user_history: true, user_ability: true, relative_personal_past: true, presupposed_recovery: true };
const REQUIRED = ['version', 'action', 'stage', 'reason', 'replyBranch', 'providerStatus'];
const OPTIONAL = ['gate', 'outputPart', 'privateFactRule'];
function code<T extends string>(value: unknown, choices: Record<T, true>): value is T {
  return typeof value === 'string' && Object.hasOwn(choices, value);
}
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}
export function validateReadingFailureDiagnostics(value: unknown, expected?: { action?: unknown; reason?: unknown }): ReadingFailureDiagnostics | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string' || ![...REQUIRED, ...OPTIONAL].includes(key))
      || REQUIRED.some(key => !Object.hasOwn(value, key))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Object.values(descriptors).some(descriptor => !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable)) return null;
    const fields = Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
    const action = READING_ACTIONS.find(action => action === fields.action);
    const stage = STAGES.find(stage => stage === fields.stage);
    const reason = READING_FAILURE_REASONS.find(reason => reason === fields.reason);
    const replyBranch = DIAGNOSTIC_REPLY_BRANCHES.find(branch => branch === fields.replyBranch);
    const providerStatus = fields.providerStatus;
    if (fields.version !== 1 || !action || !isModelAction(action) || !stage || !reason || !replyBranch
      || !(providerStatus === 'unavailable' || typeof providerStatus === 'number' && Number.isInteger(providerStatus) && providerStatus >= 100 && providerStatus <= 599)) return null;
    if (expected && (Object.hasOwn(expected, 'action') && action !== expected.action
      || Object.hasOwn(expected, 'reason') && expected.reason !== `${stage}_${reason}`)) return null;
    const gate = fields.gate, outputPart = fields.outputPart, privateFactRule = fields.privateFactRule;
    if (Object.hasOwn(fields, 'gate') && (!code(gate, GATES) || stage !== 'reply' || reason !== 'output_gate')) return null;
    if (Object.hasOwn(fields, 'outputPart') && (!code(outputPart, PARTS) || !code(gate, GATES) || stage !== 'reply' || reason !== 'output_gate')) return null;
    if (Object.hasOwn(fields, 'privateFactRule') && (!code(privateFactRule, RULES) || gate !== 'unsupported_private_fact')) return null;
    return { version: 1, action, stage, reason, replyBranch, providerStatus,
      ...(code(gate, GATES) ? { gate } : {}), ...(code(outputPart, PARTS) ? { outputPart } : {}),
      ...(code(privateFactRule, RULES) ? { privateFactRule } : {}) };
  } catch { return null; }
}
function withoutDiagnostics(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(data).filter(key => key !== 'failureDiagnostics').map(key => [key, data[key]]));
}
export function sanitizeReadingFailureResponse(data: Record<string, unknown>, action: ReadingAction): Record<string, unknown> {
  const response = withoutDiagnostics(data);
  const diagnostics = response.ok === false ? validateReadingFailureDiagnostics(ownValue(data, 'failureDiagnostics'), { action, reason: response.reason }) : null;
  return diagnostics ? { ...response, failureDiagnostics: diagnostics } : response;
}
export function sanitizeReadingPendingRequest(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const pending = withoutDiagnostics(value as Record<string, unknown>);
  const diagnostics = validateReadingFailureDiagnostics(ownValue(value, 'failureDiagnostics'), { action: pending.action });
  return diagnostics ? { ...pending, failureDiagnostics: diagnostics } : pending;
}
