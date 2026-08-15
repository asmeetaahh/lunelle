import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { navItems } from './lib/navItems'
import AiCompanion from './pages/AiCompanion'
import Calendar from './pages/Calendar'
import Home from './pages/Home'
import Insights from './pages/Insights'
import Journal from './pages/Journal'
import MemoryMatch from './pages/MemoryMatch'
import PagePlaceholder from './pages/PagePlaceholder'
import Profile from './pages/Profile'
import Relax from './pages/Relax'
import { ThemeProvider } from './theme/ThemeContext'

const IMPLEMENTED_ROUTES = [
  '/home',
  '/calendar',
  '/insights',
  '/journal',
  '/ai-companion',
  '/relax',
  '/memory-match',
  '/profile',
]

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Home />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="insights" element={<Insights />} />
            <Route path="journal" element={<Journal />} />
            <Route path="ai-companion" element={<AiCompanion />} />
            <Route path="relax" element={<Relax />} />
            <Route path="memory-match" element={<MemoryMatch />} />
            <Route path="profile" element={<Profile />} />
            {navItems
              .filter((item) => !IMPLEMENTED_ROUTES.includes(item.to))
              .map(({ to, label, icon }) => (
                <Route
                  key={to}
                  path={to.slice(1)}
                  element={<PagePlaceholder title={label} icon={icon} />}
                />
              ))}
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
