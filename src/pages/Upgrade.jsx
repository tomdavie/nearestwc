import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import { startProCheckout } from '../utils/stripe'
import BackButton from '../components/BackButton'
import styles from './Upgrade.module.css'

const FEATURES = [
  '🚨 Urgent Mode - one tap to the nearest open, free, highly rated WC. No browsing. Just go.',
  '🗺️ Safe Route Planning - map WCs along your journey before you leave the house',
  '⭐ Saved Favourites - bookmark your trusted WCs for instant access',
  '🏥 Condition Profile - tell us about your needs and get tailored results',
  '🔑 RADAR Key Indicator - see which WCs accept the National Key Scheme',
]

function Upgrade() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const goPro = async () => {
    setLoading(true)
    const { data } = await supabase.auth.getUser()
    const user = data.user
    if (!user) {
      setLoading(false)
      showToast('Login first, then we can unlock Pro mode.', 'info')
      navigate('/login')
      return
    }
    try {
      await startProCheckout(user.id)
    } catch (err) {
      showToast(err?.message || 'Could not start checkout right now.', 'error')
      setLoading(false)
    }
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <section className={styles.card}>
        <p className={styles.kicker}>NearestWC Pro</p>
        <h1 className={styles.title}>Never be caught short again.</h1>
        <p className={styles.sub}>For the price of a coffee, stay one step ahead of chaos.</p>

        <p className={styles.price}>£1.99/month</p>

        <ul className={styles.list}>
          {FEATURES.map((feature) => (
            <li key={feature} className={styles.item}>
              {feature}
            </li>
          ))}
        </ul>

        <button type="button" className={styles.cta} onClick={goPro} disabled={loading}>
          {loading ? 'Launching checkout…' : 'Go Pro 🚽'}
        </button>

        <Link to="/profile" className={styles.later}>
          Maybe later
        </Link>
      </section>
    </div>
  )
}

export default Upgrade
