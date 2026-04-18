import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { BADGES, getLevelFromPoints, getProgressToNextLevel } from '../utils/points'
import { fetchUserPointsRow } from '../lib/userGamification'
import { USER_POINTS_CHANGED_EVENT } from '../lib/userPoints'
import styles from './Profile.module.css'

const BADGE_ORDER = ['pioneer', 'inspector', 'diamond_throne', 'globetrotter', 'always_prepared']

const LOCK_HINTS = {
  pioneer: 'Be the first to list a WC in a city — cartography with consequences.',
  inspector: 'Review 10 WCs. Field work beats desk work.',
  diamond_throne: 'Review 50 WCs. You will know things.',
  globetrotter: 'Add WCs in 3+ countries. Pack snacks.',
  always_prepared: 'Confirm toilet roll available 10 times in reviews.',
}

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pointsRow, setPointsRow] = useState(null)
  const [toiletsAdded, setToiletsAdded] = useState(0)
  const [reviewsLeft, setReviewsLeft] = useState(0)
  const [recentReviews, setRecentReviews] = useState([])

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return
    const [row, wcCountRes, revCountRes, feedRes] = await Promise.all([
      fetchUserPointsRow(uid),
      supabase.from('toilets').select('*', { count: 'exact', head: true }).eq('added_by', uid),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', uid),
      supabase
        .from('reviews')
        .select('id, comment, cleanliness, overall_rating, rating, created_at, toilet_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    setPointsRow(row)
    setToiletsAdded(wcCountRes.count ?? 0)
    setReviewsLeft(revCountRes.count ?? 0)

    const rows = feedRes.data || []
    const toiletIds = [...new Set(rows.map((r) => r.toilet_id).filter(Boolean))]
    let nameById = {}
    if (toiletIds.length) {
      const { data: toilets } = await supabase.from('toilets').select('id, name').in('id', toiletIds)
      nameById = Object.fromEntries((toilets || []).map((t) => [t.id, t.name]))
    }
    setRecentReviews(rows.map((r) => ({ ...r, toiletName: nameById[r.toilet_id] || 'A WC somewhere' })))
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return
      const u = data.user
      setUser(u)
      if (!u) {
        setLoading(false)
        navigate('/login')
        return
      }
      loadProfile(u.id).finally(() => {
        if (alive) setLoading(false)
      })
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (!u) navigate('/login')
      else loadProfile(u.id)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [loadProfile, navigate])

  useEffect(() => {
    const onPts = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.id) loadProfile(data.user.id)
      })
    }
    window.addEventListener(USER_POINTS_CHANGED_EVENT, onPts)
    return () => window.removeEventListener(USER_POINTS_CHANGED_EVENT, onPts)
  }, [loadProfile])

  const points = Number(pointsRow?.points) || 0
  const level = useMemo(() => getLevelFromPoints(points), [points])
  const progress = useMemo(() => getProgressToNextLevel(points), [points])

  const earned = useMemo(() => {
    const raw = pointsRow?.badges
    const arr = Array.isArray(raw) ? raw.map(String) : []
    return new Set(arr)
  }, [pointsRow])

  const progressPct = useMemo(() => {
    if (!progress) return 100
    const denom = progress.next.min - level.min
    if (denom <= 0) return 100
    const num = points - level.min
    return Math.min(100, Math.max(4, (num / denom) * 100))
  }, [progress, points, level])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    navigate('/login')
  }

  if (loading && !user) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading your dossier…</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <p className={styles.heroSub}>Your throne report</p>
        <h1 className={styles.heroLevel}>
          {level.emoji} {level.name}
        </h1>
        {progress ? (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <p className={styles.progressCaption}>
              {progress.remaining}pts to {progress.next.emoji} {progress.next.name}
            </p>
          </>
        ) : (
          <p className={styles.progressCaption}>Peak porcelain. No higher throne. Yet.</p>
        )}
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>

      <h2 className={styles.sectionTitle}>Your contribution to humanity</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{points}</div>
          <div className={styles.statLabel}>Points</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{toiletsAdded}</div>
          <div className={styles.statLabel}>WCs added</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{reviewsLeft}</div>
          <div className={styles.statLabel}>Reviews left</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Badges of honour</h2>
      <div className={styles.badgeGrid}>
        {BADGE_ORDER.map((id) => {
          const b = BADGES[id]
          const has = earned.has(id)
          return (
            <div
              key={id}
              className={`${styles.badgeCard} ${has ? '' : styles.badgeCardLocked}`}
            >
              <div className={styles.badgeEmoji}>{b.emoji}</div>
              <div className={styles.badgeName}>{b.name}</div>
              <div className={styles.badgeDesc}>{b.description}</div>
              {!has && <p className={styles.badgeHint}>{LOCK_HINTS[id]}</p>}
            </div>
          )
        })}
      </div>

      <h2 className={styles.sectionTitle}>Recent dispatches</h2>
      {recentReviews.length === 0 ? (
        <p className={styles.muted}>No reviews yet. The field awaits your clipboard energy.</p>
      ) : (
        <ul className={styles.feed}>
          {recentReviews.map((r) => {
            const overall = r.overall_rating ?? r.rating
            return (
              <li key={r.id} className={styles.feedCard}>
                <p className={styles.feedMeta}>{r.toiletName}</p>
                <p className={styles.feedBody}>
                  Overall {Number(overall) || '—'}/5
                  {r.cleanliness != null && ` · Cleanliness ${Number(r.cleanliness)}/5`}
                </p>
                {r.comment && <p className={styles.feedBody}>{r.comment}</p>}
              </li>
            )
          })}
        </ul>
      )}

      <p className={styles.muted} style={{ marginTop: 28 }}>
        <Link className={styles.loginLink} to="/">
          Back to the map
        </Link>
      </p>
    </div>
  )
}

export default Profile
