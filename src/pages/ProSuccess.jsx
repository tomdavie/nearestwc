import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { notifyUserPointsChanged } from '../lib/pointsEvents'
import styles from './ProSuccess.module.css'

function ProSuccess() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [line, setLine] = useState('Confirming your session…')
  const successHandledRef = useRef(false)

  useEffect(() => {
    let active = true
    let noSessionTimeout = null
    let pollInterval = null

    const startPollingForPro = (userId) => {
      let attempts = 0
      const maxAttempts = 15 // 30 seconds at 2s interval
      setStatus('checking')
      setLine('Payment successful — waiting for webhook confirmation…')

      const check = async () => {
        attempts += 1
        const { data, error } = await supabase
          .from('user_points')
          .select('is_pro')
          .eq('user_id', userId)
          .maybeSingle()
        if (!active) return
        if (error) {
          console.error('[ProSuccess] polling error', error)
        }

        if (Boolean(data?.is_pro)) {
          if (pollInterval) window.clearInterval(pollInterval)
          if (!successHandledRef.current) {
            successHandledRef.current = true
            notifyUserPointsChanged()
          }
          setStatus('success')
          setLine('Pro activated — welcome to NearestWC Pro!')
          return
        }

        if (attempts >= maxAttempts) {
          if (pollInterval) window.clearInterval(pollInterval)
          setStatus('delayed')
          setLine(
            'Taking longer than expected - your Pro access will activate shortly. Check your profile in a few minutes.',
          )
          return
        }
      }

      check()
      pollInterval = window.setInterval(check, 2000)
    }

    const resolveSessionAndPoll = async () => {
      const { data } = await supabase.auth.getSession()
      const userId = data?.session?.user?.id
      if (!active) return
      if (!userId) {
        setStatus('no_session')
        setLine('No login session detected yet.')
        return
      }
      if (noSessionTimeout) window.clearTimeout(noSessionTimeout)
      startPollingForPro(userId)
    }

    noSessionTimeout = window.setTimeout(() => {
      if (!active || successHandledRef.current) return
      setStatus('no_session')
      setLine('No login session detected yet.')
    }, 5000)

    resolveSessionAndPoll()

    return () => {
      active = false
      if (noSessionTimeout) window.clearTimeout(noSessionTimeout)
      if (pollInterval) window.clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    if (status !== 'success') return undefined
    const timer = window.setTimeout(() => navigate('/'), 4000)
    return () => window.clearTimeout(timer)
  }, [status, navigate])

  if (status === 'loading' || status === 'checking') {
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

  if (status === 'delayed') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Almost there</h1>
          <p className={styles.sub}>{line}</p>
          <p className={styles.meta}>
            You can continue using the app now — this page will update automatically next time you visit.
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
