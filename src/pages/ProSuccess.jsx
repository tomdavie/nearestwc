import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import styles from './ProSuccess.module.css'

function ProSuccess() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [updating, setUpdating] = useState(true)

  useEffect(() => {
    let mounted = true

    const markPro = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!user) {
        if (mounted) navigate('/login')
        return
      }

      const { data: existing } = await supabase
        .from('user_points')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) {
        await supabase.from('user_points').update({ is_pro: true }).eq('user_id', user.id)
      } else {
        await supabase
          .from('user_points')
          .insert({ user_id: user.id, points: 0, level: 'desperate_dan', badges: [], is_pro: true })
      }

      if (mounted) setUpdating(false)
    }

    markPro().catch(() => {
      showToast('Payment worked, but profile sync needs a retry.', 'error')
      setUpdating(false)
    })

    const timer = window.setTimeout(() => navigate('/'), 4000)
    return () => {
      mounted = false
      window.clearTimeout(timer)
    }
  }, [navigate, showToast])

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>You&apos;re now a NearestWC Pro. 🚽👑</h1>
        <p className={styles.sub}>Your bowels will thank you.</p>
        <ul className={styles.list}>
          <li>Urgent Mode for immediate directions to the best nearby option.</li>
          <li>Safe Route Planner with toilets mapped along your journey.</li>
          <li>Saved favourites and condition-aware recommendations.</li>
        </ul>
        <p className={styles.meta}>{updating ? 'Syncing Pro status…' : 'All set. Heading back to the map…'}</p>
      </div>
    </div>
  )
}

export default ProSuccess
