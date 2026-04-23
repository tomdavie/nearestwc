import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { incrementUserPoints } from '../lib/userPoints'
import { uploadToiletPhoto } from '../lib/storageUploads'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { useToast } from '../context/useToast'
import BackButton from '../components/BackButton'
import { track } from '../utils/analytics'
import styles from './AddToilet.module.css'

const defaultCenter = { lat: 51.505, lng: -0.09 }
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0')
  const minutes = i % 2 === 0 ? '00' : '30'
  return `${hours}:${minutes}`
})

const defaultSchedule = DAYS.reduce((acc, day) => {
  acc[day] = { enabled: false, open: '09:00', close: '17:00' }
  return acc
}, {})

function AddToilet() {
  const [name, setName] = useState('')
  const [isTwentyFourHours, setIsTwentyFourHours] = useState(false)
  const [openingHours, setOpeningHours] = useState(defaultSchedule)
  const [accessEntry, setAccessEntry] = useState('free')
  const [restrictionType, setRestrictionType] = useState('requires_key')
  const [accessCodeInput, setAccessCodeInput] = useState('')
  const [description, setDescription] = useState('')
  const [toiletPhoto, setToiletPhoto] = useState(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('')
  const [position, setPosition] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('free')
  const [cost, setCost] = useState('')
  const [isAccessible, setIsAccessible] = useState(false)
  const [babyChanging, setBabyChanging] = useState(false)
  const [user, setUser] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [celebrate, setCelebrate] = useState(false)
  const [celebrateBadges, setCelebrateBadges] = useState([])
  const navigate = useNavigate()
  const { showToast } = useToast()

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
    })
  }, [])

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    }
  }, [photoPreviewUrl])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        setPosition(defaultCenter)
      },
    )
  }, [])

  const onMarkerDragEnd = useCallback((e) => {
    if (e.latLng) {
      setPosition({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    }
  }, [])

  const handleDayToggle = (day) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }))
  }

  const handleDayTimeChange = (day, key, value) => {
    setOpeningHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [key]: value,
      },
    }))
  }

  const selectedDays = DAYS.filter((day) => openingHours[day].enabled)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      showToast('Sign in to add a toilet.', 'error')
      return
    }
    if (!position) {
      showToast('Wait for your location or move the map pin.', 'info')
      return
    }
    const openingHoursPayload = isTwentyFourHours
      ? { mode: '24_7' }
      : {
          mode: 'scheduled',
          closed_on_unlisted_days: true,
          days: DAYS.filter((day) => openingHours[day].enabled).reduce((acc, day) => {
            acc[day] = {
              open: openingHours[day].open,
              close: openingHours[day].close,
            }
            return acc
          }, {}),
        }
    let toiletPhotoUrl = null
    if (toiletPhoto) {
      try {
        toiletPhotoUrl = await uploadToiletPhoto(toiletPhoto, user.id)
      } catch (err) {
        showToast(err?.message || 'Could not upload toilet photo.', 'error')
      }
    }
    const isFree = paymentMethod === 'free'
    const accepts_card = paymentMethod === 'card'
    const accepts_cash = paymentMethod === 'cash'

    let requires_key = false
    let access_code = null
    let radar_key_accepted = false
    if (accessEntry === 'restricted') {
      if (restrictionType === 'requires_key') {
        requires_key = true
        access_code = accessCodeInput.trim() || null
      } else if (restrictionType === 'requires_code') {
        requires_key = false
        access_code = accessCodeInput.trim() || null
      } else if (restrictionType === 'ask_counter') {
        requires_key = false
        access_code = null
      } else if (restrictionType === 'radar_only') {
        requires_key = true
        radar_key_accepted = true
        access_code = accessCodeInput.trim() || null
      }
    }

    setSubmitting(true)
    const { data: insertedToilets, error } = await supabase
      .from('toilets')
      .insert([
        {
          name,
          lat: position.lat,
          lng: position.lng,
          added_by: user.id,
          is_free: isFree,
          cost: isFree ? null : cost.trim() || null,
          accepts_cash: isFree ? false : accepts_cash,
          accepts_card: isFree ? false : accepts_card,
          is_accessible: isAccessible,
          requires_key,
          radar_key_accepted,
          baby_changing: babyChanging,
          opening_hours: JSON.stringify(openingHoursPayload),
          access_code,
          description: description.trim() || null,
          photo_url: toiletPhotoUrl,
        },
      ])
      .select('id')
    setSubmitting(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      track('toilet_added', {
        toilet_id: insertedToilets?.[0]?.id || null,
      })
      let gamification = { newBadges: [] }
      try {
        gamification = await incrementUserPoints(user.id, 20)
      } catch (err) {
        showToast(err?.message || 'Toilet saved, but points could not be updated.', 'error')
      }
      setCelebrateBadges(gamification?.newBadges || [])
      setCelebrate(true)
      window.setTimeout(() => navigate('/'), 3000)
    }
  }

  const center = position || defaultCenter

  const onToiletPhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      setToiletPhoto(null)
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
      setPhotoPreviewUrl('')
      return
    }
    setToiletPhoto(file)
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl)
    setPhotoPreviewUrl(URL.createObjectURL(file))
  }

  return (
    <div className={styles.page}>
      <BackButton />
      {celebrate && (
        <div className={styles.celebrateOverlay} role="status" aria-live="polite">
          <div className={styles.celebrateCard}>
            Boom. You just helped someone in need. 🎉 +20 points added to your account.
            {celebrateBadges.length > 0 && (
              <p className={styles.celebrateBadges}>
                {celebrateBadges
                  .map(
                    (b) =>
                      `🎉 Badge Unlocked: ${b.name}! ${b.description} Humanity salutes you.`,
                  )
                  .join('\n\n')}
              </p>
            )}
          </div>
        </div>
      )}

      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Add a toilet</h1>
        <p className={styles.subtitle}>
          Drop the pin on the exact entrance so others can find it quickly. Precision beats panic.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.card}>
          <label className={styles.cardLabel} htmlFor="wc-name">
            Name
          </label>
          <input
            id="wc-name"
            className={styles.field}
            type="text"
            placeholder="e.g. Buchanan Street public toilets"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="off"
          />
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>
            Opening hours
          </span>
          <label className={styles.toggleRow}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={isTwentyFourHours}
              onChange={(e) => setIsTwentyFourHours(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>24 hours</span>
              <span className={styles.optionDesc}>If it never sleeps, neither must this schedule.</span>
            </span>
          </label>
          <div className={`${styles.hoursGrid} ${isTwentyFourHours ? styles.hoursGridDisabled : ''}`}>
            <div className={styles.daysRow}>
              {DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`${styles.dayToggle} ${openingHours[day].enabled ? styles.dayToggleActive : ''}`}
                  onClick={() => handleDayToggle(day)}
                  disabled={isTwentyFourHours}
                >
                  {day}
                </button>
              ))}
            </div>
            {!isTwentyFourHours && selectedDays.length > 0 && (
              <div className={styles.inlineTimes}>
                {selectedDays.map((day) => (
                  <div key={`time-${day}`} className={styles.timeRow}>
                    <span className={styles.dayInlineLabel}>{day}</span>
                    <select
                      className={styles.timeSelect}
                      value={openingHours[day].open}
                      onChange={(e) => handleDayTimeChange(day, 'open', e.target.value)}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={`${day}-open-${time}`} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <span className={styles.timeDivider}>to</span>
                    <select
                      className={styles.timeSelect}
                      value={openingHours[day].close}
                      onChange={(e) => handleDayTimeChange(day, 'close', e.target.value)}
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={`${day}-close-${time}`} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className={styles.scheduleNote}>Closed on all days not listed.</p>

          <span className={`${styles.cardLabel} ${styles.cardLabelFollow}`}>Access &amp; Entry</span>
          <div className={styles.accessBlock}>
            <div className={styles.paymentToggleRow}>
              <button
                type="button"
                className={`${styles.paymentToggle} ${accessEntry === 'free' ? styles.paymentToggleActive : ''}`}
                onClick={() => setAccessEntry('free')}
              >
                Freely accessible
              </button>
              <button
                type="button"
                className={`${styles.paymentToggle} ${accessEntry === 'restricted' ? styles.paymentToggleActive : ''}`}
                onClick={() => setAccessEntry('restricted')}
              >
                Restricted access
              </button>
            </div>
            {accessEntry === 'restricted' && (
              <div className={styles.accessRestricted}>
                <label className={styles.accessLabel} htmlFor="restriction-type">
                  Restriction type
                </label>
                <select
                  id="restriction-type"
                  className={styles.accessSelect}
                  value={restrictionType}
                  onChange={(e) => setRestrictionType(e.target.value)}
                >
                  <option value="requires_key">Requires key</option>
                  <option value="requires_code">Requires code</option>
                  <option value="ask_counter">Ask at counter</option>
                  <option value="radar_only">RADAR key only</option>
                </select>
                {(restrictionType === 'requires_key' ||
                  restrictionType === 'requires_code' ||
                  restrictionType === 'radar_only') && (
                  <>
                    <label className={styles.accessLabel} htmlFor="wc-access-code">
                      Code (if known)
                    </label>
                    <input
                      id="wc-access-code"
                      className={styles.field}
                      type="text"
                      placeholder="Enter code if known"
                      value={accessCodeInput}
                      onChange={(e) => setAccessCodeInput(e.target.value)}
                      autoComplete="off"
                    />
                  </>
                )}
              </div>
            )}
          </div>

          <label className={`${styles.cardLabel} ${styles.cardLabelFollow}`} htmlFor="wc-desc">
            Description
          </label>
          <textarea
            id="wc-desc"
            className={styles.textarea}
            placeholder="Tell people what to expect. No pressure, but details help."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
          <label className={`${styles.cardLabel} ${styles.cardLabelFollow}`} htmlFor="wc-photo">
            Exterior photo (optional)
          </label>
          <input
            id="wc-photo"
            className={styles.field}
            type="file"
            accept="image/*"
            onChange={onToiletPhotoChange}
          />
          {photoPreviewUrl && (
            <img className={styles.photoPreview} src={photoPreviewUrl} alt="Toilet exterior preview" />
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Location on map</span>
          <div className={styles.mapShell}>
            {!isLoaded || !position ? (
              <div className={styles.mapLoading}>Loading map…</div>
            ) : (
              <GoogleMap
                mapContainerClassName={styles.map}
                center={center}
                zoom={17}
                options={{
                  fullscreenControl: false,
                  mapTypeControl: false,
                  streetViewControl: false,
                  zoomControl: true,
                }}
              >
                <Marker
                  position={position}
                  draggable
                  onDragEnd={onMarkerDragEnd}
                />
              </GoogleMap>
            )}
          </div>
          <p className={styles.mapHint}>Drag the pin to fine-tune the location.</p>
          {position && (
            <p className={styles.coords}>
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </p>
          )}
        </div>

        <div className={styles.card}>
          <span className={styles.cardLabel}>Details</span>
          <div className={styles.paymentBlock}>
            <p className={styles.optionTitle}>Payment</p>
            <div className={styles.paymentPillsRow}>
              <button
                type="button"
                className={`${styles.paymentPill} ${paymentMethod === 'free' ? styles.paymentToggleActive : ''}`}
                onClick={() => setPaymentMethod('free')}
              >
                Free
              </button>
              <button
                type="button"
                className={`${styles.paymentPill} ${paymentMethod === 'card' ? styles.paymentToggleActive : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                Card accepted
              </button>
              <button
                type="button"
                className={`${styles.paymentPill} ${paymentMethod === 'cash' ? styles.paymentToggleActive : ''}`}
                onClick={() => setPaymentMethod('cash')}
              >
                Cash only
              </button>
            </div>
            {(paymentMethod === 'card' || paymentMethod === 'cash') && (
              <div className={styles.paidFields}>
                <label className={styles.costLabel} htmlFor="wc-cost">
                  How much? e.g. 50p, £1
                </label>
                <input
                  id="wc-cost"
                  className={styles.field}
                  type="text"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="e.g. 50p, £1"
                  autoComplete="off"
                />
              </div>
            )}
          </div>
          <label className={styles.option}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={isAccessible}
              onChange={(e) => setIsAccessible(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Wheelchair accessible</span>
              <span className={styles.optionDesc}>Step-free access and usable facilities</span>
            </span>
          </label>
          <label className={styles.option}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={babyChanging}
              onChange={(e) => setBabyChanging(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Baby changing</span>
              <span className={styles.optionDesc}>Table or mat available</span>
            </span>
          </label>
        </div>

        <button className={styles.submit} type="submit" disabled={submitting || !isLoaded}>
          {submitting ? 'Saving…' : 'Save toilet'}
        </button>
      </form>
    </div>
  )
}

export default AddToilet
