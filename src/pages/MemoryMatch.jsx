import { useEffect, useRef, useState } from 'react'
import BackgroundDecor from '../components/decorative/BackgroundDecor'
import CompletionCelebration from '../components/memory-match/CompletionCelebration'
import GameStatusBar from '../components/memory-match/GameStatusBar'
import MemoryBoard from '../components/memory-match/MemoryBoard'
import { createShuffledDeck, TOTAL_PAIRS } from '../lib/memoryMatch'

const MISMATCH_DELAY_MS = 800

function MemoryMatch() {
  const [deck, setDeck] = useState(() => createShuffledDeck())
  const [flippedIds, setFlippedIds] = useState([])
  const [matchedIds, setMatchedIds] = useState(() => new Set())
  const [moves, setMoves] = useState(0)
  const [isChecking, setIsChecking] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  const matchedPairs = matchedIds.size / 2
  const isComplete = matchedPairs === TOTAL_PAIRS

  const handleCardClick = (card) => {
    if (isChecking) return
    if (flippedIds.includes(card.id) || matchedIds.has(card.id)) return
    if (flippedIds.length >= 2) return

    const nextFlipped = [...flippedIds, card.id]
    setFlippedIds(nextFlipped)

    if (nextFlipped.length === 2) {
      setMoves((current) => current + 1)

      const [firstId, secondId] = nextFlipped
      const first = deck.find((item) => item.id === firstId)
      const second = deck.find((item) => item.id === secondId)

      if (first.symbol === second.symbol) {
        setMatchedIds((current) => {
          const next = new Set(current)
          next.add(firstId)
          next.add(secondId)
          return next
        })
        setFlippedIds([])
      } else {
        setIsChecking(true)
        timeoutRef.current = setTimeout(() => {
          setFlippedIds([])
          setIsChecking(false)
        }, MISMATCH_DELAY_MS)
      }
    }
  }

  const handleReplay = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setDeck(createShuffledDeck())
    setFlippedIds([])
    setMatchedIds(new Set())
    setMoves(0)
    setIsChecking(false)
  }

  return (
    <div className="relative space-y-6">
      <BackgroundDecor />

      <div>
        <h1 className="text-3xl font-bold text-ink sm:text-4xl">Memory match</h1>
        <p className="mt-2 text-base text-ink-muted">
          Flip the cards and find every matching pair.
        </p>
      </div>

      <GameStatusBar
        moves={moves}
        matchedPairs={matchedPairs}
        totalPairs={TOTAL_PAIRS}
        onRestart={handleReplay}
      />

      {isComplete && <CompletionCelebration moves={moves} onReplay={handleReplay} />}

      <MemoryBoard
        deck={deck}
        flippedIds={flippedIds}
        matchedIds={matchedIds}
        isChecking={isChecking}
        onCardClick={handleCardClick}
      />
    </div>
  )
}

export default MemoryMatch
