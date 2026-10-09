import { cardById, DECK_SIZE, type Card } from './cards';
import type { ReadingSession } from './reading-schema';
import { snapshotSpread, type SpreadPosition } from './spreads';

/** Code-owned grounding functions. Client capability registrations cannot dispatch them. */
export const SERVER_TOOL_PROVENANCE = Object.freeze({ owner: 'server', version: 'tripp-server-grounding-v1',
  cards: 'canonical_deck_by_id_orientation', spread: 'confirmed_server_snapshot' });

export function serverChatCards(cards: readonly Pick<Card, 'id' | 'orientation'>[]): Card[] {
  if (!Array.isArray(cards) || cards.length > DECK_SIZE) throw new Error('invalid_server_cards');
  const seen = new Set<number>();
  return cards.map(card => {
    if (!Number.isInteger(card.id) || card.id < 0 || card.id >= DECK_SIZE || seen.has(card.id)
      || !['upright', 'reversed'].includes(card.orientation)) throw new Error('invalid_server_cards');
    seen.add(card.id);
    // Labels, meanings and arbitrary extra fields supplied alongside identities
    // never override the server-owned catalog.
    return cardById(card.id, card.orientation);
  });
}
export function serverReadingCards(reading: ReadingSession) {
  // Preserve the confirmed immutable snapshot; a later catalog edit cannot
  // change the labels/positions that the user already confirmed.
  const spread = reading.spread ? snapshotSpread(reading.spread) : null;
  const cards = (items: ReadingSession['cards'], extra: boolean) => {
    if (!items.every(card => card.flipped)) return [];
    const canonical = serverChatCards(items);
    return items.map((card, index) => {
      const position = spread?.positions.find(position => position.id === card.positionId);
      if (!extra && !position) throw new Error('invalid_server_position');
      if (extra && card.positionId !== `extra_${index + 1}`) throw new Error('invalid_server_position');
      const angle = reading.pendingExtra?.angles[index] ?? reading.pendingExtra?.reason;
      const supplement: SpreadPosition = { id: card.positionId, label: { vi: 'Góc nhìn bổ sung', en: 'Supplementary perspective' },
        meaning: { vi: angle ?? 'Góc nhìn bổ sung', en: angle ?? 'Supplementary perspective' } };
      return { ...canonical[index], positionId: card.positionId, position: extra ? supplement : position! };
    });
  };
  return { mainCards: cards(reading.cards, false), extraCards: cards(reading.extraCards, true) };
}
