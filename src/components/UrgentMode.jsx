import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import { USER_POINTS_CHANGED_EVENT } from '../lib/pointsEvents'
import styles from './UrgentMode.module.css'

const URGENT_STRICT_RADIUS_METERS = 500

function parseOpeningHours(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isOpenNow(toilet) {
  const opening = parseOpeningHours(toilet.opening_hours)
  if (!opening) return false
  if (opening.mode === '24_7') return true
  if (opening.mode !== 'scheduled' || !opening.days) return false
  const now = new Date()
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()]
  const slot = opening.days[weekday]
  if (!slot?.open || !slot?.close) return false
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return current >= slot.open && current <= slot.close
}

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

function UrgentMode({ toilets, user, bypassProGate = false }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isPro, setIsPro] = useState(false)
  const [finding, setFinding] = useState(false)
  const [overlay, setOverlay] = useState('')

  const fetchIsPro = useCallback(async () => {
    console.log('[UrgentMode] Re-fetching is_pro from Supabase')
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    console.log('[UrgentMode] auth.getUser()', { userId: authData?.user?.id, authErr })
    if (!authData?.user?.id) {
      setIsPro(false)
      return
    }
    const { data, error } = await supabase
      .from('user_points')
      .select('is_pro')
      .eq('user_id', authData.user.id)
      .maybeSingle()
    console.log('[UrgentMode] user_points.is_pro', { data, error })
    setIsPro(Boolean(data?.is_pro))
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setIsPro(false)
      return
    }
    fetchIsPro()
  }, [user?.id, fetchIsPro])

  useEffect(() => {
    const onPointsChanged = () => {
      console.log('[UrgentMode] USER_POINTS_CHANGED — re-fetching is_pro')
      fetchIsPro()
    }
    window.addEventListener(USER_POINTS_CHANGED_EVENT, onPointsChanged)
    return () => window.removeEventListener(USER_POINTS_CHANGED_EVENT, onPointsChanged)
  }, [fetchIsPro])

  const openCandidates = useMemo(
    () => (toilets || []).filter((t) => t.lat != null && t.lng != null && isOpenNow(t)),
    [toilets],
  )
  const canUseUrgent = Boolean(isPro || bypassProGate)

  const onUrgent = () => {
    if (!canUseUrgent) {
      showToast('Urgent Mode is a Pro feature', 'info')
      navigate('/upgrade')
      return
    }
    if (!navigator.geolocation) {
      showToast('Geolocation is not available on this device.', 'error')
      return
    }
    setFinding(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        const ranked = openCandidates
          .map((toilet) => ({
            toilet,
            distance: haversineMeters(latitude, longitude, toilet.lat, toilet.lng),
          }))
          .sort((a, b) => a.distance - b.distance)
        const strictNearby = ranked.find(
          ({ toilet, distance }) =>
            toilet.is_free && Number(toilet.average_rating) >= 4 && distance <= URGENT_STRICT_RADIUS_METERS,
        )
        const best = strictNearby || ranked[0] || null
        setFinding(false)
        if (!best) {
          showToast('No open toilets nearby right now.', 'info')
          return
        }
        if (!strictNearby) {
          showToast(
            'Best available option nearby - no highly rated free toilets found within range',
            'info',
          )
        }
        const rounded = Math.round(best.distance)
        setOverlay(
          `Nearest WC found 📍 ${best.toilet.name || 'Unnamed WC'} - ${rounded}m away. Directions opening now. Good luck. 🙏`,
        )
        window.setTimeout(() => setOverlay(''), 3200)
        window.open(
          `https://www.google.com/maps/dir/?api=1&destination=${best.toilet.lat},${best.toilet.lng}`,
          '_blank',
          'noopener,noreferrer',
        )
      },
      () => {
        setFinding(false)
        showToast('Could not get your location right now.', 'error')
      },
    )
  }

  return (
    <>
      {overlay && <div className={styles.overlay}>{overlay}</div>}
      {canUseUrgent && (
        <button type="button" className={styles.button} onClick={onUrgent} disabled={finding}>
          {finding ? 'Finding nearest WC…' : '🚨 I need to go NOW'}
        </button>
      )}
    </>
  )
}

export default UrgentMode
