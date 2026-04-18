import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import styles from './UrgentMode.module.css'

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

function UrgentMode({ toilets, user }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [isPro, setIsPro] = useState(false)
  const [finding, setFinding] = useState(false)
  const [overlay, setOverlay] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!user?.id) {
        setIsPro(false)
        return
      }
      const { data } = await supabase
        .from('user_points')
        .select('is_pro')
        .eq('user_id', user.id)
        .maybeSingle()
      if (active) setIsPro(Boolean(data?.is_pro))
    }
    load()
    return () => {
      active = false
    }
  }, [user?.id])

  const candidates = useMemo(
    () =>
      (toilets || []).filter(
        (t) => t.is_free && Number(t.average_rating) >= 4 && t.lat != null && t.lng != null && isOpenNow(t),
      ),
    [toilets],
  )

  const onUrgent = () => {
    if (!isPro) {
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
        let best = null
        for (const toilet of candidates) {
          const d = haversineMeters(latitude, longitude, toilet.lat, toilet.lng)
          if (!best || d < best.distance) best = { toilet, distance: d }
        }
        setFinding(false)
        if (!best) {
          showToast('No open, free, highly rated WC nearby right now.', 'info')
          return
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
      <button type="button" className={styles.button} onClick={onUrgent} disabled={finding}>
        {finding ? 'Finding nearest WC…' : '🚨 I need to go NOW'}
      </button>
    </>
  )
}

export default UrgentMode
