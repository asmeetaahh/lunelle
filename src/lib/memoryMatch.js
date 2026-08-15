const SYMBOLS = ['🌸', '💗', '🌙', '⭐', '🦋', '🌷', '🍓', '🧸']

export const TOTAL_PAIRS = SYMBOLS.length

function shuffle(items) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

let cardIdSequence = 0
function nextCardId() {
  cardIdSequence += 1
  return `card-${cardIdSequence}`
}

export function createShuffledDeck() {
  const symbols = shuffle([...SYMBOLS, ...SYMBOLS])
  return symbols.map((symbol) => ({ id: nextCardId(), symbol }))
}
