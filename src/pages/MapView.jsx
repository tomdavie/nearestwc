import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GoogleMap, useJsApiLoader, Marker, MarkerClustererF } from '@react-google-maps/api'
import { supabase } from '../supabaseClient'
import ToiletDetail from '../components/ToiletDetail'
import UrgentMode from '../components/UrgentMode'
import styles from './MapView.module.css'

const defaultCenter = { lat: 51.505, lng: -0.09 }
const VIEWPORT_LIMIT = 3000

function haversineMeters(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function getMarkerIcon(avgRating) {
  const color =
    avgRating >= 4 ? '#22c55e' : avgRating >= 3 ? '#f59e0b' : avgRating > 0 ? '#ef4444' : '#9ca3af'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="20" y="25" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="Arial, sans-serif">WC</text>
    </svg>
  `
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(40, 40),
    anchor: new window.google.maps.Point(20, 20),
  }
}

function getSponsoredMarkerIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48">
      <path d="M18 0 C8.06 0 0 8.06 0 18 C0 31.5 18 48 18 48 C18 48 36 31.5 36 18 C36 8.06 27.94 0 18 0 Z" fill="#F59E0B" stroke="white" stroke-width="2"/>
      <text x="18" y="22" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial, sans-serif">WC</text>
    </svg>
  `
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(36, 48),
    anchor: new window.google.maps.Point(18, 48)
  }
}

function getIbdHighlightedIcon(isSponsored) {
  const fill = isSponsored ? '#F59E0B' : '#d93025'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r="23" fill="${fill}" stroke="white" stroke-width="2.5" />
      <circle cx="26" cy="26" r="24.5" fill="none" stroke="#d93025" stroke-width="2.5" opacity="0.95">
        <animate attributeName="r" values="23;25.5;23" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.95;0.3;0.95" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <text x="26" y="31" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="Arial, sans-serif">WC</text>
    </svg>
  `
  return {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
    scaledSize: new window.google.maps.Size(52, 52),
    anchor: new window.google.maps.Point(26, 26),
  }
}
/** Single solid blue disk for MarkerClustererPlus — text is drawn by the clusterer, not baked into the image. */
function createClusterBackgroundIconUrl() {
  const size = 48
  const r = 20
  const cx = size / 2
  const cy = size / 2
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a73e8"/>
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
  const [sponsoredListings, setSponsoredListings] = useState([])
  const [user, setUser] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [map, setMap] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [accessibleOnly, setAccessibleOnly] = useState(false)
  const [openNowOnly, setOpenNowOnly] = useState(false)
  const [ibdMode, setIbdMode] = useState(false)
  const [savingIbdMode, setSavingIbdMode] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loadingToilets, setLoadingToilets] = useState(false)
  const refreshTimerRef = useRef(null)
  const requestSeqRef = useRef(0)

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
    const fetchSponsoredListings = async () => {
      const { data, error } = await supabase
        .from('sponsored_listings')
        .select('*')
        .eq('active', true)
      if (error) {
        console.error('[MapView] sponsored_listings fetch error', error)
        return
      }
      console.log('sponsored listings:', data || [])
      setSponsoredListings(data || [])
    }
    fetchSponsoredListings()
  }, [])

  const fetchToiletsForBounds = useCallback(async (bounds) => {
    if (!bounds) return
    const requestId = ++requestSeqRef.current
    setLoadingToilets(true)

    const { south, west, north, east } = bounds
    let toiletsQuery = supabase
      .from('toilets')
      .select('*')
      .gte('lat', south)
      .lte('lat', north)
      .order('created_at', { ascending: false })
      .limit(VIEWPORT_LIMIT)

    // Handle anti-meridian crossing if needed.
    if (west <= east) {
      toiletsQuery = toiletsQuery.gte('lng', west).lte('lng', east)
    } else {
      toiletsQuery = toiletsQuery.or(`lng.gte.${west},lng.lte.${east}`)
    }

    const { data: toiletsData, error: toiletsError } = await toiletsQuery
    if (requestId !== requestSeqRef.current) return

    if (toiletsError) {
      console.error('[MapView] toilets fetch error', toiletsError)
      setLoadingToilets(false)
      return
    }

    const hasGlasgowToilet = (toiletsData || []).some(
      (toilet) =>
        Math.abs(Number(toilet?.lat) - 55.8642) < 0.0002 &&
        Math.abs(Number(toilet?.lng) - -4.2518) < 0.0002,
    )
    console.log(
      '[MapView] fetched toilets in current bounds:',
      (toiletsData || []).length,
      'includes 55.8642,-4.2518:',
      hasGlasgowToilet,
    )

    const ids = (toiletsData || []).map((t) => t.id).filter(Boolean)
    let reviewsData = []
    if (ids.length > 0) {
      const { data, error: reviewsError } = await supabase
        .from('reviews')
        .select('toilet_id, overall_rating, rating')
        .in('toilet_id', ids)

      if (requestId !== requestSeqRef.current) return
      if (reviewsError) {
        console.error('[MapView] reviews fetch error', reviewsError)
      } else {
        reviewsData = data || []
      }
    }

    const averages = {}
    for (const review of reviewsData) {
      const score = Number(review.overall_rating ?? review.rating)
      if (!review.toilet_id || !score) continue
      const current = averages[review.toilet_id] || { total: 0, count: 0 }
      current.total += score
      current.count += 1
      averages[review.toilet_id] = current
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
    setLoadingToilets(false)
  }, [])

  const getCurrentBounds = useCallback(() => {
    if (!map) return null
    const mapBounds = map.getBounds()
    if (!mapBounds) return null
    const northEast = mapBounds.getNorthEast()
    const southWest = mapBounds.getSouthWest()
    return {
      south: southWest.lat(),
      west: southWest.lng(),
      north: northEast.lat(),
      east: northEast.lng(),
    }
  }, [map])

  const scheduleViewportRefresh = useCallback(() => {
    if (!map) return
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = window.setTimeout(() => {
      const bounds = getCurrentBounds()
      if (bounds) fetchToiletsForBounds(bounds)
    }, 220)
  }, [fetchToiletsForBounds, getCurrentBounds, map])

  useEffect(() => {
    if (!map) return
    scheduleViewportRefresh()
  }, [map, scheduleViewportRefresh])

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current)
    }
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

  useEffect(() => {
    if (!user?.id) {
      setIbdMode(false)
      return
    }
    let active = true
    ;(async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('ibd_mode')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        console.error('[MapView] ibd_mode fetch error', error)
        return
      }
      setIbdMode(Boolean(data?.ibd_mode))
    })()
    return () => {
      active = false
    }
  }, [user?.id])

  const persistIbdMode = useCallback(
    async (nextValue) => {
      if (!user?.id) return
      setSavingIbdMode(true)
      const { data: existing, error: existingError } = await supabase
        .from('user_points')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (existingError) {
        console.error('[MapView] ibd_mode lookup error', existingError)
        setSavingIbdMode(false)
        return
      }
      if (existing) {
        const { error } = await supabase
          .from('user_points')
          .update({ ibd_mode: nextValue })
          .eq('user_id', user.id)
        if (error) console.error('[MapView] ibd_mode update error', error)
      } else {
        const { error } = await supabase.from('user_points').insert({
          user_id: user.id,
          points: 0,
          level: 'desperate_dan',
          badges: [],
          ibd_mode: nextValue,
        })
        if (error) console.error('[MapView] ibd_mode insert error', error)
      }
      setSavingIbdMode(false)
    },
    [user?.id],
  )

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

    const filteredRows = toilets.filter((t) => {
      if (freeOnly && !t.is_free) return false
      if (accessibleOnly && !t.is_accessible) return false
      if (!isOpenNow(t)) return false
      if (ibdMode) {
        if (!t.is_free) return false
        if (!t.is_accessible) return false
        if (Number(t.average_rating) < 3) return false
      }
      return true
    })

    if (!ibdMode || !userLocation) return filteredRows

    return [...filteredRows].sort((a, b) => {
      const distanceA = haversineMeters(userLocation.lat, userLocation.lng, Number(a.lat), Number(a.lng))
      const distanceB = haversineMeters(userLocation.lat, userLocation.lng, Number(b.lat), Number(b.lng))
      return distanceA - distanceB
    })
  }, [toilets, freeOnly, accessibleOnly, openNowOnly, ibdMode, userLocation])

  const closestToiletId = useMemo(() => {
    if (!ibdMode || !filtered.length || !userLocation) return null
    return filtered[0]?.id ?? null
  }, [filtered, ibdMode, userLocation])

  const isToiletSponsored = useCallback(
    (toilet) => sponsoredListings.some((s) => s.toilet_id === toilet.id),
    [sponsoredListings],
  )

  const handleMarkerClick = useCallback(
    (toilet, listingOverride = null) => {
      try {
        if (!toilet || !toilet.id) return
        const matchedListing =
          listingOverride ??
          sponsoredListings?.find((s) => s?.toilet_id === toilet?.id) ??
          null

        setSelected({
          toilet,
          isSponsored: Boolean(matchedListing),
          sponsoredListing: matchedListing,
        })
      } catch (error) {
        console.error('[MapView] marker click handler failed', error, toilet)
      }
    },
    [sponsoredListings],
  )

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

  /**
   * @react-google-maps/marker-clusterer uses `styles` + `calculator` (not `options.renderer`).
   * Default m1/m2 PNGs look like “sonar” rings — we use one flat SVG + white count text.
   */
  const clusterStyles = useMemo(() => {
    const url = createClusterBackgroundIconUrl()
    const w = 48
    const h = 48
    return [
      {
        url,
        width: w,
        height: h,
        textColor: '#ffffff',
        textSize: 14,
        fontWeight: 'bold',
        fontFamily: 'Arial,sans-serif',
        anchorText: [0, 0],
      },
    ]
  }, [])

  const clusterCalculator = useCallback(
    (markers, _numStyles) => ({
      text: String(markers.length),
      index: 1,
      title: '',
    }),
    [],
  )

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
        onIdle={scheduleViewportRefresh}
        options={{
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: false,
        }}
      >
        <MarkerClustererF
          clusterClass="nwcMapCluster"
          enableRetinaIcons
          styles={clusterStyles}
          calculator={clusterCalculator}
        >
          {(clusterer) =>
            filtered.map((toilet) => (
              (() => {
                const sponsoredListing =
                  sponsoredListings?.find((s) => s?.toilet_id === toilet?.id) ?? null
                const isSponsored = isToiletSponsored(toilet)
                const isClosestIbd = Boolean(ibdMode && closestToiletId && toilet.id === closestToiletId)
                console.log('rendering marker for toilet:', toilet.id, 'is sponsored:', isSponsored)
                return (
                  <Marker
                    key={toilet.id}
                    clusterer={clusterer}
                    position={{ lat: toilet.lat, lng: toilet.lng }}
                    onClick={() => handleMarkerClick(toilet, sponsoredListing)}
                    options={{ optimized: false }}
                    icon={
                      isClosestIbd
                        ? getIbdHighlightedIcon(isSponsored)
                        : isSponsored
                          ? getSponsoredMarkerIcon()
                          : getMarkerIcon(toilet.average_rating)
                    }
                  />
                )
              })()
            ))
          }
        </MarkerClustererF>

      </GoogleMap>

      {selected?.toilet?.id && (
        <ToiletDetail
          key={selected.toilet.id}
          toilet={selected.toilet}
          user={user}
          isSponsored={Boolean(selected.isSponsored)}
          sponsoredListing={selected.sponsoredListing ?? null}
          onClose={() => setSelected(null)}
        />
      )}

      <UrgentMode toilets={toilets} user={user} bypassProGate={ibdMode} />

      {ibdMode && <div className={styles.ibdBanner}>🏥 IBD Mode active - showing nearest clean, free toilets</div>}

      <button type="button" className={styles.locateBtn} onClick={locateMe} title="Locate me">
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
          <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06z" />
        </svg>
      </button>
      <button
        type="button"
        className={`${styles.ibdQuickBtn} ${ibdMode ? styles.ibdQuickBtnActive : ''}`}
        title={ibdMode ? 'Turn IBD mode off' : 'Turn IBD mode on'}
        onClick={() => {
          if (!user?.id) return
          const next = !ibdMode
          setIbdMode(next)
          persistIbdMode(next)
        }}
        disabled={!user?.id || savingIbdMode}
      >
        🏥
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
        {loadingToilets && <p className={styles.loadingInline}>Loading toilets in this area…</p>}
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
