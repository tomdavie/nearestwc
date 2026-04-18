import { Routes, Route, useLocation } from 'react-router-dom'
import MapView from './pages/MapView'
import AddToilet from './pages/AddToilet'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Navbar from './components/Navbar'
import { ToastProvider } from './context/ToastProvider'
import styles from './App.module.css'

function AppShell() {
  const { pathname } = useLocation()
  const isMap = pathname === '/'

  return (
    <div className={isMap ? styles.shellMap : styles.shell}>
      <Navbar />
      <main className={isMap ? styles.mainMap : styles.main}>
        <Routes>
          <Route path="/" element={<MapView />} />
          <Route path="/add" element={<AddToilet />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </main>
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
