import { useEffect, useState } from 'react'
import styles from './Onboarding.module.css'

const STORAGE_KEY = 'nwc_onboarded'

function Onboarding() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) setVisible(true)
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <p className={styles.emoji}>🚻</p>
        <h2 className={styles.heading}>When nature calls... answer it.</h2>
        <p className={styles.subheading}>
          NearestWC is the community-powered map of the world&apos;s toilets. Find them, rate them,
          and help fellow humans in their hour of need.
        </p>
        <ul className={styles.bullets}>
          <li>📍 Find the nearest WC in seconds</li>
          <li>⭐ Rate and review like a true connoisseur</li>
          <li>🏅 Earn points and badges for your contributions to civilisation</li>
        </ul>
        <button type="button" className={styles.cta} onClick={dismiss}>
          Find me a loo 🚽
        </button>
      </div>
    </div>
  )
}

export default Onboarding
