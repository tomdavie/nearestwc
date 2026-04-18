import { Link } from 'react-router-dom'
import styles from './Footer.module.css'

function Footer() {
  return (
    <footer className={styles.footer}>
      <span>© 2026 NearestWC</span>
      <nav className={styles.links} aria-label="Legal links">
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms</Link>
      </nav>
    </footer>
  )
}

export default Footer
