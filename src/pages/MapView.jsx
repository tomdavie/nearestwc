import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api'
import { supabase } from '../supabaseClient'
import styles from './MapView.module.css'

const defaultCenter = { lat: 51.505, lng: -0.09 }

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
      const { data, error } = await supabase.from('toilets').select('*')
      if (!error) setToilets(data)
    }
    fetchToilets()
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
          />
        ))}

        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
          >
            <div>
              <h3 className={styles.infoTitle}>{selected.name}</h3>
              <p className={styles.infoRow}>{selected.is_free ? 'Free to use' : 'Paid access'}</p>
              {selected.is_accessible && (
                <p className={styles.infoRow}>Wheelchair accessible</p>
              )}
              {selected.requires_key && (
                <p className={styles.infoRow}>Key or code required</p>
              )}
              {selected.gender_neutral && (
                <p className={styles.infoRow}>All-gender</p>
              )}
              {selected.baby_changing && (
                <p className={styles.infoRow}>Baby changing</p>
              )}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

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
