import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '../utils'
import { UserDropdown } from './UserDropdown'

const navItems = [
  { to: '/', label: 'Terminal' },
  { to: '/history', label: 'History' },
  { to: '/auto-launcher-runs', label: 'Auto Launcher' },
  { to: '/schedules', label: 'Schedules' },
] as const

export function Navbar() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <nav className="flex h-10 items-center justify-between border-b border-gray-800 bg-gray-950 px-4">
      <div className="flex items-center gap-1">
        <span className="mr-4 text-sm font-bold text-white">IAST</span>
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              currentPath === item.to
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
      <UserDropdown />
    </nav>
  )
}
