import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api'
import { supabase } from '../supabaseClient'
import ToiletDetail from '../components/ToiletDetail'
import styles from './MapView.module.css'

const defaultCenter = { lat: 51.505, lng: -0.09 }

function getMarkerColor(averageRating) {
  if (averageRating == null) return '#9aa0a6'
  if (averageRating <= 2) return '#d93025'
  if (averageRating < 4) return '#f9ab00'
  return '#188038'
}

function createMarkerIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
      <circle cx="21" cy="21" r="18" fill="${color}" stroke="white" stroke-width="3" />
      <text x="21" y="25" text-anchor="middle" font-size="18">🚻</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function SearchIcon() {
  return (
    <span className={styles.searchIcon} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M16 16l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function MapView() {
  const [toilets, setToilets] = useState([])
  const [selected, setSelected] = useState(null)
  const [user, setUser] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [query, setQuery] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  })

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {},
    )
  }, [])

  useEffect(() => {
    const fetchToilets = async () => {
      const [{ data: toiletsData, error: toiletsError }, { data: reviewsData, error: reviewsError }] =
        await Promise.all([
          supabase.from('toilets').select('*'),
          supabase.from('reviews').select('toilet_id, overall_rating, rating'),
        ])

      if (toiletsError) return

      const averages = {}
      if (!reviewsError) {
        for (const review of reviewsData || []) {
          const score = Number(review.overall_rating ?? review.rating)
          if (!review.toilet_id || !score) continue
          const current = averages[review.toilet_id] || { total: 0, count: 0 }
          current.total += score
          current.count += 1
          averages[review.toilet_id] = current
        }
      }

      setToilets(
        (toiletsData || []).map((toilet) => {
          const rating = averages[toilet.id]
          return {
            ...toilet,
            average_rating: rating ? rating.total / rating.count : null,
          }
        }),
      )
    }
    fetchToilets()
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return toilets.filter((t) => {
      if (q && !(t.name || '').toLowerCase().includes(q)) return false
      if (freeOnly && !t.is_free) return false
      if (accessibleOnly && !t.is_accessible) return false
      return true
    })
  }, [toilets, query, freeOnly, accessibleOnly])

  if (!isLoaded) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} aria-hidden />
        <p>Loading map…</p>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <GoogleMap
        mapContainerClassName={styles.map}
        center={userLocation || defaultCenter}
        zoom={15}
        options={{
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        }}
      >
        {filtered.map((toilet) => (
          <Marker
            key={toilet.id}
            position={{ lat: toilet.lat, lng: toilet.lng }}
            onClick={() => setSelected(toilet)}
            icon={{
              url: createMarkerIcon(getMarkerColor(toilet.average_rating)),
              scaledSize: new window.google.maps.Size(42, 42),
              anchor: new window.google.maps.Point(21, 21),
            }}
          />
        ))}

      </GoogleMap>

      {selected && (
        <ToiletDetail
          key={selected.id}
          toilet={selected}
          user={user}
          onClose={() => setSelected(null)}
        />
      )}

      <div className={styles.floatingBar}>
        <div className={styles.searchCard}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            type="search"
            enterKeyHint="search"
            placeholder="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search toilets by name"
          />
        </div>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${styles.chip} ${freeOnly ? styles.chipActive : ''}`}
            onClick={() => setFreeOnly((v) => !v)}
          >
            Free only
          </button>
          <button
            type="button"
            className={`${styles.chip} ${accessibleOnly ? styles.chipActive : ''}`}
            onClick={() => setAccessibleOnly((v) => !v)}
          >
            Accessible
          </button>
        </div>
      </div>

      <Link to="/add" className={styles.fab} title="Add a WC">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
        <span className="sr-only">Add a toilet</span>
      </Link>
    </div>
  )
}

export default MapView
