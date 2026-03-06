import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../auth/useAuth'

export function UserDropdown() {
  const { user, logout, isAuthenticated } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!isAuthenticated || !user) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
      >
        <span className="h-5 w-5 rounded-full bg-blue-600 text-center text-[10px] font-bold leading-5 text-white">
          {user.name?.charAt(0) || '?'}
        </span>
        <span>{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded border border-gray-700 bg-gray-900 py-1 shadow-lg">
          <div className="border-b border-gray-700 px-3 py-2">
            <p className="text-xs font-medium text-white">{user.name}</p>
            <p className="text-[10px] text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={() => { logout(); setOpen(false) }}
            className="w-full px-3 py-2 text-left text-xs text-gray-300 hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
