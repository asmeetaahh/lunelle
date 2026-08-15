import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { navItems } from './lib/navItems'
import Home from './pages/Home'
import PagePlaceholder from './pages/PagePlaceholder'
import { ThemeProvider } from './theme/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/home" replace />} />
            <Route path="home" element={<Home />} />
            {navItems
              .filter((item) => item.to !== '/home')
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
