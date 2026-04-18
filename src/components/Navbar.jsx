import { Link } from 'react-router-dom'
import styles from './Navbar.module.css'

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 0c4.42 0 8 1.79 8 4v1H4v-1c0-2.21 3.58-4 8-4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Navbar() {
  return (
    <header className={styles.nav}>
      <Link to="/" className={styles.brand}>
        <span className={styles.mark} aria-hidden>
          W
        </span>
        <span>NearestWC</span>
      </Link>
      <div className={styles.actions}>
        <Link to="/add" className={styles.iconLink} title="Add a WC">
          <IconPlus />
          <span className={styles.srOnly}>Add WC</span>
        </Link>
        <Link to="/login" className={styles.iconLink} title="Account">
          <IconUser />
          <span className={styles.srOnly}>Login</span>
        </Link>
      </div>
    </header>
  )
}

export default Navbar
