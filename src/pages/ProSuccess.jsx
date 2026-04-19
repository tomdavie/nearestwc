import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import { notifyUserPointsChanged } from '../lib/pointsEvents'
import styles from './ProSuccess.module.css'

function ProSuccess() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [status, setStatus] = useState('loading')
  const [line, setLine] = useState('Waiting for your session…')
  const activatedRef = useRef(false)

  useEffect(() => {
    let mounted = true
    let timeoutId = null

    const thirtyDaysFromNow = () => {
      const d = new Date()
      d.setDate(d.getDate() + 30)
      return d.toISOString()
    }

    const activatePro = async (user) => {
      if (!user?.id || activatedRef.current) return
      activatedRef.current = true
      if (timeoutId != null) window.clearTimeout(timeoutId)
      if (mounted) {
        setLine('Session confirmed — activating your Pro account…')
        setStatus('activating')
      }

      const proExpiresAt = thirtyDaysFromNow()

      const { data, error } = await supabase
        .from('user_points')
        .upsert(
          {
            user_id: user.id,
            is_pro: true,
            pro_expires_at: proExpiresAt,
          },
          { onConflict: 'user_id' },
        )
        .select('user_id, is_pro, pro_expires_at')
        .maybeSingle()

      if (!mounted) return

      if (error) {
        console.error('[ProSuccess] upsert failed', error)
        activatedRef.current = false
        setLine(`Could not save Pro status: ${error.message}`)
        setStatus('error')
        showToast(error.message || 'Could not activate Pro.', 'error')
        return
      }

      console.log('[ProSuccess] upsert ok', data)
      if (mounted) setLine('Pro saved — you’re all set!')
      notifyUserPointsChanged()
      if (mounted) setStatus('success')
    }

    const trySession = async (session, source) => {
      if (!mounted || activatedRef.current) return
      if (session?.user) {
        if (timeoutId != null) window.clearTimeout(timeoutId)
        if (mounted) setLine(`Session ready (${source}) — activating…`)
        await activatePro(session.user)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      trySession(session, 'getSession')
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      if (mounted) setLine(`Auth: ${event} — checking session…`)
      await trySession(session, `onAuthStateChange:${event}`)
    })

    timeoutId = window.setTimeout(() => {
      if (!mounted || activatedRef.current) return
      setStatus('no_session')
      setLine('No login session detected yet.')
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      if (timeoutId != null) window.clearTimeout(timeoutId)
    }
  }, [showToast])

  useEffect(() => {
    if (status !== 'success') return undefined
    const timer = window.setTimeout(() => navigate('/'), 4000)
    return () => window.clearTimeout(timer)
  }, [status, navigate])

  if (status === 'loading' || status === 'activating') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Activating your Pro account…</p>
          <p className={styles.statusLine}>{line}</p>
        </div>
      </div>
    )
  }

  if (status === 'no_session') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Having trouble?</p>
          <p className={styles.sub}>
            Make sure you are logged in and visit this page again. Returning from Stripe can open a
            fresh browser context without your NearestWC session.
          </p>
          <p className={styles.statusLine}>{line}</p>
          <p className={styles.meta}>
            <Link className={styles.retryBtn} to="/login?redirect=/pro-success">
              Log in and continue to Pro activation
            </Link>
          </p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Couldn&apos;t activate Pro yet</h1>
          <p className={styles.sub}>{line}</p>
          <p className={styles.meta}>
            <button type="button" className={styles.retryBtn} onClick={() => navigate('/profile')}>
              Back to profile
            </button>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.statusLine}>{line}</p>
        <h1 className={styles.title}>You&apos;re now a NearestWC Pro. 🚽👑</h1>
        <p className={styles.sub}>Your bowels will thank you.</p>
        <ul className={styles.list}>
          <li>Urgent Mode for immediate directions to the best nearby option.</li>
          <li>Safe Route Planner with toilets mapped along your journey.</li>
          <li>Saved favourites and condition-aware recommendations.</li>
        </ul>
        <p className={styles.meta}>All set. Heading back to the map…</p>
      </div>
    </div>
  )
}

export default ProSuccess
