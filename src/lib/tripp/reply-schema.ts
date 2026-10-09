import type { ReplyOutputContract } from './reading-output';

/** Provider generation contract. Runtime parsing still owns identity, order,
 * rendered bounds and optional quick-option degradation; this grants no tools. */
export type ReplyJsonSchema = {
  type: 'object' | 'array' | 'string' | 'integer' | 'null' | readonly ('object' | 'null')[];
  properties?: Record<string, ReplyJsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: ReplyJsonSchema;
  enum?: readonly (string | number)[];
  minItems?: number;
  maxItems?: number;
};
export type ReplySchema = { name: 'tripp_reply' | 'tripp_reading' | 'tripp_knowledge' | 'tripp_supplement'; schema: ReplyJsonSchema };

function object(properties: Record<string, ReplyJsonSchema>): ReplyJsonSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}
const text = (): ReplyJsonSchema => ({ type: 'string' });
const options = (): ReplyJsonSchema => ({ type: 'array', items: text(), minItems: 0, maxItems: 5 });

export function createReplySchema(contract: ReplyOutputContract | null = null, allowProposal = false): ReplySchema {
  if (contract?.kind === 'reading') {
    return { name: 'tripp_reading', schema: object({ keyPoint: text(), cards: {
      type: 'array', minItems: contract.cards.length, maxItems: contract.cards.length,
      items: object({ cardId: { type: 'integer', enum: [...new Set(contract.cards.map(card => card.cardId))] },
        positionId: { type: 'string', enum: [...new Set(contract.cards.map(card => card.positionId))] }, application: text() }),
    }, nextStep: text(), quick_options: options() }) };
  }
  if (contract?.kind === 'knowledge') {
    return { name: 'tripp_knowledge', schema: object({ sections: {
      type: 'array', minItems: contract.sections.length, maxItems: contract.sections.length,
      items: object({ area: { type: 'string', enum: contract.sections.map(section => section.area) }, application: text(), question: text() }),
    }, quick_options: options() }) };
  }
  if (allowProposal) {
    const proposal = object({ reason: text(), count: { type: 'integer', enum: [1, 2] },
      angles: { type: 'array', items: text(), minItems: 1, maxItems: 2 } });
    return { name: 'tripp_supplement', schema: object({ reply: text(), proposal: { ...proposal, type: ['object', 'null'] }, quick_options: options() }) };
  }
  return { name: 'tripp_reply', schema: object({ reply: text(), quick_options: options() }) };
}

export function openAIReplyFormat(contract: ReplySchema) {
  return { type: 'json_schema' as const, json_schema: { name: contract.name, strict: true, schema: contract.schema } };
}

/** Reserve the larger OpenAI wrapper for either provider, alongside both raw and
 * NFC prompt bytes. This is a conservative admission bound, not token billing. */
export function replySchemaBytes(contract: ReplySchema): number {
  return new TextEncoder().encode(JSON.stringify({ response_format: openAIReplyFormat(contract) })).byteLength;
}
