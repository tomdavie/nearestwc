import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker, MarkerClustererF } from '@react-google-maps/api'
import { supabase } from '../supabaseClient'
import ToiletDetail from '../components/ToiletDetail'
import UrgentMode from '../components/UrgentMode'
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
      <circle cx="21" cy="21" r="18" fill="${color}" stroke="#ffffff" stroke-width="3" />
      <text x="21" y="25" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff" font-family="Arial, sans-serif">WC</text>
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
  const [map, setMap] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [searching, setSearching] = useState(false)

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
    const now = new Date()
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

    const isOpenNow = (toilet) => {
      if (!openNowOnly) return true
      if (!toilet.opening_hours) return false
      let parsed = null
      try {
        parsed =
          typeof toilet.opening_hours === 'string'
            ? JSON.parse(toilet.opening_hours)
            : toilet.opening_hours
      } catch {
        return false
      }
      if (!parsed) return false
      if (parsed.mode === '24_7') return true
      if (parsed.mode !== 'scheduled' || !parsed.days) return false
      const daySlot = parsed.days[weekday]
      if (!daySlot?.open || !daySlot?.close) return false
      return currentTime >= daySlot.open && currentTime <= daySlot.close
    }

    return toilets.filter((t) => {
      if (freeOnly && !t.is_free) return false
      if (accessibleOnly && !t.is_accessible) return false
      if (!isOpenNow(t)) return false
      return true
    })
  }, [toilets, freeOnly, accessibleOnly, openNowOnly])

  const locateMe = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(point)
        if (map) {
          map.panTo(point)
          map.setZoom(16)
        }
      },
      () => {},
    )
  }

  const clusterOptions = useMemo(() => {
    if (!window.google?.maps) return undefined
    return {
      renderer: {
        render: ({ count, position }) =>
          new window.google.maps.Marker({
            position,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#1a73e8',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 18,
            },
            label: {
              text: String(count),
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '700',
            },
            zIndex: Number(window.google.maps.Marker.MAX_ZINDEX) + count,
          }),
      },
    }
  }, [isLoaded])

  const handleSearch = (e) => {
    e.preventDefault()
    const q = searchText.trim()
    if (!q || !window.google?.maps?.Geocoder) return
    setSearching(true)
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: q }, (results, status) => {
      setSearching(false)
      if (status !== 'OK' || !results?.[0]?.geometry?.location) return
      const loc = results[0].geometry.location
      const point = { lat: loc.lat(), lng: loc.lng() }
      if (map) {
        map.panTo(point)
        map.setZoom(15)
      }
      setUserLocation(point)
    })
  }

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
        onLoad={(instance) => setMap(instance)}
        options={{
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        }}
      >
        <MarkerClustererF options={clusterOptions}>
          {(clusterer) =>
            filtered.map((toilet) => (
              <Marker
                key={toilet.id}
                clusterer={clusterer}
                position={{ lat: toilet.lat, lng: toilet.lng }}
                onClick={() => setSelected(toilet)}
                icon={{
                  url: createMarkerIcon(getMarkerColor(toilet.average_rating)),
                  scaledSize: new window.google.maps.Size(42, 42),
                  anchor: new window.google.maps.Point(21, 21),
                }}
              />
            ))
          }
        </MarkerClustererF>

      </GoogleMap>

      {selected && (
        <ToiletDetail
          key={selected.id}
          toilet={selected}
          user={user}
          onClose={() => setSelected(null)}
        />
      )}

      <UrgentMode toilets={toilets} user={user} />

      <button type="button" className={styles.locateBtn} onClick={locateMe} title="Locate me">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06z" />
        </svg>
      </button>

      <div className={styles.floatingBar}>
        <form className={styles.searchCard} onSubmit={handleSearch}>
          <SearchIcon />
          <input
            className={styles.searchInput}
            type="search"
            enterKeyHint="search"
            placeholder="Search an address or place"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            aria-label="Search an address or place"
          />
          <button type="submit" className={styles.searchGo} disabled={searching}>
            {searching ? '…' : 'Go'}
          </button>
        </form>
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
          <button
            type="button"
            className={`${styles.chip} ${openNowOnly ? styles.chipActive : ''}`}
            onClick={() => setOpenNowOnly((v) => !v)}
          >
            Open now
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
