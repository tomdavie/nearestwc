import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { BADGES, getLevelFromPoints, getProgressToNextLevel, normaliseBadges } from '../utils/points'
import { USER_POINTS_CHANGED_EVENT } from '../lib/userPoints'
import BackButton from '../components/BackButton'
import styles from './Profile.module.css'

const BADGE_ORDER = ['pioneer', 'inspector', 'diamond_throne', 'globetrotter', 'always_prepared']

const LOCK_HINTS = {
  pioneer: 'Add the first WC in a city to unlock.',
  inspector: 'Review 10 WCs to unlock.',
  diamond_throne: 'Review 50 WCs to unlock.',
  globetrotter: 'Add WCs in 3+ countries to unlock.',
  always_prepared: 'Confirm toilet roll available 10 times to unlock.',
}

function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [pointsRow, setPointsRow] = useState(null)
  const [reviewCount, setReviewCount] = useState(0)
  const [toiletCount, setToiletCount] = useState(0)
  const [recentReviews, setRecentReviews] = useState([])

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return

    const [pointsRes, reviewsRes, toiletsRes] = await Promise.all([
      supabase
        .from('user_points')
        .select('points, level, badges, review_count, toilet_count')
        .eq('user_id', uid)
        .maybeSingle(),
      supabase
        .from('reviews')
        .select('id, comment, overall_rating, rating, created_at, toilet_id')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(5),
      Promise.all([
        supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        supabase.from('toilets').select('*', { count: 'exact', head: true }).eq('added_by', uid),
      ]),
    ])

    const pointsData = pointsRes.data || null
    setPointsRow(pointsData)

    const reviewFallbackCount = toiletsRes[0].count ?? 0
    const toiletFallbackCount = toiletsRes[1].count ?? 0
    setReviewCount(Number(pointsData?.review_count) || reviewFallbackCount)
    setToiletCount(Number(pointsData?.toilet_count) || toiletFallbackCount)

    const rows = reviewsRes.data || []
    const toiletIds = [...new Set(rows.map((r) => r.toilet_id).filter(Boolean))]
    let toiletNames = {}
    if (toiletIds.length > 0) {
      const { data: toilets } = await supabase.from('toilets').select('id, name').in('id', toiletIds)
      toiletNames = Object.fromEntries((toilets || []).map((t) => [t.id, t.name]))
    }
    setRecentReviews(rows.map((r) => ({ ...r, toiletName: toiletNames[r.toilet_id] || 'Unknown WC' })))
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      const nextUser = data.user
      setUser(nextUser)
      if (!nextUser) {
        setLoading(false)
        navigate('/login')
        return
      }
      loadProfile(nextUser.id).finally(() => {
        if (active) setLoading(false)
      })
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (!nextUser) {
        navigate('/login')
      } else {
        loadProfile(nextUser.id)
      }
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfile, navigate])

  useEffect(() => {
    const onPointsUpdate = () => {
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.id) loadProfile(data.user.id)
      })
    }
    window.addEventListener(USER_POINTS_CHANGED_EVENT, onPointsUpdate)
    return () => window.removeEventListener(USER_POINTS_CHANGED_EVENT, onPointsUpdate)
  }, [loadProfile])

  const points = Number(pointsRow?.points) || 0
  const resolvedLevel = useMemo(() => {
    if (pointsRow?.level) {
      const fromPoints = getLevelFromPoints(points)
      return fromPoints.id === pointsRow.level ? fromPoints : fromPoints
    }
    return getLevelFromPoints(points)
  }, [points, pointsRow?.level])
  const nextLevel = useMemo(() => getProgressToNextLevel(points), [points])

  const progressPct = useMemo(() => {
    if (!nextLevel) return 100
    const levelSpan = nextLevel.next.min - resolvedLevel.min
    if (levelSpan <= 0) return 100
    const currentProgress = points - resolvedLevel.min
    return Math.min(100, Math.max(0, (currentProgress / levelSpan) * 100))
  }, [nextLevel, points, resolvedLevel.min])

  const earnedBadges = useMemo(() => new Set(normaliseBadges(pointsRow?.badges)), [pointsRow?.badges])

  const handleLogout = async () => {
    setLoggingOut(true)
    await supabase.auth.signOut()
    setLoggingOut(false)
    navigate('/')
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading your Throne Report…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className={styles.page}>
      <BackButton />
      <section className={styles.hero}>
        <p className={styles.heroSub}>Your Throne Report 🚽</p>
        <h1 className={styles.heroLevel}>
          {resolvedLevel.emoji} {resolvedLevel.name}
        </h1>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <p className={styles.progressCaption}>
          {nextLevel
            ? `${nextLevel.remaining}pts to ${nextLevel.next.emoji} ${nextLevel.next.name} (${Math.round(progressPct)}%)`
            : 'Max level reached. You are now toilet royalty.'}
        </p>
      </section>

      <h2 className={styles.sectionTitle}>Your Contribution to Humanity 🌍</h2>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{points}</div>
          <div className={styles.statLabel}>Points</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{toiletCount}</div>
          <div className={styles.statLabel}>WCs added</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{reviewCount}</div>
          <div className={styles.statLabel}>Reviews</div>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>Badges of Honour 🏅</h2>
      <div className={styles.badgeGrid}>
        {BADGE_ORDER.map((badgeId) => {
          const badge = BADGES[badgeId]
          const unlocked = earnedBadges.has(badgeId)
          return (
            <article
              key={badgeId}
              className={`${styles.badgeCard} ${unlocked ? '' : styles.badgeCardLocked}`}
            >
              <div className={styles.badgeEmoji}>{badge.emoji}</div>
              <div className={styles.badgeName}>{badge.name}</div>
              <div className={styles.badgeDesc}>{badge.description}</div>
              {!unlocked && (
                <p className={styles.badgeHint}>
                  <span className={styles.lockIcon}>🔒</span> {LOCK_HINTS[badgeId]}
                </p>
              )}
            </article>
          )
        })}
      </div>

      <h2 className={styles.sectionTitle}>Your Reviews</h2>
      {recentReviews.length === 0 ? (
        <p className={styles.muted}>No reviews yet. Your clipboard awaits.</p>
      ) : (
        <ul className={styles.feed}>
          {recentReviews.map((review) => {
            const stars = Number(review.overall_rating ?? review.rating) || 0
            return (
              <li key={review.id} className={styles.feedCard}>
                <p className={styles.feedMeta}>{review.toiletName}</p>
                <p className={styles.feedBody}>{'⭐'.repeat(stars)} ({stars}/5)</p>
                <p className={styles.feedBody}>{review.comment || 'No comment left.'}</p>
              </li>
            )
          })}
        </ul>
      )}

      <button type="button" className={styles.logoutBtnBottom} onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </div>
  )
}

export default Profile
