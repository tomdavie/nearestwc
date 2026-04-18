import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { useToast } from '../context/useToast'
import styles from './AddToilet.module.css'

const defaultCenter = { lat: 51.505, lng: -0.09 }

function AddToilet() {
  const [name, setName] = useState('')
  const [position, setPosition] = useState(null)
  const [isFree, setIsFree] = useState(true)
  const [isAccessible, setIsAccessible] = useState(false)
  const [requiresKey, setRequiresKey] = useState(false)
  const [genderNeutral, setGenderNeutral] = useState(false)
  const [babyChanging, setBabyChanging] = useState(false)
  const [user, setUser] = useState(null)
  const [submitting, setSubmitting] = useState(false)
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
    setSubmitting(true)
    const { error } = await supabase.from('toilets').insert([
      {
        name,
        lat: position.lat,
        lng: position.lng,
        added_by: user.id,
        is_free: isFree,
        is_accessible: isAccessible,
        requires_key: requiresKey,
        gender_neutral: genderNeutral,
        baby_changing: babyChanging,
      },
    ])
    setSubmitting(false)
    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Toilet added. Thanks for helping the community!', 'success')
      setTimeout(() => navigate('/'), 1200)
    }
  }

  const center = position || defaultCenter

  return (
    <div className={styles.page}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>Add a toilet</h1>
        <p className={styles.subtitle}>
          Drop the pin on the exact entrance so others can find it quickly.
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
          <label className={styles.option}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Free to use</span>
              <span className={styles.optionDesc}>No payment required</span>
            </span>
          </label>
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
              checked={requiresKey}
              onChange={(e) => setRequiresKey(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>Key or code required</span>
              <span className={styles.optionDesc}>Staff, radar key, or door code</span>
            </span>
          </label>
          <label className={styles.option}>
            <input
              className={styles.checkbox}
              type="checkbox"
              checked={genderNeutral}
              onChange={(e) => setGenderNeutral(e.target.checked)}
            />
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>All-gender</span>
              <span className={styles.optionDesc}>Not split into binary men or women only</span>
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
