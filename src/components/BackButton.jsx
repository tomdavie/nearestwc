import { useNavigate } from 'react-router-dom'
import styles from './BackButton.module.css'

function BackButton() {
  const navigate = useNavigate()

  return (
    <button type="button" className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Go back">
      ← Back
    </button>
  )
}

export default BackButton
