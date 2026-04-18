import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import BackButton from '../components/BackButton'
import { supabase } from '../supabaseClient'
import { incrementUserPoints } from '../lib/userPoints'
import { uploadReviewPhoto } from '../lib/storageUploads'
import { getLevelFromPoints } from '../utils/points'
import styles from './ToiletPage.module.css'

function parseOpeningHours(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function score(review) {
  return Number(review.overall_rating ?? review.rating) || 0
}

function StarRow({ value }) {
  const stars = Math.max(0, Math.min(5, Number(value) || 0))
  return <span>{'⭐'.repeat(stars)} ({stars}/5)</span>
}

function ToiletPage() {
  const { id } = useParams()
  const reviewFormRef = useRef(null)
  const [user, setUser] = useState(null)
  const [toilet, setToilet] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewerMeta, setReviewerMeta] = useState({})
  const [helpfulLoadingId, setHelpfulLoadingId] = useState(null)
  const [newOverall, setNewOverall] = useState(5)
  const [newClean, setNewClean] = useState(5)
  const [newRoll, setNewRoll] = useState(true)
  const [newSoap, setNewSoap] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [reviewPhoto, setReviewPhoto] = useState(null)
  const [reviewPhotoPreview, setReviewPhotoPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalPhoto, setModalPhoto] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  const load = useCallback(async () => {
    if (!id) return
    const [{ data: toiletData }, { data: reviewData }] = await Promise.all([
      supabase.from('toilets').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('reviews')
        .select(
          'id, user_id, helpful_count, overall_rating, cleanliness, has_toilet_roll, has_soap, comment, photo_url, created_at',
        )
        .eq('toilet_id', id)
        .order('created_at', { ascending: false }),
    ])
    setToilet(toiletData || null)
    const list = reviewData || []
    setReviews(list)
    const authorIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))]
    if (authorIds.length) {
      const { data: pointsRows } = await supabase
        .from('user_points')
        .select('user_id, points')
        .in('user_id', authorIds)
      const meta = {}
      for (const row of pointsRows || []) {
        const lvl = getLevelFromPoints(row.points)
        meta[row.user_id] = `${lvl.emoji} ${lvl.name}`
      }
      setReviewerMeta(meta)
    } else {
      setReviewerMeta({})
    }
  }, [id])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return () => {
      if (reviewPhotoPreview) URL.revokeObjectURL(reviewPhotoPreview)
    }
  }, [reviewPhotoPreview])

  const openingHours = useMemo(() => parseOpeningHours(toilet?.opening_hours), [toilet?.opening_hours])
  const openingHoursLines = useMemo(() => {
    if (!openingHours || openingHours.mode !== 'scheduled' || !openingHours.days) return []
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return order
      .map((day) => {
        const slot = openingHours.days[day]
        if (!slot?.open || !slot?.close) return null
        return `${day}: ${slot.open} - ${slot.close}`
      })
      .filter(Boolean)
  }, [openingHours])

  const summary = useMemo(() => {
    if (!reviews.length) {
      return { overall: 0, clean: 0, rollPct: 0, soapPct: 0 }
    }
    const overall = reviews.reduce((acc, r) => acc + score(r), 0) / reviews.length
    const clean = reviews.reduce((acc, r) => acc + (Number(r.cleanliness) || 0), 0) / reviews.length
    const rollPct =
      (reviews.filter((r) => r.has_toilet_roll === true).length / reviews.length) * 100
    const soapPct = (reviews.filter((r) => r.has_soap === true).length / reviews.length) * 100
    return { overall, clean, rollPct, soapPct }
  }, [reviews])

  const copyCode = async () => {
    if (!toilet?.access_code) return
    await navigator.clipboard.writeText(toilet.access_code)
    setCopiedCode(true)
    window.setTimeout(() => setCopiedCode(false), 2000)
  }

  const onReviewPhotoChange = (e) => {
    const file = e.target.files?.[0]
    setReviewPhoto(file || null)
    if (reviewPhotoPreview) URL.revokeObjectURL(reviewPhotoPreview)
    setReviewPhotoPreview(file ? URL.createObjectURL(file) : '')
  }

  const submitReview = async (e) => {
    e.preventDefault()
    if (!user || !id) return
    setSubmitting(true)
    let photoUrl = null
    if (reviewPhoto) {
      photoUrl = await uploadReviewPhoto(reviewPhoto, user.id)
    }
    const { error } = await supabase.from('reviews').insert([
      {
        toilet_id: id,
        user_id: user.id,
        overall_rating: newOverall,
        cleanliness: newClean,
        has_toilet_roll: newRoll,
        has_soap: newSoap,
        comment: newComment.trim() || null,
        photo_url: photoUrl,
      },
    ])
    setSubmitting(false)
    if (error) return
    await incrementUserPoints(user.id, 10)
    setNewOverall(5)
    setNewClean(5)
    setNewRoll(true)
    setNewSoap(true)
    setNewComment('')
    setReviewPhoto(null)
    if (reviewPhotoPreview) URL.revokeObjectURL(reviewPhotoPreview)
    setReviewPhotoPreview('')
    await load()
  }

  const markHelpful = async (reviewId, authorId) => {
    if (!user || !authorId || authorId === user.id) return
    setHelpfulLoadingId(reviewId)
    const { data } = await supabase.from('reviews').select('helpful_count').eq('id', reviewId).maybeSingle()
    const next = (Number(data?.helpful_count) || 0) + 1
    await supabase.from('reviews').update({ helpful_count: next }).eq('id', reviewId)
    await incrementUserPoints(authorId, 5)
    setHelpfulLoadingId(null)
    await load()
  }

  if (!toilet) {
    return (
      <div className={styles.page}>
        <BackButton />
        <p className={styles.loading}>Loading toilet details…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <section className={styles.card}>
        <h1 className={styles.title}>{toilet.name}</h1>
        <div className={styles.summaryGrid}>
          <div><strong>{summary.clean.toFixed(1)}</strong><span>Cleanliness</span></div>
          <div><strong>{summary.overall.toFixed(1)}</strong><span>Overall</span></div>
          <div><strong>{Math.round(summary.rollPct)}%</strong><span>Toilet roll</span></div>
          <div><strong>{Math.round(summary.soapPct)}%</strong><span>Soap</span></div>
        </div>

        {isLoaded && (
          <GoogleMap
            mapContainerClassName={styles.map}
            center={{ lat: toilet.lat, lng: toilet.lng }}
            zoom={16}
            options={{ disableDefaultUI: true, zoomControl: true }}
          >
            <Marker position={{ lat: toilet.lat, lng: toilet.lng }} />
          </GoogleMap>
        )}

        <div className={styles.pills}>
          {toilet.is_free ? <span className={styles.pillFree}>Free 🆓</span> : <span className={styles.pill}>Paid {toilet.cost || ''}</span>}
          {toilet.accepts_cash && <span className={styles.pill}>Cash</span>}
          {toilet.accepts_card && <span className={styles.pill}>Card</span>}
          {toilet.is_accessible && <span className={styles.pill}>Accessible</span>}
          {toilet.requires_key && <span className={styles.pill}>Requires Key</span>}
          {toilet.baby_changing && <span className={styles.pill}>Baby Changing</span>}
        </div>

        <p className={styles.sectionTitle}>Opening hours</p>
        {openingHours?.mode === '24_7' ? <p className={styles.row}>24 hours 🕐</p> : openingHoursLines.length ? openingHoursLines.map((line) => <p className={styles.row} key={line}>{line}</p>) : <p className={styles.row}>Hours unknown</p>}

        {toilet.access_code && (
          <div className={styles.codeBox}>
            <code>{toilet.access_code}</code>
            <button type="button" onClick={copyCode}>{copiedCode ? 'Copied! ✓' : 'Copy code'}</button>
          </div>
        )}

        {toilet.description && <p className={styles.description}>{toilet.description}</p>}

        <button type="button" className={styles.cta} onClick={() => reviewFormRef.current?.scrollIntoView({ behavior: 'smooth' })}>
          Leave a Review
        </button>
      </section>

      <section className={styles.card}>
        <h2 className={styles.sectionTitle}>Reviews</h2>
        {reviews.map((r) => (
          <article key={r.id} className={styles.reviewCard}>
            <p className={styles.reviewMeta}>{reviewerMeta[r.user_id] || 'Community member'} • <StarRow value={score(r)} /></p>
            <p className={styles.reviewMeta}>Cleanliness {Number(r.cleanliness) || 0}/5</p>
            <p className={styles.reviewMeta}>Roll: {r.has_toilet_roll ? 'Yes' : 'No'} • Soap: {r.has_soap ? 'Yes' : 'No'}</p>
            {r.comment && <p className={styles.reviewBody}>{r.comment}</p>}
            {r.photo_url && (
              <img
                src={r.photo_url}
                alt="Review upload"
                className={styles.thumb}
                onClick={() => setModalPhoto(r.photo_url)}
              />
            )}
            {user && r.user_id && r.user_id !== user.id && (
              <button type="button" className={styles.helpfulBtn} onClick={() => markHelpful(r.id, r.user_id)} disabled={helpfulLoadingId === r.id}>
                {helpfulLoadingId === r.id ? 'Saving…' : `Helpful · ${Number(r.helpful_count) || 0}`}
              </button>
            )}
          </article>
        ))}
      </section>

      <section className={styles.card} ref={reviewFormRef}>
        <h2 className={styles.sectionTitle}>Add your review</h2>
        {user ? (
          <form onSubmit={submitReview} className={styles.form}>
            <label>Overall (1-5)
              <input type="number" min="1" max="5" value={newOverall} onChange={(e) => setNewOverall(Number(e.target.value) || 1)} />
            </label>
            <label>Cleanliness (1-5)
              <input type="number" min="1" max="5" value={newClean} onChange={(e) => setNewClean(Number(e.target.value) || 1)} />
            </label>
            <label><input type="checkbox" checked={newRoll} onChange={(e) => setNewRoll(e.target.checked)} /> Toilet roll available</label>
            <label><input type="checkbox" checked={newSoap} onChange={(e) => setNewSoap(e.target.checked)} /> Soap available</label>
            <textarea rows={4} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Anything else worth knowing?" />
            <input type="file" accept="image/*" onChange={onReviewPhotoChange} />
            {reviewPhotoPreview && <img src={reviewPhotoPreview} alt="Review preview" className={styles.thumbLarge} />}
            <button type="submit" disabled={submitting}>{submitting ? 'Posting…' : 'Post review'}</button>
          </form>
        ) : (
          <p className={styles.row}>Login to leave a review.</p>
        )}
      </section>

      {modalPhoto && (
        <button type="button" className={styles.photoModal} onClick={() => setModalPhoto('')}>
          <img src={modalPhoto} alt="Full screen review" />
        </button>
      )}
    </div>
  )
}

export default ToiletPage
