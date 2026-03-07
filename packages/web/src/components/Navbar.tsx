import { Link } from '@tanstack/react-router'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../hooks/useTheme'
import { ThemeToggle } from './ThemeToggle'
import { UserDropdown } from './UserDropdown'

export function Navbar(): React.ReactNode {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
          TN3270 Terminal
        </span>
        <nav className="flex items-center gap-1">
          <Link
            to="/"
            className="px-3 py-1.5 text-sm rounded-md transition-colors
              [&.active]:bg-blue-100 [&.active]:text-blue-700
              dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
              hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Terminal
          </Link>
          <Link
            to="/history"
            className="px-3 py-1.5 text-sm rounded-md transition-colors
              [&.active]:bg-blue-100 [&.active]:text-blue-700
              dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
              hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            History
          </Link>
          <Link
            to="/schedules"
            className="px-3 py-1.5 text-sm rounded-md transition-colors
              [&.active]:bg-blue-100 [&.active]:text-blue-700
              dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
              hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            Schedules
          </Link>
          <Link
            to="/auto-launcher-runs"
            className="px-3 py-1.5 text-sm rounded-md transition-colors
              [&.active]:bg-blue-100 [&.active]:text-blue-700
              dark:[&.active]:bg-blue-900/30 dark:[&.active]:text-blue-400
              hover:bg-gray-100 dark:hover:bg-zinc-800"
          >
            AutoLauncher Runs
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <UserDropdown email={user?.email || ''} onSignOut={() => void logout()} />
      </div>
    </header>
  )
}
