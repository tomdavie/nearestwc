import { Routes, Route, useLocation } from 'react-router-dom'
import MapView from './pages/MapView'
import AddToilet from './pages/AddToilet'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ToiletPage from './pages/ToiletPage'
import Admin from './pages/Admin'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'
import Navbar from './components/Navbar'
import Onboarding from './components/Onboarding'
import Footer from './components/Footer'
import { ToastProvider } from './context/ToastProvider'
import styles from './App.module.css'

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
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  )
}

export default App
