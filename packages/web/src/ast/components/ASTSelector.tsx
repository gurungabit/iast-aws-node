import { getAllASTs } from '../registry'
import { cn } from '../../utils'

interface ASTSelectorProps {
  selected: string | null
  onSelect: (name: string) => void
}

export function ASTSelector({ selected, onSelect }: ASTSelectorProps) {
  const asts = getAllASTs()

  return (
    <div className="flex gap-1">
      {asts.map((ast) => (
        <button
          key={ast.name}
          onClick={() => onSelect(ast.name)}
          className={cn(
            'rounded px-2 py-1 text-xs font-medium transition-colors',
            selected === ast.name
              ? 'bg-blue-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200',
          )}
        >
          {ast.label}
        </button>
      ))}
    </div>
  )
}
