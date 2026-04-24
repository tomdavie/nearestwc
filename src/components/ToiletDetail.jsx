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
const LOCATION_TYPE_OPTIONS = [
  'Train Station',
  'Shopping Centre',
  'Airport',
  'Park',
  'Restaurant/Café',
  'Hotel',
  'Street/Public',
  'Other',
]

const DAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0')
  const minutes = i % 2 === 0 ? '00' : '30'
  return `${hours}:${minutes}`
})

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

function normalizeOpeningHours(raw) {
  const parsed = parseOpeningHours(raw)
  const empty = {
    is24hours: false,
    days: DAYS.reduce((acc, day) => {
      acc[day.key] = null
      return acc
    }, {}),
  }
  if (!parsed) return empty

  if (parsed.is24hours === true) {
    return {
      ...empty,
      is24hours: true,
    }
  }

  if (parsed.mode === '24_7') {
    return {
      ...empty,
      is24hours: true,
    }
  }

  const normalizedDays = { ...empty.days }

  // New schema keys: mon..sun
  for (const day of DAYS) {
    const entry = parsed.days?.[day.key]
    if (entry?.open && entry?.close) {
      normalizedDays[day.key] = { open: entry.open, close: entry.close }
    }
  }

  // Legacy schema keys: Mon..Sun
  for (const day of DAYS) {
    const legacyKey = day.label
    const entry = parsed.days?.[legacyKey]
    if (entry?.open && entry?.close) {
      normalizedDays[day.key] = { open: entry.open, close: entry.close }
    }
  }

  return {
    is24hours: false,
    days: normalizedDays,
  }
}

function formatDayRange(startIdx, endIdx) {
  if (startIdx === endIdx) return DAYS[startIdx].label
  return `${DAYS[startIdx].label}-${DAYS[endIdx].label}`
}

function groupRangesByValue(values, wanted) {
  const ranges = []
  let start = null
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === wanted && start === null) start = i
    if ((values[i] !== wanted || i === values.length - 1) && start !== null) {
      const end = values[i] === wanted && i === values.length - 1 ? i : i - 1
      ranges.push([start, end])
      start = null
    }
  }
  return ranges
}

function summarizeOpeningHours(normalized) {
  if (normalized.is24hours) return 'Open 24 hours'
  const dayValues = DAYS.map((d) => normalized.days[d.key])

  const openMap = {}
  dayValues.forEach((v) => {
    if (!v) return
    const key = `${v.open}-${v.close}`
    if (!openMap[key]) openMap[key] = []
  })

  const openParts = []
  for (const [slot, _] of Object.entries(openMap)) {
    const ranges = groupRangesByValue(
      dayValues.map((v) => (v ? `${v.open}-${v.close}` : null)),
      slot,
    )
    if (!ranges.length) continue
    const labelRanges = ranges.map(([start, end]) => formatDayRange(start, end)).join(', ')
    openParts.push(`${labelRanges} ${slot}`)
  }

  const closedRanges = groupRangesByValue(dayValues.map((v) => (v ? 'open' : 'closed')), 'closed')
  const closedPart = closedRanges.length
    ? `${closedRanges.map(([start, end]) => formatDayRange(start, end)).join(', ')} closed`
    : ''

  return [openParts.join(', '), closedPart].filter(Boolean).join(', ') || 'Hours unknown'
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
  const [showHoursForm, setShowHoursForm] = useState(false)
  const [hours24_7, setHours24_7] = useState(false)
  const [hoursByDay, setHoursByDay] = useState(
    DAYS.reduce((acc, day) => {
      acc[day.key] = { enabled: false, open: '09:00', close: '17:00' }
      return acc
    }, {}),
  )
  const [savingHours, setSavingHours] = useState(false)
  const [openingHoursValue, setOpeningHoursValue] = useState(toilet?.opening_hours ?? null)
  const [resolvedAddress, setResolvedAddress] = useState('')
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editingReviewValues, setEditingReviewValues] = useState(null)
  const [savingReviewEdit, setSavingReviewEdit] = useState(false)
  const [pendingReport, setPendingReport] = useState(null)
  const [verifyingReport, setVerifyingReport] = useState(false)
  const [suggestCostOpen, setSuggestCostOpen] = useState(false)
  const [suggestCostValue, setSuggestCostValue] = useState('')
  const [accessEditOpen, setAccessEditOpen] = useState(false)
  const [accessMode, setAccessMode] = useState('code')
  const [accessCodeDraft, setAccessCodeDraft] = useState('')
  const [suggestLocationTypeOpen, setSuggestLocationTypeOpen] = useState(false)
  const [suggestLocationTypeValue, setSuggestLocationTypeValue] = useState('Street/Public')
  const [savingSuggestion, setSavingSuggestion] = useState(false)
  const addressCacheRef = useRef({})
  const reviewPhotoInputRef = useRef(null)
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

  useEffect(() => {
    setOpeningHoursValue(toilet?.opening_hours ?? null)
    setShowHoursForm(false)
  }, [toilet?.id, toilet?.opening_hours])

  useEffect(() => {
    const normalized = normalizeOpeningHours(openingHoursValue)
    setHours24_7(Boolean(normalized.is24hours))
    setHoursByDay(
      DAYS.reduce((acc, day) => {
        const entry = normalized.days[day.key]
        acc[day.key] = entry
          ? { enabled: true, open: entry.open, close: entry.close }
          : { enabled: false, open: '09:00', close: '17:00' }
        return acc
      }, {}),
    )
  }, [openingHoursValue])

  useEffect(() => {
    let active = true
    const toiletId = toilet?.id
    const lat = Number(toilet?.lat)
    const lng = Number(toilet?.lng)
    if (!toiletId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      setResolvedAddress('')
      return
    }
    if (addressCacheRef.current[toiletId]) {
      setResolvedAddress(addressCacheRef.current[toiletId])
      return
    }
    if (!window.google?.maps?.Geocoder) {
      setResolvedAddress('')
      return
    }
    setLoadingAddress(true)
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (!active) return
      setLoadingAddress(false)
      if (status !== 'OK' || !results?.length) {
        setResolvedAddress('')
        return
      }
      const next = results[0]?.formatted_address || ''
      addressCacheRef.current[toiletId] = next
      setResolvedAddress(next)
    })
    return () => {
      active = false
    }
  }, [toilet?.id, toilet?.lat, toilet?.lng])

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

  const loadPendingReport = useCallback(async () => {
    if (!toilet?.id || !user?.id) {
      setPendingReport(null)
      return
    }
    const { data, error } = await supabase
      .from('reports')
      .select('id, toilet_id, user_id, reason, pending_review, confirmed_count, dismissed_count')
      .eq('toilet_id', toilet.id)
      .eq('pending_review', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      setPendingReport(null)
      return
    }
    if (!data || data.user_id === user.id) {
      setPendingReport(null)
      return
    }
    setPendingReport(data)
  }, [toilet?.id, user?.id])

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
    loadPendingReport()
  }, [loadPendingReport])

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
  const quickAccessCount = Number(toilet?.saves_count) || 0

  const tags = useMemo(() => {
    if (!toilet) return []
    const out = []
    if (toilet.is_accessible) out.push({ key: 'accessible', label: 'Accessible' })
    if (toilet.requires_key) out.push({ key: 'key', label: 'Requires Key' })
    if (toilet.gender_neutral) out.push({ key: 'neutral', label: 'Gender Neutral' })
    if (toilet.baby_changing) out.push({ key: 'baby', label: 'Baby Changing' })
    return out
  }, [toilet])

  const openingHours = useMemo(() => normalizeOpeningHours(openingHoursValue), [openingHoursValue])
  const openingHoursSummary = useMemo(() => summarizeOpeningHours(openingHours), [openingHours])
  const savedToiletIds = Array.isArray(userMeta?.saved_toilets) ? userMeta.saved_toilets : []
  const isFavorite = Boolean(toilet?.id && savedToiletIds.includes(toilet.id))
  const shouldShowKeyWarning =
    Boolean(userMeta?.is_pro) && hasBowelCondition(userMeta?.condition_profile) && Boolean(toilet?.requires_key)
  const streetName = useMemo(() => {
    if (!resolvedAddress) return ''
    return resolvedAddress.split(',')[0]?.trim() || ''
  }, [resolvedAddress])
  const displayTitle = useMemo(() => {
    const base = toilet?.name || 'Unnamed toilet'
    if (base === 'Public Toilet' && streetName) return `Public Toilet, ${streetName}`
    return base
  }, [toilet?.name, streetName])
  const locationType = toilet?.location_type || ''
  const accessState = useMemo(() => {
    if (toilet?.requires_key === false) return 'no_code'
    if (toilet?.requires_key === true && toilet?.access_code) return 'code_set'
    if (toilet?.requires_key === true) return 'code_required'
    return 'unknown'
  }, [toilet?.requires_key, toilet?.access_code])

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
    const { error: e2 } = await supabase
      .from('reviews')
      .update({ helpful_count: next })
      .eq('id', reviewId)
      .select()
      .maybeSingle()
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
    const { data, error } = await supabase
      .from('toilets')
      .update({ saves_count: next })
      .eq('id', toilet.id)
      .select()
      .maybeSingle()
    setSavingToilet(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    toilet.saves_count = Number(data?.saves_count) || next
    const key = `nwc_saved_toilet_${toilet.id}`
    window.sessionStorage.setItem(key, '1')
    setSavedThisToilet(true)
    try {
      await incrementUserPoints(toilet.added_by, 2)
    } catch (err) {
      showToast(err?.message || 'Saved, but points award failed.', 'error')
    }
    showToast(`You've been saved! 🙌 This toilet has now helped ${next} people`, 'success')
  }

  const startEditReview = (review) => {
    setEditingReviewId(review.id)
    setEditingReviewValues({
      overall_rating: Number(review.overall_rating ?? review.rating) || 5,
      cleanliness: Number(review.cleanliness) || 5,
      has_toilet_roll: review.has_toilet_roll ?? true,
      has_soap: review.has_soap ?? true,
      ibd_friendly: review.ibd_friendly ?? true,
      comment: review.comment || '',
    })
  }

  const saveEditedReview = async (reviewId) => {
    if (!editingReviewValues) return
    setSavingReviewEdit(true)
    const payload = {
      overall_rating: editingReviewValues.overall_rating,
      rating: editingReviewValues.overall_rating,
      cleanliness: editingReviewValues.cleanliness,
      has_toilet_roll: editingReviewValues.has_toilet_roll,
      has_soap: editingReviewValues.has_soap,
      ibd_friendly: editingReviewValues.ibd_friendly,
      comment: editingReviewValues.comment?.trim() || null,
    }
    const { error } = await supabase
      .from('reviews')
      .update(payload)
      .eq('id', reviewId)
      .select()
      .maybeSingle()
    setSavingReviewEdit(false)
    if (error) {
      showToast(error.message, 'error')
      return
    }
    setEditingReviewId(null)
    setEditingReviewValues(null)
    await loadReviews()
    showToast('Review updated ✅', 'success')
  }

  const saveSuggestion = async (patch) => {
    if (!user?.id || !toilet?.id) {
      showToast('Please log in to suggest an edit.', 'info')
      return
    }
    setSavingSuggestion(true)
    const { data, error } = await supabase
      .from('toilets')
      .update(patch)
      .eq('id', toilet.id)
      .select()
      .maybeSingle()
    if (!error) {
      Object.assign(toilet, data || patch)
      try {
        await incrementUserPoints(user.id, 5)
      } catch {
        // non-blocking
      }
      showToast('Thanks for the info! +5 points 🏅', 'success')
    } else {
      showToast(error.message, 'error')
    }
    setSavingSuggestion(false)
  }

  const submitReportVerification = async (verdict) => {
    if (!pendingReport || !user?.id) return
    setVerifyingReport(true)
    const { error: insertError } = await supabase.from('report_verifications').insert({
      report_id: pendingReport.id,
      user_id: user.id,
      verdict,
    })
    if (insertError) {
      setVerifyingReport(false)
      showToast(insertError.message, 'error')
      return
    }
    const confirmed = Number(pendingReport.confirmed_count || 0) + (verdict === 'confirmed' ? 1 : 0)
    const dismissed = Number(pendingReport.dismissed_count || 0) + (verdict === 'dismissed' ? 1 : 0)
    const reportPatch = { confirmed_count: confirmed, dismissed_count: dismissed }
    if (dismissed >= 3) reportPatch.pending_review = false
    if (confirmed >= 3 && pendingReport.reason === 'Permanently closed') {
      await supabase
        .from('toilets')
        .update({ is_closed: true })
        .eq('id', toilet.id)
        .select()
        .maybeSingle()
    }
    if (confirmed >= 3 && pendingReport.reason !== 'Permanently closed') {
      reportPatch.pending_review = false
      reportPatch.needs_admin_review = true
    }
    await supabase.from('reports').update(reportPatch).eq('id', pendingReport.id)
    try {
      await incrementUserPoints(user.id, 3)
    } catch {
      // non-blocking
    }
    setVerifyingReport(false)
    await loadPendingReport()
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

  const saveOpeningHours = async (e) => {
    e.preventDefault()
    if (!toilet?.id) return
    const anyEnabled = DAYS.some((day) => hoursByDay[day.key]?.enabled)
    if (!hours24_7 && !anyEnabled) {
      showToast('Select at least one day or choose always open.', 'error')
      return
    }

    const nextOpeningHours = {
      is24hours: Boolean(hours24_7),
      days: DAYS.reduce((acc, day) => {
        const entry = hoursByDay[day.key]
        acc[day.key] =
          !hours24_7 && entry?.enabled && entry?.open && entry?.close
            ? { open: entry.open, close: entry.close }
            : null
        return acc
      }, {}),
    }

    setSavingHours(true)
    const { data, error } = await supabase
      .from('toilets')
      .update({ opening_hours: JSON.stringify(nextOpeningHours) })
      .eq('id', toilet.id)
      .select()
      .maybeSingle()
    console.log('[ToiletDetail] opening_hours update response', { data, error })
    setSavingHours(false)
    if (error) {
      showToast(error.message || 'Failed to save opening hours', 'error')
      return
    }
    // Reflect updated hours immediately in the currently open sheet.
    toilet.opening_hours = data?.opening_hours ?? JSON.stringify(nextOpeningHours)
    setOpeningHoursValue(data?.opening_hours ?? nextOpeningHours)
    setShowHoursForm(false)
    showToast('Opening hours saved! 🕐', 'success')
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
  const toggleHoursDay = (dayKey) => {
    setHoursByDay((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled: !prev[dayKey].enabled,
      },
    }))
  }

  const setHoursValue = (dayKey, field, value) => {
    setHoursByDay((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }))
  }

  const applySameHoursEveryDay = () => {
    const selected = DAYS.filter((d) => hoursByDay[d.key]?.enabled)
    if (!selected.length) return
    const first = hoursByDay[selected[0].key]
    setHoursByDay((prev) =>
      DAYS.reduce((acc, day) => {
        const current = prev[day.key]
        acc[day.key] = current.enabled
          ? { ...current, open: first.open, close: first.close }
          : current
        return acc
      }, {}),
    )
  }

  const openAccessEditor = () => {
    if (toilet?.requires_key === false) {
      setAccessMode('none')
      setAccessCodeDraft('')
    } else {
      setAccessMode('code')
      setAccessCodeDraft(toilet?.access_code || '')
    }
    setAccessEditOpen(true)
  }

  const saveAccessSettings = async () => {
    console.log('saveAccessSettings called, mode:', accessMode)
    if (accessMode === 'code' && !accessCodeDraft.trim()) {
      showToast('Please enter an access code or choose no code needed.', 'error')
      return
    }

    if (accessMode === 'none') {
      await saveSuggestion({ requires_key: false, access_code: null })
      setAccessEditOpen(false)
      setAccessCodeDraft('')
      return
    }

    await saveSuggestion({ requires_key: true, access_code: accessCodeDraft.trim() })
    setAccessEditOpen(false)
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
          {pendingReport && (
            <div className={styles.verifyBanner}>
              <p>⚠️ Someone reported an issue with this toilet - can you help verify?</p>
              <div className={styles.verifyActions}>
                <button type="button" onClick={() => submitReportVerification('dismissed')} disabled={verifyingReport}>
                  Still accurate 👍
                </button>
                <button type="button" onClick={() => submitReportVerification('confirmed')} disabled={verifyingReport}>
                  Confirmed issue 👎
                </button>
              </div>
            </div>
          )}
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
            {displayTitle}
          </h2>
          {(resolvedAddress || loadingAddress) && (
            <button type="button" className={styles.addressBtn} onClick={openDirections}>
              {loadingAddress ? 'Finding address…' : resolvedAddress}
            </button>
          )}
          {showIbdFriendlyBadge && (
            <p className={styles.ibdBadge}>✅ Quick access - recommended in an emergency</p>
          )}
          {locationType && <p className={styles.locationTypeBadge}>📍 {locationType}</p>}
          <div className={styles.topActionsRow}>
            <button type="button" className={styles.directionsBtn} onClick={openDirections}>
              🗺️ Get Directions
            </button>
            <button type="button" className={styles.shareBtn} onClick={handleShare}>
              🔗 Share
            </button>
          </div>
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
  <span className={`${styles.pill} ${styles.pillFree}`}>✅ Free</span>
) : (
  <>
    <span className={`${styles.pill} ${styles.pillPaid}`}>
      {toilet.cost ? `💰 ${toilet.cost}` : '💰 Paid'}
    </span>
                {toilet.accepts_cash && <span className={styles.pill}>Cash</span>}
                {toilet.accepts_card && <span className={styles.pill}>Card</span>}
              </>
            )}
            {toilet.radar_key_accepted && <span className={styles.pill}>🔑 RADAR key accepted</span>}
          </div>
          {!toilet.is_free && !toilet.cost && (
            <div className={styles.inlineSuggest}>
              <span>How much does it cost?</span>
              {!suggestCostOpen ? (
                <button type="button" onClick={() => setSuggestCostOpen(true)}>
                  Add this ✏️
                </button>
              ) : (
                <div className={styles.inlineSuggestForm}>
                  <input value={suggestCostValue} onChange={(e) => setSuggestCostValue(e.target.value)} placeholder="e.g. 50p" />
                  <button
                    type="button"
                    disabled={savingSuggestion}
                    onClick={() => {
                      const costValue = suggestCostValue.trim()
                      if (!costValue) return
                      saveSuggestion({ cost: costValue, is_free: false })
                      setSuggestCostOpen(false)
                      setSuggestCostValue('')
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          )}

          {openingHoursSummary === 'Hours unknown' ? (
            <div className={styles.hoursUnknownRow}>
              <p className={styles.hoursUnknown}>Hours unknown</p>
              <button type="button" className={styles.addHoursBtn} onClick={() => setShowHoursForm((v) => !v)}>
                Add hours ✏️
              </button>
            </div>
          ) : (
            <div className={styles.hoursKnownRow}>
              <p className={styles.hoursSummary}>{openingHoursSummary}</p>
              <button type="button" className={styles.addHoursBtn} onClick={() => setShowHoursForm((v) => !v)}>
                Edit hours ✏️
              </button>
            </div>
          )}

          {showHoursForm && (
            <form className={styles.hoursForm} onSubmit={saveOpeningHours}>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={hours24_7}
                  onChange={(e) => setHours24_7(e.target.checked)}
                />
                <span>24 hours / Always open</span>
              </label>
              {!hours24_7 && (
                <div className={styles.hoursEditor}>
                  <div className={styles.daysPillsRow}>
                    {DAYS.map((day) => (
                      <button
                        key={day.key}
                        type="button"
                        className={`${styles.dayPill} ${hoursByDay[day.key]?.enabled ? styles.dayPillActive : ''}`}
                        onClick={() => toggleHoursDay(day.key)}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.sameHoursBtn} onClick={applySameHoursEveryDay}>
                    Same hours every day
                  </button>
                  <div className={styles.hoursDayRows}>
                    {DAYS.filter((d) => hoursByDay[d.key]?.enabled).map((day) => (
                      <div key={`hours-${day.key}`} className={styles.hoursDayRow}>
                        <span className={styles.hoursDayLabel}>{day.label}</span>
                        <select
                          className={styles.timeSelect}
                          value={hoursByDay[day.key].open}
                          onChange={(e) => setHoursValue(day.key, 'open', e.target.value)}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={`${day.key}-open-${time}`} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <span className={styles.timeDivider}>to</span>
                        <select
                          className={styles.timeSelect}
                          value={hoursByDay[day.key].close}
                          onChange={(e) => setHoursValue(day.key, 'close', e.target.value)}
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={`${day.key}-close-${time}`} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="submit" className={styles.submit} disabled={savingHours}>
                {savingHours ? 'Saving…' : 'Save hours'}
              </button>
            </form>
          )}

          <div className={styles.inlineSuggest}>
            {accessState === 'unknown' && <span>🔑 Access code unknown</span>}
            {accessState === 'no_code' && <span>🔓 No access code needed</span>}
            {accessState === 'code_set' && (
              <>
                <span>🔑 Code: {toilet.access_code}</span>
                <button type="button" className={styles.codeCopyBtn} onClick={copyAccessCode}>
                  {copiedCode ? 'Copied! ✓' : 'Copy'}
                </button>
              </>
            )}
            {accessState === 'code_required' && <span>🔑 Requires access code</span>}
            {!accessEditOpen ? (
              <button type="button" onClick={openAccessEditor}>
                {accessState === 'code_required' ? 'Add code ✏️' : accessState === 'unknown' ? 'Add this ✏️' : 'Edit ✏️'}
              </button>
            ) : (
              <div className={styles.inlineSuggestForm}>
                <div className={styles.verifyActions}>
                  <button
                    type="button"
                    className={accessMode === 'none' ? styles.segBtnActive : ''}
                    onClick={() => setAccessMode('none')}
                  >
                    No code needed
                  </button>
                  <button
                    type="button"
                    className={accessMode === 'code' ? styles.segBtnActive : ''}
                    onClick={() => setAccessMode('code')}
                  >
                    Code required
                  </button>
                </div>
                {accessMode === 'code' && (
                  <input
                    value={accessCodeDraft}
                    onChange={(e) => setAccessCodeDraft(e.target.value)}
                    placeholder="Access code"
                  />
                )}
                <button type="button" disabled={savingSuggestion} onClick={saveAccessSettings}>
                  Save
                </button>
              </div>
            )}
          </div>
          {!locationType && (
            <div className={styles.inlineSuggest}>
              <span>Where is this? (e.g. Train Station, Shopping Centre)</span>
              {!suggestLocationTypeOpen ? (
                <button type="button" onClick={() => setSuggestLocationTypeOpen(true)}>
                  Add this ✏️
                </button>
              ) : (
                <div className={styles.inlineSuggestForm}>
                  <select value={suggestLocationTypeValue} onChange={(e) => setSuggestLocationTypeValue(e.target.value)}>
                    {LOCATION_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={savingSuggestion}
                    onClick={() => {
                      saveSuggestion({ location_type: suggestLocationTypeValue })
                      setSuggestLocationTypeOpen(false)
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
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
                  {editingReviewId === r.id && editingReviewValues ? (
                    <div className={styles.inlineEditReview}>
                      <p className={styles.fieldLabel}>Overall rating</p>
                      <div className={styles.starPicker}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={`edit-overall-${n}`}
                            type="button"
                            className={`${styles.starBtn} ${n <= editingReviewValues.overall_rating ? styles.starBtnActive : ''}`}
                            onClick={() => setEditingReviewValues((prev) => ({ ...prev, overall_rating: n }))}
                          >
                            <StarIcon filled={n <= editingReviewValues.overall_rating} />
                          </button>
                        ))}
                      </div>
                      <p className={styles.fieldLabel}>Cleanliness</p>
                      <div className={styles.starPicker}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={`edit-clean-${n}`}
                            type="button"
                            className={`${styles.starBtn} ${n <= editingReviewValues.cleanliness ? styles.starBtnActive : ''}`}
                            onClick={() => setEditingReviewValues((prev) => ({ ...prev, cleanliness: n }))}
                          >
                            <StarIcon filled={n <= editingReviewValues.cleanliness} />
                          </button>
                        ))}
                      </div>
                      <div className={styles.seg} role="group">
                        <button
                          type="button"
                          className={`${styles.segBtn} ${editingReviewValues.ibd_friendly ? styles.segBtnActive : ''}`}
                          onClick={() => setEditingReviewValues((prev) => ({ ...prev, ibd_friendly: true }))}
                        >
                          Quick access: Yes
                        </button>
                        <button
                          type="button"
                          className={`${styles.segBtn} ${!editingReviewValues.ibd_friendly ? styles.segBtnActive : ''}`}
                          onClick={() => setEditingReviewValues((prev) => ({ ...prev, ibd_friendly: false }))}
                        >
                          Quick access: No
                        </button>
                      </div>
                      <textarea
                        className={styles.textarea}
                        rows={3}
                        value={editingReviewValues.comment}
                        onChange={(e) => setEditingReviewValues((prev) => ({ ...prev, comment: e.target.value }))}
                      />
                      <div className={styles.verifyActions}>
                        <button type="button" onClick={() => saveEditedReview(r.id)} disabled={savingReviewEdit}>
                          {savingReviewEdit ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReviewId(null)
                            setEditingReviewValues(null)
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : r.user_id && reviewerMeta[r.user_id] ? (
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
                          Quick access: {r.ibd_friendly ? 'Yes' : 'No'}
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
                  {user && r.user_id === user.id && editingReviewId !== r.id && (
                    <button type="button" className={styles.helpfulBtn} onClick={() => startEditReview(r)}>
                      Edit ✏️
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {quickAccessCount > 0 && <p className={styles.savedCountLine}>🙌 {quickAccessCount} people were saved here</p>}
          <button
            type="button"
            className={styles.savedBtn}
            onClick={markSavedMe}
            disabled={savingToilet || savedThisToilet}
          >
            {savedThisToilet ? 'Saved me! 🙌' : savingToilet ? 'Saving…' : 'This saved me 🙌'}
          </button>
          {savedThisToilet && <p className={styles.savedNote}>+2 points awarded to the person who added this WC</p>}

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
                      Quick access?
                    </p>
                    <p className={styles.photoUploadHint}>
                      Would you recommend this in an emergency? Quick to find, no queue, accessible.
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
                    <button
                      type="button"
                      className={styles.photoUploadBtn}
                      onClick={() => reviewPhotoInputRef.current?.click()}
                    >
                      📷 Add entrance photo (optional)
                    </button>
                    <input
                      ref={reviewPhotoInputRef}
                      className={styles.fileInput}
                      type="file"
                      accept="image/*"
                      onChange={onReviewPhotoChange}
                    />
                    <p className={styles.photoUploadHint}>
                      Show people where to find it - a photo of the entrance or access point helps a lot 📍
                    </p>
                    {reviewPhotoPreview && (
                      <img src={reviewPhotoPreview} alt="Review preview" className={styles.reviewThumbLarge} />
                    )}
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
