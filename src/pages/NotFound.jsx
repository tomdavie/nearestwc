import { Link } from 'react-router-dom'
import styles from './NotFound.module.css'

function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1>404</h1>
        <p>
          Uh oh. We couldn&apos;t find that page. Unlike our toilets, this one really doesn&apos;t
          exist. 🚽
        </p>
        <Link to="/" className={styles.btn}>
          Back to map
        </Link>
      </div>
    </div>
  )
}

export default NotFound
