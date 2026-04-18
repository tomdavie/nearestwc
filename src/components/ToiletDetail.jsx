import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import { fetchUserPoints, incrementUserPoints, USER_POINTS_CHANGED_EVENT } from '../lib/userPoints'
import styles from './ToiletDetail.module.css'

function StarIcon({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5l2.35 5.4 5.9.52-4.47 3.88 1.34 5.77L12 16.9l-5.12 3.17 1.34-5.77L3.75 9.42l5.9-.52L12 3.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StarRow({ value, max = 5, size = 'md' }) {
  const dim = size === 'sm' ? 16 : 20
  return (
    <span className={styles.stars} role="img" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          width={dim}
          height={dim}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={i < value ? undefined : styles.starMuted}
        >
          <path
            d="M12 3.5l2.35 5.4 5.9.52-4.47 3.88 1.34 5.77L12 16.9l-5.12 3.17 1.34-5.77L3.75 9.42l5.9-.52L12 3.5z"
            fill={i < value ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  )
}

function reviewOverallScore(r) {
  const v = r.overall_rating ?? r.rating
  return Number(v) || 0
}

function ToiletDetail({ toilet, onClose, user }) {
  const { showToast } = useToast()
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [exiting, setExiting] = useState(false)
  const [userPoints, setUserPoints] = useState(null)
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [cleanlinessRating, setCleanlinessRating] = useState(5)
  const [overallRating, setOverallRating] = useState(5)
  const [hasToiletRoll, setHasToiletRoll] = useState(true)
  const [hasSoap, setHasSoap] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successBanner, setSuccessBanner] = useState(false)
  const dragStartY = useRef(null)

  const requestClose = useCallback(() => {
    if (exiting) return
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      onClose()
      return
    }
    setExiting(true)
  }, [exiting, onClose])

  const handleSheetAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return
    if (exiting) onClose()
  }

  const loadReviews = useCallback(async () => {
    if (!toilet?.id) return
    setLoadingReviews(true)
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, rating, overall_rating, cleanliness, has_toilet_roll, has_soap, comment, created_at',
      )
      .eq('toilet_id', toilet.id)
      .order('created_at', { ascending: false })

    setLoadingReviews(false)
    if (error) {
      showToast(error.message, 'error')
      setReviews([])
      return
    }
    setReviews(data || [])
  }, [toilet?.id, showToast])

  const refreshPoints = useCallback(async () => {
    if (!user?.id) {
      setUserPoints(null)
      return
    }
    setLoadingPoints(true)
    const p = await fetchUserPoints(user.id)
    setUserPoints(p)
    setLoadingPoints(false)
  }, [user?.id])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  useEffect(() => {
    refreshPoints()
  }, [refreshPoints])

  useEffect(() => {
    const onPoints = () => {
      refreshPoints()
    }
    window.addEventListener(USER_POINTS_CHANGED_EVENT, onPoints)
    return () => window.removeEventListener(USER_POINTS_CHANGED_EVENT, onPoints)
  }, [refreshPoints])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const averageRating = useMemo(() => {
    if (!reviews.length) return null
    const sum = reviews.reduce((acc, r) => acc + reviewOverallScore(r), 0)
    return Math.round((sum / reviews.length) * 10) / 10
  }, [reviews])

  const tags = useMemo(() => {
    if (!toilet) return []
    const out = []
    if (toilet.is_free) out.push({ key: 'free', label: 'Free' })
    if (toilet.is_accessible) out.push({ key: 'accessible', label: 'Accessible' })
    if (toilet.requires_key) out.push({ key: 'key', label: 'Requires Key' })
    if (toilet.gender_neutral) out.push({ key: 'neutral', label: 'Gender Neutral' })
    if (toilet.baby_changing) out.push({ key: 'baby', label: 'Baby Changing' })
    return out
  }, [toilet])

  const resetReviewForm = () => {
    setCleanlinessRating(5)
    setOverallRating(5)
    setHasToiletRoll(true)
    setHasSoap(true)
    setNewComment('')
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!user || !toilet?.id) return
    setSubmitting(true)
    const payload = {
      toilet_id: toilet.id,
      user_id: user.id,
      cleanliness: cleanlinessRating,
      has_toilet_roll: hasToiletRoll,
      has_soap: hasSoap,
      overall_rating: overallRating,
      comment: newComment.trim() || null,
      rating: overallRating,
    }
    const { error } = await supabase.from('reviews').insert([payload])
    setSubmitting(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    try {
      await incrementUserPoints(user.id, 10)
    } catch (err) {
      showToast(err?.message || 'Review saved, but points could not be updated.', 'error')
    }
    resetReviewForm()
    await loadReviews()
    await refreshPoints()
    setSuccessBanner(true)
    window.setTimeout(() => setSuccessBanner(false), 3000)
  }

  const onHandleTouchStart = (e) => {
    dragStartY.current = e.touches[0]?.clientY ?? null
  }

  const onHandleTouchEnd = (e) => {
    if (dragStartY.current == null) return
    const end = e.changedTouches[0]?.clientY
    if (end != null && end - dragStartY.current > 64) requestClose()
    dragStartY.current = null
  }

  if (!toilet) return null

  return (
    <>
      <div className={styles.backdrop} onClick={requestClose} aria-hidden />

      {successBanner && (
        <div className={styles.successOverlay} role="status" aria-live="polite">
          <div className={styles.successCard}>
            {`Nature thanks you. So do we. 🚽 You've earned 10 points for helping fellow humans in need.`}
          </div>
        </div>
      )}

      <div
        className={`${styles.sheet} ${exiting ? styles.sheetExit : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="toilet-detail-title"
        onAnimationEnd={handleSheetAnimationEnd}
      >
        <div className={styles.header}>
          <div
            className={styles.dragZone}
            onTouchStart={onHandleTouchStart}
            onTouchEnd={onHandleTouchEnd}
            aria-hidden
          >
            <span className={styles.handle} />
          </div>
          <button type="button" className={styles.closeBtn} onClick={requestClose} aria-label="Close details">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {user && (
            <p className={styles.pointsTally}>
              🏅 You have {loadingPoints ? '…' : userPoints ?? 0} points
            </p>
          )}

          <h2 id="toilet-detail-title" className={styles.title}>
            {toilet.name || 'Unnamed toilet'}
          </h2>

          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map((t) => (
                <span key={t.key} className={styles.pill}>
                  {t.label}
                </span>
              ))}
            </div>
          )}

          <div className={styles.ratingRow}>
            {averageRating != null ? (
              <>
                <StarRow value={Math.round(averageRating)} />
                <span className={styles.avgLabel}>
                  {averageRating.toFixed(1)} average overall
                  {!loadingReviews && reviews.length > 0 && ` · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
                </span>
              </>
            ) : (
              <span className={styles.avgLabel}>
                {loadingReviews ? 'Loading reviews…' : 'No reviews yet — brave the unknown?'}
              </span>
            )}
          </div>

          <p className={styles.sectionLabel}>Reviews</p>
          {!loadingReviews && reviews.length === 0 && (
            <p className={styles.emptyReviews}>
              Radio silence. Be the first to report back from the front line.
            </p>
          )}
          {reviews.length > 0 && (
            <ul className={styles.reviewList}>
              {reviews.map((r) => (
                <li key={r.id} className={styles.reviewCard}>
                  <div className={styles.reviewMeta}>
                    <StarRow value={reviewOverallScore(r)} size="sm" />
                    {r.cleanliness != null && (
                      <span className={styles.reviewSub}>
                        Cleanliness {Number(r.cleanliness)}/5
                      </span>
                    )}
                  </div>
                  {(r.has_toilet_roll != null || r.has_soap != null) && (
                    <p className={styles.reviewFacilities}>
                      {r.has_toilet_roll != null && (
                        <span className={styles.facilityChip}>Roll: {r.has_toilet_roll ? 'Yes' : 'No'}</span>
                      )}
                      {r.has_soap != null && (
                        <span className={styles.facilityChip}>Soap: {r.has_soap ? 'Yes' : 'No'}</span>
                      )}
                    </p>
                  )}
                  {r.comment ? (
                    <p className={styles.reviewComment}>{r.comment}</p>
                  ) : (
                    <p className={styles.reviewComment} style={{ color: 'var(--color-text-muted)' }}>
                      No extra notes — sometimes brevity is a mercy.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <form className={styles.form} onSubmit={handleSubmitReview}>
              <div>
                <p className={styles.fieldLabel} id="cleanliness-label">
                  Cleanliness
                </p>
                <div className={styles.starPicker} role="group" aria-labelledby="cleanliness-label">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.starBtn} ${n <= cleanlinessRating ? styles.starBtnActive : ''}`}
                      onClick={() => setCleanlinessRating(n)}
                      aria-label={`Cleanliness ${n} of 5`}
                      aria-pressed={n <= cleanlinessRating}
                    >
                      <StarIcon filled={n <= cleanlinessRating} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={styles.fieldLabel} id="overall-label">
                  Overall rating
                </p>
                <div className={styles.starPicker} role="group" aria-labelledby="overall-label">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.starBtn} ${n <= overallRating ? styles.starBtnActive : ''}`}
                      onClick={() => setOverallRating(n)}
                      aria-label={`Overall ${n} of 5`}
                      aria-pressed={n <= overallRating}
                    >
                      <StarIcon filled={n <= overallRating} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className={styles.fieldLabel} id="roll-label">
                  Toilet roll available
                </p>
                <div className={styles.seg} role="group" aria-labelledby="roll-label">
                  <button
                    type="button"
                    className={`${styles.segBtn} ${hasToiletRoll ? styles.segBtnActive : ''}`}
                    onClick={() => setHasToiletRoll(true)}
                    aria-pressed={hasToiletRoll}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${!hasToiletRoll ? styles.segBtnActive : ''}`}
                    onClick={() => setHasToiletRoll(false)}
                    aria-pressed={!hasToiletRoll}
                  >
                    No
                  </button>
                </div>
              </div>

              <div>
                <p className={styles.fieldLabel} id="soap-label">
                  Soap available
                </p>
                <div className={styles.seg} role="group" aria-labelledby="soap-label">
                  <button
                    type="button"
                    className={`${styles.segBtn} ${hasSoap ? styles.segBtnActive : ''}`}
                    onClick={() => setHasSoap(true)}
                    aria-pressed={hasSoap}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${!hasSoap ? styles.segBtnActive : ''}`}
                    onClick={() => setHasSoap(false)}
                    aria-pressed={!hasSoap}
                  >
                    No
                  </button>
                </div>
              </div>

              <div>
                <label className={styles.fieldLabel} htmlFor="review-comment">
                  Anything else?
                </label>
                <textarea
                  id="review-comment"
                  className={styles.textarea}
                  placeholder="Anything else worth knowing? Don't be shy."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                />
              </div>
              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting ? 'Posting…' : 'Post review'}
              </button>
            </form>
          ) : (
            <p className={styles.loginHint}>
              <Link to="/login">Login</Link> to leave a review — your fellow humans will thank you.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default ToiletDetail
