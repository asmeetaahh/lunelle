import Card from '../ui/Card'
import MemoryCard from './MemoryCard'

function MemoryBoard({ deck, flippedIds, matchedIds, isChecking, onCardClick }) {
  return (
    <Card className="mx-auto max-w-xl">
      <div className="grid grid-cols-4 gap-3 sm:gap-4">
        {deck.map((card) => (
          <MemoryCard
            key={card.id}
            symbol={card.symbol}
            isFlipped={flippedIds.includes(card.id)}
            isMatched={matchedIds.has(card.id)}
            disabled={isChecking}
            onClick={() => onCardClick(card)}
          />
        ))}
      </div>
    </Card>
  )
}

export default MemoryBoard
