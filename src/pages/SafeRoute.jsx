import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Autocomplete,
  DirectionsRenderer,
  GoogleMap,
  Marker,
  useJsApiLoader,
} from '@react-google-maps/api'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import BackButton from '../components/BackButton'
import styles from './SafeRoute.module.css'

const mapContainerStyle = { width: '100%', height: '320px' }
const defaultCenter = { lat: 51.505, lng: -0.09 }

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

function SafeRoute() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [loadingPro, setLoadingPro] = useState(true)
  const [startInput, setStartInput] = useState('')
  const [destinationInput, setDestinationInput] = useState('')
  const [startPlace, setStartPlace] = useState(null)
  const [destinationPlace, setDestinationPlace] = useState(null)
  const [startAuto, setStartAuto] = useState(null)
  const [destinationAuto, setDestinationAuto] = useState(null)
  const [routing, setRouting] = useState(false)
  const [directions, setDirections] = useState(null)
  const [routeToilets, setRouteToilets] = useState([])

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_KEY,
    libraries: ['places'],
  })

  useEffect(() => {
    let active = true
    const check = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        navigate('/login')
        return
      }
      const { data: pointsRow } = await supabase
        .from('user_points')
        .select('is_pro')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!pointsRow?.is_pro) {
        showToast('Safe Route Planning is a Pro feature', 'info')
        navigate('/upgrade')
        return
      }
      if (active) setLoadingPro(false)
    }
    check()
    return () => {
      active = false
    }
  }, [navigate, showToast])

  const center = useMemo(() => {
    if (startPlace) return startPlace
    if (destinationPlace) return destinationPlace
    return defaultCenter
  }, [startPlace, destinationPlace])

  const placeToLatLng = (place) => {
    const loc = place?.geometry?.location
    if (!loc) return null
    return { lat: loc.lat(), lng: loc.lng() }
  }

  const computeRoute = async (e) => {
    e.preventDefault()
    if (!window.google?.maps) return
    const origin = startPlace
    const destination = destinationPlace
    if (!origin || !destination) {
      showToast('Choose both a start and destination from suggestions.', 'info')
      return
    }

    setRouting(true)
    const service = new window.google.maps.DirectionsService()
    service.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.WALKING,
      },
      async (result, status) => {
        if (status !== 'OK' || !result) {
          setRouting(false)
          showToast('Could not find a route. Try slightly different points.', 'error')
          return
        }
        setDirections(result)

        const [{ data: toiletsData }, { data: reviewsData }] = await Promise.all([
          supabase.from('toilets').select('id, name, lat, lng, is_free'),
          supabase.from('reviews').select('toilet_id, overall_rating, rating'),
        ])

        const averages = {}
        for (const review of reviewsData || []) {
          const score = Number(review.overall_rating ?? review.rating)
          if (!review.toilet_id || !score) continue
          const current = averages[review.toilet_id] || { total: 0, count: 0 }
          current.total += score
          current.count += 1
          averages[review.toilet_id] = current
        }

        const path = result.routes?.[0]?.overview_path || []
        const alongRoute = (toiletsData || [])
          .filter((t) => t.lat != null && t.lng != null)
          .map((toilet) => {
            let nearest = Infinity
            for (const point of path) {
              const d = haversineMeters(toilet.lat, toilet.lng, point.lat(), point.lng())
              if (d < nearest) nearest = d
            }
            const avg = averages[toilet.id]
            return {
              ...toilet,
              distanceFromRoute: nearest,
              average_rating: avg ? avg.total / avg.count : null,
            }
          })
          .filter((t) => t.distanceFromRoute <= 200)
          .sort((a, b) => a.distanceFromRoute - b.distanceFromRoute)

        setRouteToilets(alongRoute)
        setRouting(false)
      },
    )
  }

  if (loadingPro || !isLoaded) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>Loading route planner…</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <h1 className={styles.title}>Plan a safe route 🗺️</h1>
      <p className={styles.sub}>Map toilets along your journey before you leave the house.</p>

      <form className={styles.form} onSubmit={computeRoute}>
        <Autocomplete onLoad={setStartAuto} onPlaceChanged={() => setStartPlace(placeToLatLng(startAuto?.getPlace()))}>
          <input
            className={styles.input}
            placeholder="Starting point"
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
          />
        </Autocomplete>
        <Autocomplete
          onLoad={setDestinationAuto}
          onPlaceChanged={() => setDestinationPlace(placeToLatLng(destinationAuto?.getPlace()))}
        >
          <input
            className={styles.input}
            placeholder="Destination"
            value={destinationInput}
            onChange={(e) => setDestinationInput(e.target.value)}
          />
        </Autocomplete>
        <button type="submit" className={styles.submit} disabled={routing}>
          {routing ? 'Finding route…' : 'Find toilets on route'}
        </button>
      </form>

      <div className={styles.mapWrap}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={13}
          options={{ fullscreenControl: false, mapTypeControl: false, streetViewControl: false }}
        >
          {directions && <DirectionsRenderer directions={directions} />}
          {routeToilets.map((toilet) => (
            <Marker key={toilet.id} position={{ lat: toilet.lat, lng: toilet.lng }} />
          ))}
        </GoogleMap>
      </div>

      <ul className={styles.list}>
        {routeToilets.map((toilet) => (
          <li key={toilet.id} className={styles.item}>
            <p className={styles.name}>{toilet.name || 'Unnamed WC'}</p>
            <p className={styles.meta}>
              {Math.round(toilet.distanceFromRoute)}m from route ·{' '}
              {toilet.average_rating ? `${toilet.average_rating.toFixed(1)}/5` : 'No rating yet'}
            </p>
            <button
              type="button"
              className={styles.dirBtn}
              onClick={() =>
                window.open(
                  `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}`,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
            >
              Directions
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default SafeRoute
