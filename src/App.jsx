import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { HouseholdProvider, useHousehold } from './lib/household'
import Nav from './components/Nav'
import PreviewBanner from './components/PreviewBanner'
import SignIn from './pages/SignIn'
import AuthCallback from './pages/AuthCallback'
import InviteAccept from './pages/InviteAccept'
import CreateHousehold from './pages/CreateHousehold'
import Today from './pages/Today'
import Calendar from './pages/Calendar'
import History from './pages/History'
import HouseholdPage from './pages/Household'
import Settings from './pages/Settings'
import Legal from './pages/Legal'

function DocumentLang({ isHelper }) {
  useEffect(() => {
    document.documentElement.lang = isHelper ? 'id' : 'zh-Hant'
  }, [isHelper])
  return null
}

function Shell({ children }) {
  const { effectiveIsHelper, previewHelper, setPreview, household } =
    useHousehold()
  return (
    <div className="min-h-screen pb-24">
      <DocumentLang isHelper={effectiveIsHelper} />
      {previewHelper && (
        <PreviewBanner onExit={() => setPreview(false)} lang="zh" />
      )}
      <header className="sticky top-0 z-30 border-b border-teal-100/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-lg text-white">
            🏠
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">
              {effectiveIsHelper ? 'Halo Kakak!' : '屋企家務通'}
            </h1>
            <p className="text-xs text-slate-500">
              {household?.name ||
                (effectiveIsHelper
                  ? 'Manajer Rumah Tangga'
                  : 'Halo Kakak · 雙語家務')}
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
      <Nav isHelper={effectiveIsHelper} />
    </div>
  )
}

function ProtectedApp() {
  const { isAuthenticated, loading } = useAuth()
  const {
    loading: hhLoading,
    household,
    memberships,
  } = useHousehold()
  const location = useLocation()

  if (loading || hhLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        …
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />
  }

  if (!household && memberships.length === 0) {
    return <CreateHousehold />
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/history" element={<History />} />
        <Route path="/household" element={<HouseholdPage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HouseholdProvider>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/invite/:token" element={<InviteAccept />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/pics" element={<Legal kind="pics" />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </HouseholdProvider>
    </AuthProvider>
  )
}
