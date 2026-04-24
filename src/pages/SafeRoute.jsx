import BackButton from '../components/BackButton'
import styles from './SafeRoute.module.css'

function SafeRoute() {
  return (
    <div className={styles.page}>
      <BackButton />
      <h1 className={styles.title}>Safe Route Planning 🗺️</h1>
      <p className={styles.sub}>Coming soon.</p>
    </div>
  )
}

export default SafeRoute
