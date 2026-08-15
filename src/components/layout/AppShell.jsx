import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import MobileNavDrawer from './MobileNavDrawer'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen text-ink">
      <Sidebar />

      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </div>
  )
}

export default AppShell
