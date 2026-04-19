import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import { notifyUserPointsChanged } from '../lib/pointsEvents'
import styles from './ProSuccess.module.css'

function ProSuccess() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let mounted = true

    const markPro = async () => {
      console.log('[ProSuccess] Step 1: starting Pro activation flow')

      const { data: authData, error: authError } = await supabase.auth.getUser()
      console.log('[ProSuccess] Step 2: supabase.auth.getUser()', {
        userId: authData?.user?.id,
        authError,
      })

      if (!mounted) return

      if (authError || !authData?.user) {
        console.log('[ProSuccess] Step 3: no logged-in user, redirecting to login')
        navigate('/login')
        return
      }

      const userId = authData.user.id
      const proExpiresAt = new Date()
      proExpiresAt.setDate(proExpiresAt.getDate() + 30)
      const proExpiresIso = proExpiresAt.toISOString()
      console.log('[ProSuccess] Step 4: computed pro_expires_at (30 days)', proExpiresIso)

      const { data: existing, error: selectError } = await supabase
        .from('user_points')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()

      console.log('[ProSuccess] Step 5: check existing user_points row', { existing, selectError })

      if (selectError) {
        console.error('[ProSuccess] Step 5b: select failed', selectError)
        if (mounted) {
          setStatus('error')
          showToast(selectError.message || 'Could not read your profile.', 'error')
        }
        return
      }

      if (existing) {
        console.log('[ProSuccess] Step 6a: updating existing row — is_pro true, pro_expires_at set')
        const { data: updated, error: updateError } = await supabase
          .from('user_points')
          .update({ is_pro: true, pro_expires_at: proExpiresIso })
          .eq('user_id', userId)
          .select('user_id, is_pro, pro_expires_at')
          .maybeSingle()

        console.log('[ProSuccess] Step 7a: update result', { updated, updateError })

        if (updateError) {
          console.error('[ProSuccess] Step 7a failed', updateError)
          if (mounted) {
            setStatus('error')
            showToast(updateError.message || 'Could not activate Pro on your account.', 'error')
          }
          return
        }
      } else {
        console.log('[ProSuccess] Step 6b: inserting new user_points row')
        const { data: inserted, error: insertError } = await supabase
          .from('user_points')
          .insert({
            user_id: userId,
            points: 0,
            level: 'desperate_dan',
            badges: [],
            is_pro: true,
            pro_expires_at: proExpiresIso,
          })
          .select('user_id, is_pro, pro_expires_at')
          .maybeSingle()

        console.log('[ProSuccess] Step 7b: insert result', { inserted, insertError })

        if (insertError) {
          console.error('[ProSuccess] Step 7b failed', insertError)
          if (mounted) {
            setStatus('error')
            showToast(insertError.message || 'Could not create your Pro profile.', 'error')
          }
          return
        }
      }

      console.log('[ProSuccess] Step 8: Pro status saved — notifying app and showing success')
      notifyUserPointsChanged()

      if (mounted) setStatus('success')
    }

    markPro().catch((err) => {
      console.error('[ProSuccess] Unexpected error in markPro', err)
      if (mounted) {
        setStatus('error')
        showToast(err?.message || 'Something went wrong activating Pro.', 'error')
      }
    })

    return () => {
      mounted = false
    }
  }, [navigate, showToast])

  useEffect(() => {
    if (status !== 'success') return undefined
    console.log('[ProSuccess] Step 9: success UI shown — redirect to map in 4s')
    const timer = window.setTimeout(() => {
      navigate('/')
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [status, navigate])

  if (status === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Activating your Pro account…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>Couldn&apos;t activate Pro yet</h1>
          <p className={styles.sub}>Check the browser console for [ProSuccess] logs, then try again from Profile.</p>
          <p className={styles.meta}>
            <button type="button" className={styles.retryBtn} onClick={() => navigate('/profile')}>
              Back to profile
            </button>
          </p>
        </div>
      </div>
    )
  }

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
        <p className={styles.meta}>All set. Heading back to the map…</p>
      </div>
    </div>
  )
}

export default ProSuccess
