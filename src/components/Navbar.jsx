import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { fetchUserPoints, USER_POINTS_CHANGED_EVENT } from '../lib/userPoints'
import { getLevelFromPoints } from '../utils/points'
import styles from './Navbar.module.css'

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 0c4.42 0 8 1.79 8 4v1H4v-1c0-2.21 3.58-4 8-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Navbar() {
  const [sessionUser, setSessionUser] = useState(null)
  const [points, setPoints] = useState(null)

  useEffect(() => {
    let alive = true

    const loadPointsForUser = async (u) => {
      if (!u) {
        if (alive) setPoints(null)
        return
      }
      const p = await fetchUserPoints(u.id)
      if (alive) setPoints(p)
    }

    const sync = (u) => {
      if (!alive) return
      setSessionUser(u ?? null)
      loadPointsForUser(u ?? null)
    }

    supabase.auth.getUser().then(({ data }) => sync(data.user))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      sync(session?.user ?? null)
    })

    const onPointsChanged = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (!alive) return
        const u = data.user
        if (u) loadPointsForUser(u)
        else setPoints(null)
      })
    }

    window.addEventListener(USER_POINTS_CHANGED_EVENT, onPointsChanged)

    return () => {
      alive = false
      subscription.unsubscribe()
      window.removeEventListener(USER_POINTS_CHANGED_EVENT, onPointsChanged)
    }
  }, [])

  const levelEmoji = points != null ? getLevelFromPoints(points).emoji : ''

  return (
    <header className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          W
        </span>
        <span>NearestWC</span>
      </Link>
      <div className={styles.actions}>
        <Link to="/add" className={styles.iconLink} title="Add a WC">
          <IconPlus />
          <span className={styles.srOnly}>Add WC</span>
        </Link>
        <div className={styles.accountCluster}>
          {sessionUser && points != null && (
            <Link
              to="/profile"
              className={styles.pointsBadge}
              aria-label={`Profile and points, ${points} points`}
            >
              {levelEmoji} {points}pts
            </Link>
          )}
          <Link to="/login" className={styles.iconLink} title="Account">
            <IconUser />
            <span className={styles.srOnly}>Login</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Navbar
