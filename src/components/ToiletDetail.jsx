import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
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

function ToiletDetail({ toilet, onClose }) {
  const { showToast } = useToast()
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [user, setUser] = useState(null)
  const [newRating, setNewRating] = useState(5)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const dragStartY = useRef(null)

  const loadReviews = useCallback(async () => {
    if (!toilet?.id) return
    setLoadingReviews(true)
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at')
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadReviews()
  }, [loadReviews])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const averageRating = useMemo(() => {
    if (!reviews.length) return null
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0)
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

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!user || !toilet?.id) return
    setSubmitting(true)
    const { error } = await supabase.from('reviews').insert([
      {
        toilet_id: toilet.id,
        rating: newRating,
        comment: newComment.trim() || null,
        user_id: user.id,
      },
    ])
    setSubmitting(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    showToast('Review posted.', 'success')
    setNewComment('')
    setNewRating(5)
    await loadReviews()
  }

  const onHandleTouchStart = (e) => {
    dragStartY.current = e.touches[0]?.clientY ?? null
  }

  const onHandleTouchEnd = (e) => {
    if (dragStartY.current == null) return
    const end = e.changedTouches[0]?.clientY
    if (end != null && end - dragStartY.current > 64) onClose()
    dragStartY.current = null
  }

  if (!toilet) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} aria-hidden />

      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="toilet-detail-title">
        <div className={styles.header}>
          <div
            className={styles.dragZone}
            onTouchStart={onHandleTouchStart}
            onTouchEnd={onHandleTouchEnd}
            aria-hidden
          >
            <span className={styles.handle} />
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close details">
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
                  {averageRating.toFixed(1)} average
                  {!loadingReviews && reviews.length > 0 && ` · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`}
                </span>
              </>
            ) : (
              <span className={styles.avgLabel}>
                {loadingReviews ? 'Loading reviews…' : 'No reviews yet'}
              </span>
            )}
          </div>

          <p className={styles.sectionLabel}>Reviews</p>
          {!loadingReviews && reviews.length === 0 && (
            <p className={styles.emptyReviews}>Be the first to share how it was.</p>
          )}
          {reviews.length > 0 && (
            <ul className={styles.reviewList}>
              {reviews.map((r) => (
                <li key={r.id} className={styles.reviewCard}>
                  <div className={styles.reviewMeta}>
                    <StarRow value={Number(r.rating) || 0} size="sm" />
                  </div>
                  {r.comment ? (
                    <p className={styles.reviewComment}>{r.comment}</p>
                  ) : (
                    <p className={styles.reviewComment} style={{ color: 'var(--color-text-muted)' }}>
                      No written comment.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <form className={styles.form} onSubmit={handleSubmitReview}>
              <div>
                <p className={styles.fieldLabel} id="new-rating-label">
                  Your rating
                </p>
                <div className={styles.starPicker} role="group" aria-labelledby="new-rating-label">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.starBtn} ${n <= newRating ? styles.starBtnActive : ''}`}
                      onClick={() => setNewRating(n)}
                      aria-label={`${n} stars`}
                      aria-pressed={n <= newRating}
                    >
                      <StarIcon filled={n <= newRating} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={styles.fieldLabel} htmlFor="review-comment">
                  Comment
                </label>
                <textarea
                  id="review-comment"
                  className={styles.textarea}
                  placeholder="Access, cleanliness, wait time…"
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
              <Link to="/login">Login</Link> to leave a review
            </p>
          )}
        </div>
      </div>
    </>
  )
}

export default ToiletDetail
