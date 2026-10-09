import { DECK } from './cards'
import { SPREAD_CONFIGS } from './spreads'

export function getInitialCardsData() {
  return DECK.map((card) => ({
    cardId: card.id,
    name: card.name,
    english: card.english,
    arcana: card.arcana,
    suit: card.suit,
    rank: card.rank,
    glyph: card.glyph,
    upright: card.upright,
    reversed: card.reversed,
    uprightEnglish: card.uprightEnglish,
    reversedEnglish: card.reversedEnglish,
  }))
}

export function getInitialSpreadsData() {
  return SPREAD_CONFIGS.map((s) => ({
    spreadId: s.id,
    name: s.name.vi,
    nameEnglish: s.name.en,
    description: s.description.vi,
    descriptionEnglish: s.description.en,
    cardCount: s.count,
    positions: s.positions.map((p) => ({
      id: p.id,
      labelVi: p.label.vi,
      labelEn: p.label.en,
      meaningVi: p.meaning.vi,
      meaningEn: p.meaning.en,
    })),
  }))
}
