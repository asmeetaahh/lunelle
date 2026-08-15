import { BookOpen, CalendarDays, Grid3x3, Home, Sparkles, User, Wand2, Waves } from 'lucide-react'

export const primaryNavItems = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/insights', label: 'Insights', icon: Sparkles },
  { to: '/ai-companion', label: 'AI Companion', icon: Wand2 },
]

export const exploreNavItems = [
  { to: '/relax', label: 'Relax', icon: Waves },
  { to: '/memory-match', label: 'Memory match', icon: Grid3x3 },
  { to: '/journal', label: 'Journal', icon: BookOpen },
]

export const profileNavItem = { to: '/profile', label: 'Profile', icon: User }

export const navItems = [...primaryNavItems, ...exploreNavItems, profileNavItem]
