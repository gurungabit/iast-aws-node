import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '@/store'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const count = useAppStore((s) => s.count)
  const increment = useAppStore((s) => s.increment)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">IAST</h1>
        <p className="mt-4 text-lg text-gray-600">
          Count: {count}
        </p>
        <button
          onClick={increment}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Increment
        </button>
      </div>
    </div>
  )
}
