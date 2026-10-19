import { NavLink } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  Home,
  Settings,
  Users,
} from 'lucide-react'

const employerTabs = [
  { to: '/', label: '今日', icon: Home, end: true },
  { to: '/calendar', label: '日曆', icon: CalendarDays },
  { to: '/history', label: '記錄', icon: ClipboardList },
  { to: '/household', label: '家庭', icon: Users },
  { to: '/settings', label: '設定', icon: Settings },
]

const helperTabs = [
  { to: '/', label: 'Hari Ini', icon: Home, end: true },
  { to: '/calendar', label: 'Kalender', icon: CalendarDays },
  { to: '/history', label: 'Riwayat', icon: ClipboardList },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

export default function Nav({ isHelper }) {
  const tabs = isHelper ? helperTabs : employerTabs
  return (
    <nav
      aria-label={isHelper ? 'Navigasi utama' : '主要導航'}
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-teal-100 bg-white/95 backdrop-blur"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around px-1 py-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isActive
                    ? 'bg-teal-50 text-teal-800'
                    : 'text-slate-500 hover:text-teal-700'
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
