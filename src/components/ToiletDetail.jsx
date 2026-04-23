import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import {
  fetchUserPoints,
  incrementUserPoints,
  notifyUserPointsChanged,
  USER_POINTS_CHANGED_EVENT,
} from '../lib/userPoints'
import { uploadReviewPhoto } from '../lib/storageUploads'
import { getLevelFromPoints } from '../utils/points'
import { track } from '../utils/analytics'
import styles from './ToiletDetail.module.css'

const REPORT_REASONS = [
  'Permanently closed',
  'Wrong location',
  'Incorrect information',
  'Offensive content',
  'Other',
]

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

function parseOpeningHours(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

function formatDayHours(day, hours) {
  if (!hours?.open || !hours?.close) return null
  return `${day}: ${hours.open} - ${hours.close}`
}

function hasBowelCondition(conditionProfile) {
  return ['Crohn\'s disease', 'Ulcerative Colitis', 'IBS', 'Other bowel condition'].includes(
    conditionProfile || '',
  )
}

function ToiletDetail({ toilet, onClose, user, isSponsored = false, sponsoredListing = null }) {
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
  const [ibdFriendly, setIbdFriendly] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [reviewPhoto, setReviewPhoto] = useState(null)
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successBanner, setSuccessBanner] = useState(false)
  const [badgeFanfare, setBadgeFanfare] = useState(null)
  const [reviewerMeta, setReviewerMeta] = useState({})
  const [helpfulLoadingId, setHelpfulLoadingId] = useState(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportReason, setReportReason] = useState('Permanently closed')
  const [reportDetails, setReportDetails] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [modalPhoto, setModalPhoto] = useState('')
  const [savingToilet, setSavingToilet] = useState(false)
  const [savedThisToilet, setSavedThisToilet] = useState(false)
  const [userMeta, setUserMeta] = useState(null)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [showOfferOverlay, setShowOfferOverlay] = useState(false)
  const dragStartY = useRef(null)

  const sponsoredBusinessName =
    sponsoredListing?.business_name || sponsoredListing?.businessName || toilet?.name || 'Featured Partner'
  const sponsoredLogoUrl = sponsoredListing?.business_logo_url || sponsoredListing?.businessLogoUrl || ''
  const sponsoredOfferText =
    sponsoredListing?.offer_text ||
    sponsoredListing?.offerText ||
    'Buy any drink and use our facilities - just show the app at the counter.'
  const sponsoredInitials = sponsoredBusinessName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  useEffect(() => {
    if (!toilet?.id) return
    const key = `nwc_saved_toilet_${toilet.id}`
    setSavedThisToilet(window.sessionStorage.getItem(key) === '1')
  }, [toilet?.id])

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
        'id, user_id, helpful_count, rating, overall_rating, cleanliness, has_toilet_roll, has_soap, ibd_friendly, comment, photo_url, created_at',
      )
      .eq('toilet_id', toilet.id)
      .order('created_at', { ascending: false })

    if (error) {
      setLoadingReviews(false)
      showToast(error.message, 'error')
      setReviews([])
      setReviewerMeta({})
      return
    }

    const list = data || []
    const authorIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))]
    let meta = {}
    if (authorIds.length) {
      const { data: upRows } = await supabase
        .from('user_points')
        .select('user_id, points')
        .in('user_id', authorIds)
      for (const row of upRows || []) {
        const L = getLevelFromPoints(row.points)
        meta[row.user_id] = { emoji: L.emoji, title: L.name }
      }
    }
    setReviewerMeta(meta)
    setReviews(list)
    setLoadingReviews(false)
  }, [toilet?.id, showToast])

  const refreshPoints = useCallback(async () => {
    if (!user?.id) {
      setUserPoints(null)
      return
    }
    setLoadingPoints(true)
    const p = await fetchUserPoints(user.id)
    setUserPoints(p)
    const { data: row } = await supabase
      .from('user_points')
      .select('is_pro, condition_profile, saved_toilets')
      .eq('user_id', user.id)
      .maybeSingle()
    setUserMeta(row || { is_pro: false, condition_profile: 'No specific condition', saved_toilets: [] })
    setLoadingPoints(false)
  }, [user?.id])

  useEffect(() => {
    return () => {
      if (reviewPhotoPreview) URL.revokeObjectURL(reviewPhotoPreview)
    }
  }, [reviewPhotoPreview])

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
  const ibdFriendlyShare = useMemo(() => {
    const marked = reviews.filter((r) => typeof r.ibd_friendly === 'boolean')
    if (!marked.length) return 0
    const yesCount = marked.filter((r) => r.ibd_friendly).length
    return yesCount / marked.length
  }, [reviews])
  const showIbdFriendlyBadge = ibdFriendlyShare > 0.5

  const tags = useMemo(() => {
    if (!toilet) return []
    const out = []
    if (toilet.is_accessible) out.push({ key: 'accessible', label: 'Accessible' })
    if (toilet.requires_key) out.push({ key: 'key', label: 'Requires Key' })
    if (toilet.gender_neutral) out.push({ key: 'neutral', label: 'Gender Neutral' })
    if (toilet.baby_changing) out.push({ key: 'baby', label: 'Baby Changing' })
    return out
  }, [toilet])

  const openingHours = useMemo(() => parseOpeningHours(toilet?.opening_hours), [toilet?.opening_hours])
  const dayHoursLines = useMemo(() => {
    if (!openingHours || openingHours.mode !== 'scheduled' || !openingHours.days) return []
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return order
      .map((day) => formatDayHours(day, openingHours.days[day]))
      .filter(Boolean)
  }, [openingHours])
  const savedToiletIds = Array.isArray(userMeta?.saved_toilets) ? userMeta.saved_toilets : []
  const isFavorite = Boolean(toilet?.id && savedToiletIds.includes(toilet.id))
  const shouldShowKeyWarning =
    Boolean(userMeta?.is_pro) && hasBowelCondition(userMeta?.condition_profile) && Boolean(toilet?.requires_key)

  const resetReviewForm = () => {
    setCleanlinessRating(5)
    setOverallRating(5)
    setHasToiletRoll(true)
    setHasSoap(true)
    setIbdFriendly(true)
    setNewComment('')
  }

  const handleSubmitReview = async (e) => {
    e.preventDefault()
    if (!user || !toilet?.id) return
    setSubmitting(true)
    let photoUrl = null
    if (reviewPhoto) {
      try {
        photoUrl = await uploadReviewPhoto(reviewPhoto, user.id)
      } catch (err) {
        showToast(err?.message || 'Could not upload review photo.', 'error')
      }
    }
    const payload = {
      toilet_id: toilet.id,
      user_id: user.id,
      cleanliness: cleanlinessRating,
      has_toilet_roll: hasToiletRoll,
      has_soap: hasSoap,
      ibd_friendly: ibdFriendly,
      overall_rating: overallRating,
      comment: newComment.trim() || null,
      rating: overallRating,
      photo_url: photoUrl,
    }
    const { error } = await supabase.from('reviews').insert([payload])
    setSubmitting(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    track('review_submitted', {
      toilet_id: toilet.id,
      overall_rating: overallRating,
    })
    let gamification = { newBadges: [] }
    try {
      gamification = await incrementUserPoints(user.id, 10)
    } catch (err) {
      showToast(err?.message || 'Review saved, but points could not be updated.', 'error')
    }
    if (gamification?.newBadges?.length) {
      const b = gamification.newBadges[0]
      let msg = `🎉 Badge Unlocked: ${b.name}! ${b.description} Humanity salutes you.`
      if (gamification.newBadges.length > 1) {
        msg += `\n\n(+${gamification.newBadges.length - 1} more badge${gamification.newBadges.length > 2 ? 's' : ''} — legend behaviour.)`
      }
      setBadgeFanfare(msg)
      window.setTimeout(() => setBadgeFanfare(null), 4200)
    }
    resetReviewForm()
    setReviewPhoto(null)
    if (reviewPhotoPreview) {
      URL.revokeObjectURL(reviewPhotoPreview)
      setReviewPhotoPreview('')
    }
    await loadReviews()
    await refreshPoints()
    setShowReviewForm(false)
    setSuccessBanner(true)
    window.setTimeout(() => setSuccessBanner(false), 3000)
  }

  const markHelpful = async (reviewId, authorId) => {
    if (!user || !authorId || authorId === user.id) return
    setHelpfulLoadingId(reviewId)
    const { data: rev, error: e1 } = await supabase
      .from('reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .maybeSingle()
    if (e1 || !rev) {
      showToast(e1?.message || 'Could not load review.', 'error')
      setHelpfulLoadingId(null)
      return
    }
    const next = (Number(rev.helpful_count) || 0) + 1
    const { error: e2 } = await supabase.from('reviews').update({ helpful_count: next }).eq('id', reviewId)
    if (e2) {
      showToast(e2.message, 'error')
      setHelpfulLoadingId(null)
      return
    }
    try {
      await incrementUserPoints(authorId, 5)
    } catch (err) {
      showToast(err?.message || 'Marked helpful, but bonus points failed.', 'error')
    }
    setReviews((prev) => prev.map((x) => (x.id === reviewId ? { ...x, helpful_count: next } : x)))
    setHelpfulLoadingId(null)
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

  const copyAccessCode = async () => {
    const code = toilet?.access_code
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      showToast('Could not copy code on this device.', 'error')
    }
  }

  const onReviewPhotoChange = (e) => {
    const file = e.target.files?.[0]
    setReviewPhoto(file || null)
    if (reviewPhotoPreview) URL.revokeObjectURL(reviewPhotoPreview)
    setReviewPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  const markSavedMe = async () => {
    if (savedThisToilet) return
    if (!toilet?.id || !toilet?.added_by || !user) {
      if (!user) showToast('Login to use "This saved me".', 'info')
      return
    }
    setSavingToilet(true)
    const next = (Number(toilet.saves_count) || 0) + 1
    const { error } = await supabase.from('toilets').update({ saves_count: next }).eq('id', toilet.id)
    setSavingToilet(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    toilet.saves_count = next
    const key = `nwc_saved_toilet_${toilet.id}`
    window.sessionStorage.setItem(key, '1')
    setSavedThisToilet(true)
    try {
      await incrementUserPoints(toilet.added_by, 2)
    } catch (err) {
      showToast(err?.message || 'Saved, but points award failed.', 'error')
    }
    showToast('Saved me! 🙌 Thanks for supporting this contributor.', 'success')
  }

  const toggleSavedToilet = async () => {
    if (!user?.id || !toilet?.id) {
      showToast('Login to save this WC.', 'info')
      return
    }
    setSavingFavorite(true)
    const current = Array.isArray(userMeta?.saved_toilets) ? userMeta.saved_toilets : []
    const next = current.includes(toilet.id)
      ? current.filter((id) => id !== toilet.id)
      : [...new Set([...current, toilet.id])]
    const { data: existing } = await supabase
      .from('user_points')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (existing) {
      const { error } = await supabase.from('user_points').update({ saved_toilets: next }).eq('user_id', user.id)
      if (error) {
        setSavingFavorite(false)
        showToast(error.message, 'error')
        return
      }
    } else {
      const { error } = await supabase.from('user_points').insert({
        user_id: user.id,
        points: 0,
        level: 'desperate_dan',
        badges: [],
        saved_toilets: next,
      })
      if (error) {
        setSavingFavorite(false)
        showToast(error.message, 'error')
        return
      }
    }
    setUserMeta((prev) => ({ ...(prev || {}), saved_toilets: next }))
    notifyUserPointsChanged()
    setSavingFavorite(false)
    showToast(next.includes(toilet.id) ? 'Added to your saved WCs ⭐' : 'Removed from saved WCs', 'success')
  }

  const openDirections = () => {
    if (toilet?.lat == null || toilet?.lng == null) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleShare = async () => {
    const shareUrl = `https://nearestwc.app/wc/${toilet.id}`
    const payload = {
      title: toilet.name || 'NearestWC listing',
      text: `Check out this WC: ${toilet.name || 'NearestWC listing'}`,
      url: shareUrl,
    }
    try {
      if (navigator.share) {
        await navigator.share(payload)
        return
      }
      await navigator.clipboard.writeText(shareUrl)
      showToast('Link copied!', 'success')
    } catch {
      showToast('Could not share right now.', 'error')
    }
  }

  const submitReport = async (e) => {
    e.preventDefault()
    if (!toilet?.id) return

    const {
      data: { user: reportUser },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !reportUser) {
      showToast(userError?.message || 'Please log in to report an issue', 'error')
      return
    }

    setSubmittingReport(true)
    const response = await supabase.from('reports').insert([
      {
        toilet_id: toilet.id,
        user_id: reportUser.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      },
    ])
    console.log('[ToiletDetail] report insert response', response)
    setSubmittingReport(false)

    if (response.error) {
      showToast(response.error.message, 'error')
      return
    }

    setShowReportForm(false)
    setReportDetails('')
    setReportReason('Permanently closed')
    track('report_submitted', {
      toilet_id: toilet.id,
      reason: reportReason,
    })
    showToast('Thanks for the heads up 🔍', 'success')
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

      {badgeFanfare && (
        <div className={styles.badgeFanfareOverlay} role="status" aria-live="polite">
          <div className={styles.badgeFanfareCard}>{badgeFanfare}</div>
        </div>
      )}

      {modalPhoto && (
        <button type="button" className={styles.photoModal} onClick={() => setModalPhoto('')}>
          <img src={modalPhoto} alt="Review full size" />
        </button>
      )}
      {showOfferOverlay && isSponsored && (
        <div className={styles.offerOverlay} role="dialog" aria-modal="true" aria-label="Sponsored offer">
          <div className={styles.offerCard}>
            <div className={styles.offerLogo}>WC</div>
            <h3 className={styles.offerBusiness}>{sponsoredBusinessName}</h3>
            <p className={styles.offerCopy}>{sponsoredOfferText}</p>
            <div className={styles.offerTick}>✓</div>
            <p className={styles.offerHelpText}>Show this screen to a member of staff</p>
            <button type="button" className={styles.offerDismiss} onClick={() => setShowOfferOverlay(false)}>
              Done
            </button>
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
          {isSponsored && (
            <>
              <div className={styles.sponsoredBanner}>⭐ Featured Partner</div>
              <div className={styles.sponsoredCard}>
                {sponsoredLogoUrl ? (
                  <img src={sponsoredLogoUrl} alt={`${sponsoredBusinessName} logo`} className={styles.sponsoredLogo} />
                ) : (
                  <div className={styles.sponsoredInitials}>{sponsoredInitials || 'WC'}</div>
                )}
                <div className={styles.sponsoredText}>
                  <p className={styles.sponsoredBusinessName}>{sponsoredBusinessName}</p>
                  <p className={styles.sponsoredOffer}>{sponsoredOfferText}</p>
                </div>
              </div>
              <button type="button" className={styles.offerShowBtn} onClick={() => setShowOfferOverlay(true)}>
                Show Offer 🎟️
              </button>
            </>
          )}
          {toilet.photo_url && (
            <img className={styles.bannerPhoto} src={toilet.photo_url} alt={`${toilet.name || 'Toilet'} exterior`} />
          )}
          {user && (
            <p className={styles.pointsTally}>
              🏅 You have {loadingPoints ? '…' : userPoints ?? 0} points
            </p>
          )}

          <h2 id="toilet-detail-title" className={styles.title}>
            {toilet.name || 'Unnamed toilet'}
          </h2>
          {showIbdFriendlyBadge && (
            <p className={styles.ibdBadge}>✅ IBD Friendly - rated by the community</p>
          )}
          <button type="button" className={styles.shareBtn} onClick={handleShare}>
            🔗 Share this WC
          </button>
          <button type="button" className={styles.directionsBtn} onClick={openDirections}>
            🗺️ Get directions
          </button>
          <button
            type="button"
            className={styles.savedBtn}
            onClick={markSavedMe}
            disabled={savingToilet || savedThisToilet}
          >
            {savedThisToilet ? 'Saved me! 🙌' : savingToilet ? 'Saving…' : 'This saved me 🙌'}
          </button>
          {savedThisToilet && <p className={styles.savedNote}>+2 points awarded to the person who added this WC</p>}
          <button
            type="button"
            className={styles.favouriteBtn}
            onClick={toggleSavedToilet}
            disabled={savingFavorite}
          >
            {savingFavorite ? 'Saving…' : isFavorite ? 'Saved ⭐ Remove' : 'Save this WC ⭐'}
          </button>
          {shouldShowKeyWarning && (
            <p className={styles.keyWarning}>⚠️ This WC requires a key - may not be ideal in an emergency</p>
          )}

          {tags.length > 0 && (
            <div className={styles.tags}>
              {tags.map((t) => (
                <span key={t.key} className={styles.pill}>
                  {t.label}
                </span>
              ))}
            </div>
          )}

          <p className={styles.sectionLabel}>Access and hours</p>
          <div className={styles.metaPills}>
            {toilet.is_free ? (
              <span className={`${styles.pill} ${styles.pillFree}`}>Free 🆓</span>
            ) : (
              <>
                <span className={`${styles.pill} ${styles.pillPaid}`}>
                  {toilet.cost ? `Paid ${toilet.cost}` : 'Paid'}
                </span>
                {toilet.accepts_cash && <span className={styles.pill}>Cash</span>}
                {toilet.accepts_card && <span className={styles.pill}>Card</span>}
              </>
            )}
            {toilet.radar_key_accepted && <span className={styles.pill}>🔑 RADAR key accepted</span>}
          </div>

          {openingHours?.mode === '24_7' ? (
            <p className={styles.hoursLine}>
              <span className={styles.pill}>24 hours 🕐</span>
            </p>
          ) : dayHoursLines.length > 0 ? (
            <ul className={styles.hoursList}>
              {dayHoursLines.map((line) => (
                <li key={line} className={styles.hoursItem}>
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hoursUnknown}>Hours unknown</p>
          )}

          {toilet.access_code && (
            <div className={styles.codeBox}>
              <p className={styles.codeLabel}>Access code</p>
              <div className={styles.codeRow}>
                <code className={styles.codeValue}>{toilet.access_code}</code>
                <button type="button" className={styles.codeCopyBtn} onClick={copyAccessCode}>
                  {copiedCode ? 'Copied! ✓' : 'Copy code'}
                </button>
              </div>
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
                  {r.user_id && reviewerMeta[r.user_id] ? (
                    <p className={styles.reviewerSays}>
                      <span className={styles.reviewerTag}>
                        {reviewerMeta[r.user_id].emoji} {reviewerMeta[r.user_id].title} says:
                      </span>
                      {r.cleanliness != null
                        ? ` cleanliness ${Number(r.cleanliness)}/5`
                        : ` overall ${reviewOverallScore(r)}/5`}
                    </p>
                  ) : r.user_id ? (
                    <p className={styles.reviewerSays}>
                      <span className={styles.reviewerTag}>Fellow traveller says:</span>
                      {r.cleanliness != null
                        ? ` cleanliness ${Number(r.cleanliness)}/5`
                        : ` overall ${reviewOverallScore(r)}/5`}
                    </p>
                  ) : (
                    <p className={styles.reviewerSays}>
                      <span className={styles.reviewerTag}>Anonymous scout says:</span>
                      {r.cleanliness != null
                        ? ` cleanliness ${Number(r.cleanliness)}/5`
                        : ` overall ${reviewOverallScore(r)}/5`}
                    </p>
                  )}
                  <div className={styles.reviewMeta}>
                    <StarRow value={reviewOverallScore(r)} size="sm" />
                  </div>
                  {(r.has_toilet_roll != null || r.has_soap != null || r.ibd_friendly != null) && (
                    <p className={styles.reviewFacilities}>
                      {r.has_toilet_roll != null && (
                        <span className={styles.facilityChip}>Roll: {r.has_toilet_roll ? 'Yes' : 'No'}</span>
                      )}
                      {r.has_soap != null && (
                        <span className={styles.facilityChip}>Soap: {r.has_soap ? 'Yes' : 'No'}</span>
                      )}
                      {r.ibd_friendly != null && (
                        <span className={styles.facilityChip}>
                          IBD friendly: {r.ibd_friendly ? 'Yes' : 'No'}
                        </span>
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
                  {r.photo_url && (
                    <img
                      src={r.photo_url}
                      alt="Review upload"
                      className={styles.reviewThumb}
                      onClick={() => setModalPhoto(r.photo_url)}
                    />
                  )}
                  {user && r.user_id && r.user_id !== user.id && (
                    <button
                      type="button"
                      className={styles.helpfulBtn}
                      disabled={helpfulLoadingId === r.id}
                      onClick={() => markHelpful(r.id, r.user_id)}
                    >
                      {helpfulLoadingId === r.id
                        ? 'Saving…'
                        : `Helpful · ${Number(r.helpful_count) || 0}`}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {user ? (
            <>
              <button
                type="button"
                className={styles.reportBtn}
                onClick={() => setShowReviewForm((v) => !v)}
              >
                {showReviewForm ? "Hide review form" : "Leave a review"}
              </button>
              {showReviewForm && (
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
                <p className={styles.fieldLabel} id="ibd-friendly-label">
                  IBD Friendly?
                </p>
                <div className={styles.seg} role="group" aria-labelledby="ibd-friendly-label">
                  <button
                    type="button"
                    className={`${styles.segBtn} ${ibdFriendly ? styles.segBtnActive : ''}`}
                    onClick={() => setIbdFriendly(true)}
                    aria-pressed={ibdFriendly}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`${styles.segBtn} ${!ibdFriendly ? styles.segBtnActive : ''}`}
                    onClick={() => setIbdFriendly(false)}
                    aria-pressed={!ibdFriendly}
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
                <input
                  className={styles.fileInput}
                  type="file"
                  accept="image/*"
                  onChange={onReviewPhotoChange}
                />
                {reviewPhotoPreview && (
                  <img src={reviewPhotoPreview} alt="Review preview" className={styles.reviewThumbLarge} />
                )}
              </div>
              <button className={styles.submit} type="submit" disabled={submitting}>
                {submitting ? 'Posting…' : 'Post review'}
              </button>
                </form>
              )}
            </>
          ) : (
            <p className={styles.loginHint}>
              <Link to="/login">Login</Link> to leave a review — your fellow humans will thank you.
            </p>
          )}

          <div className={styles.reportArea}>
            <button type="button" className={styles.reportBtn} onClick={() => setShowReportForm((v) => !v)}>
              🚩 Report an issue
            </button>
            {showReportForm && (
              <>
                {!user ? (
                  <p className={styles.reportLoginHint}>Please log in to report an issue</p>
                ) : (
                  <form className={styles.reportForm} onSubmit={submitReport}>
                    <select
                      className={styles.reportSelect}
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                    >
                      {REPORT_REASONS.map((reason) => (
                        <option key={reason}>{reason}</option>
                      ))}
                    </select>
                    <textarea
                      className={styles.textarea}
                      rows={3}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="Optional extra details"
                    />
                    <button type="submit" className={styles.submit} disabled={submittingReport}>
                      {submittingReport ? 'Sending…' : 'Send report'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default ToiletDetail
