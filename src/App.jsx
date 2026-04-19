import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import MapView from './pages/MapView'
import AddToilet from './pages/AddToilet'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ToiletPage from './pages/ToiletPage'
import Admin from './pages/Admin'
import Upgrade from './pages/Upgrade'
import ProSuccess from './pages/ProSuccess'
import SafeRoute from './pages/SafeRoute'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'
import Navbar from './components/Navbar'
import Onboarding from './components/Onboarding'
import Footer from './components/Footer'
import { ToastProvider } from './context/ToastProvider'
import { supabase } from './supabaseClient'
import styles from './App.module.css'
import './App.css'

function AppShell() {
  const { pathname } = useLocation()
  const isMap = pathname === '/'
  const showFooter = pathname === '/privacy' || pathname === '/terms'

  return (
    <div className={isMap ? styles.shellMap : styles.shell}>
      <Navbar />
      <main className={isMap ? styles.mainMap : styles.main}>
        <Routes>
          <Route path="/" element={<MapView />} />
          <Route path="/add" element={<AddToilet />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/pro-success" element={<ProSuccess />} />
          <Route path="/safe-route" element={<SafeRoute />} />
          <Route path="/wc/:id" element={<ToiletPage />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {showFooter && <Footer />}
      <Onboarding />
    </div>
  )
}

function App() {
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().finally(() => {
      if (mounted) setAuthReady(true)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (mounted) setAuthReady(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (!authReady) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#fff',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '70px',
              height: '70px',
              margin: '0 auto 16px',
              borderRadius: '18px',
              background: '#1a73e8',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            WC
          </div>
          <p style={{ fontSize: '17px', fontWeight: 650, color: '#1a73e8', marginBottom: '12px' }}>
            NearestWC
          </p>
          <div
            style={{
              width: '24px',
              height: '24px',
              margin: '0 auto',
              borderRadius: '50%',
              border: '2.5px solid #d6e3fb',
              borderTopColor: '#1a73e8',
              animation: 'nwcSpin 0.85s linear infinite',
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

export default App
