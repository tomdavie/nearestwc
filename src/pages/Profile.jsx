import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

function hasBowelCondition(conditionProfile) {
  return ['Crohn\'s disease', 'Ulcerative Colitis', 'IBS', 'Other bowel condition'].includes(
    conditionProfile || '',
  )
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
  const [savedToilets, setSavedToilets] = useState([])
  const [conditionProfile, setConditionProfile] = useState('No specific condition')
  const [radarKey, setRadarKey] = useState(false)
  const [ibdMode, setIbdMode] = useState(false)
  const [savingPrefs, setSavingPrefs] = useState(false)

  const loadProfile = useCallback(async (uid) => {
    if (!uid) return
    console.log('[Profile] loadProfile: fetching full user_points (fresh, includes is_pro) for', uid)

    const [pointsRes, reviewsRes, toiletsRes] = await Promise.all([
      supabase
        .from('user_points')
        .select(
          'points, level, badges, review_count, toilet_count, is_pro, pro_expires_at, saved_toilets, condition_profile, radar_key, ibd_mode',
        )
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
    setConditionProfile(pointsData?.condition_profile || 'No specific condition')
    setRadarKey(Boolean(pointsData?.radar_key))
    setIbdMode(Boolean(pointsData?.ibd_mode))

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

    const savedIds = Array.isArray(pointsData?.saved_toilets) ? pointsData.saved_toilets.filter(Boolean) : []
    if (!savedIds.length) {
      setSavedToilets([])
      return
    }
    const [{ data: savedRows }, { data: savedReviews }] = await Promise.all([
      supabase.from('toilets').select('id, name, lat, lng').in('id', savedIds),
      supabase.from('reviews').select('toilet_id, overall_rating, rating').in('toilet_id', savedIds),
    ])
    const avgByToilet = {}
    for (const review of savedReviews || []) {
      const score = Number(review.overall_rating ?? review.rating)
      if (!review.toilet_id || !score) continue
      const existing = avgByToilet[review.toilet_id] || { total: 0, count: 0 }
      existing.total += score
      existing.count += 1
      avgByToilet[review.toilet_id] = existing
    }
    setSavedToilets(
      (savedRows || []).map((row) => {
        const rating = avgByToilet[row.id]
        return {
          ...row,
          average_rating: rating ? rating.total / rating.count : null,
        }
      }),
    )
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

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      console.log('[Profile] Re-fetching is_pro from Supabase on mount (session + row)')
      const { data: authData, error: authErr } = await supabase.auth.getUser()
      console.log('[Profile] auth.getUser for is_pro', { userId: authData?.user?.id, authErr })
      if (!authData?.user?.id || cancelled) return
      const { data, error } = await supabase
        .from('user_points')
        .select('is_pro, pro_expires_at')
        .eq('user_id', authData.user.id)
        .maybeSingle()
      console.log('[Profile] Fresh is_pro / pro_expires_at', { data, error })
      if (cancelled || error) return
      setPointsRow((prev) => {
        if (!prev) {
          console.log('[Profile] is_pro merge skipped — pointsRow not loaded yet')
          return prev
        }
        return {
          ...prev,
          is_pro: data ? Boolean(data.is_pro) : prev.is_pro,
          pro_expires_at: data?.pro_expires_at ?? prev.pro_expires_at,
        }
      })
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const points = Number(pointsRow?.points) || 0
  const isPro = Boolean(pointsRow?.is_pro)
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

  const persistPreferences = async (nextPatch) => {
    if (!user?.id) return
    setSavingPrefs(true)
    const { data: current } = await supabase
      .from('user_points')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (current) {
      await supabase.from('user_points').update(nextPatch).eq('user_id', user.id)
    } else {
      await supabase.from('user_points').insert({
        user_id: user.id,
        points: 0,
        level: 'desperate_dan',
        badges: [],
        ...nextPatch,
      })
    }
    setSavingPrefs(false)
    loadProfile(user.id)
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
      {!isPro ? (
        <Link to="/upgrade" className={styles.proBanner}>
          Upgrade to Pro 🚽
        </Link>
      ) : (
        <p className={styles.proBadge}>NearestWC Pro 👑</p>
      )}
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

      <Link to="/safe-route" className={styles.safeRouteLink}>
        Plan a safe route 🗺️
      </Link>

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

      <h2 className={styles.sectionTitle}>Saved WCs</h2>
      {savedToilets.length === 0 ? (
        <p className={styles.muted}>No saved WCs yet. Tap "Save this WC ⭐" in a listing to build your shortlist.</p>
      ) : (
        <ul className={styles.feed}>
          {savedToilets.map((toilet) => (
            <li key={toilet.id} className={styles.feedCard}>
              <p className={styles.feedBody}>{toilet.name || 'Unnamed WC'}</p>
              <p className={styles.feedMeta}>
                {toilet.average_rating != null ? `${toilet.average_rating.toFixed(1)}/5` : 'No rating yet'}
              </p>
              <button
                type="button"
                className={styles.routeBtn}
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}`,
                    '_blank',
                    'noopener,noreferrer',
                  )
                }
              >
                Directions
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className={styles.sectionTitle}>Condition Profile</h2>
      <div className={styles.prefCard}>
        <label className={styles.prefLabel} htmlFor="condition-profile">
          I have...
        </label>
        <select
          id="condition-profile"
          className={styles.select}
          value={conditionProfile}
          onChange={(e) => {
            const value = e.target.value
            const nextIbdMode = hasBowelCondition(value) ? true : ibdMode
            setConditionProfile(value)
            setIbdMode(nextIbdMode)
            persistPreferences({ condition_profile: value, ibd_mode: nextIbdMode })
          }}
        >
          <option>No specific condition</option>
          <option>Crohn&apos;s disease</option>
          <option>Ulcerative Colitis</option>
          <option>IBS</option>
          <option>Other bowel condition</option>
          <option>Mobility issues</option>
          <option>Other</option>
        </select>
        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            checked={radarKey}
            onChange={(e) => {
              const checked = e.target.checked
              setRadarKey(checked)
              persistPreferences({ radar_key: checked })
            }}
          />
          <span>I use a RADAR key</span>
        </label>
        <label className={styles.ibdRow}>
          <span className={styles.ibdToggleText}>IBD Mode 🏥</span>
          <input
            type="checkbox"
            checked={ibdMode}
            onChange={(e) => {
              const checked = e.target.checked
              setIbdMode(checked)
              persistPreferences({ ibd_mode: checked })
            }}
          />
        </label>
        <p className={styles.ibdHint}>
          Optimises the map for urgent needs - sorts by distance, hides paid toilets, filters to clean and
          accessible options.
        </p>
        {savingPrefs && <p className={styles.muted}>Saving profile preferences…</p>}
      </div>

      <button type="button" className={styles.logoutBtnBottom} onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </div>
  )
}

export default Profile
