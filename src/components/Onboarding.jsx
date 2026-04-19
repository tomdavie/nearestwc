import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const STORAGE_KEY = 'nwc_onboarded'

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background:
      'linear-gradient(180deg, #0f4fb1 0%, #145fcf 45%, #1a73e8 100%)',
  },
  card: {
    width: 'min(100%, 560px)',
    borderRadius: '24px',
    padding: '28px 22px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 20px 44px rgba(0, 0, 0, 0.22)',
    backdropFilter: 'blur(6px)',
    color: '#fff',
    textAlign: 'center',
  },
  emojiWrap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '12px',
  },
  emoji: {
    fontSize: '62px',
    lineHeight: 1,
    animation: 'nwc-bounce 2.4s ease-in-out infinite',
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(32px, 6vw, 44px)',
    lineHeight: 1.06,
    letterSpacing: '-0.02em',
    color: '#fff',
    fontWeight: 750,
  },
  subheading: {
    margin: '12px auto 18px',
    maxWidth: '48ch',
    fontSize: '16px',
    lineHeight: 1.55,
    color: 'rgba(255, 255, 255, 0.86)',
  },
  featureList: {
    listStyle: 'none',
    margin: '0 0 20px',
    padding: 0,
    display: 'grid',
    gap: '10px',
    textAlign: 'left',
  },
  featureRow: {
    display: 'grid',
    gridTemplateColumns: '34px 1fr',
    alignItems: 'start',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: '14px',
    background: 'rgba(255, 255, 255, 0.11)',
  },
  featureEmoji: {
    fontSize: '24px',
    lineHeight: 1,
    marginTop: '2px',
  },
  featureTitle: {
    margin: 0,
    fontSize: '15px',
    lineHeight: 1.3,
    fontWeight: 700,
    color: '#fff',
  },
  featureDescription: {
    margin: '4px 0 0',
    fontSize: '13px',
    lineHeight: 1.45,
    color: 'rgba(255, 255, 255, 0.82)',
  },
  cta: {
    width: '100%',
    border: 'none',
    borderRadius: '14px',
    padding: '14px 16px',
    fontSize: '17px',
    fontWeight: 700,
    color: '#1a73e8',
    background: '#fff',
    cursor: 'pointer',
  },
  loginHint: {
    marginTop: '12px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  loginLink: {
    color: '#fff',
    fontWeight: 650,
    textDecoration: 'underline',
  },
}

const features = [
  {
    emoji: '📍',
    title: 'Find nearby toilets fast',
    description: 'Open the map and get the nearest options when urgency strikes.',
  },
  {
    emoji: '⭐',
    title: 'Rate and review each stop',
    description: 'Share cleanliness, accessibility and tips to help the next person.',
  },
  {
    emoji: '🤝',
    title: 'Help the whole community',
    description: 'Add missing WCs so nobody is left searching in a critical moment.',
  },
]

function Onboarding() {
  const [visible, setVisible] = useState(false)
  const [ctaHovered, setCtaHovered] = useState(false)
  const [ctaPressed, setCtaPressed] = useState(false)

  useEffect(() => {
    const seen = window.localStorage.getItem(STORAGE_KEY)
    if (!seen) setVisible(true)
  }, [])

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  if (!visible) return null

  const ctaStyle = {
    ...styles.cta,
    transform: ctaPressed ? 'translateY(1px) scale(0.995)' : ctaHovered ? 'translateY(-1px)' : 'none',
    boxShadow: ctaPressed
      ? '0 4px 14px rgba(10, 43, 98, 0.15)'
      : ctaHovered
        ? '0 10px 24px rgba(10, 43, 98, 0.2)'
        : '0 6px 16px rgba(10, 43, 98, 0.15)',
    transition: 'transform 140ms ease, box-shadow 180ms ease, filter 180ms ease',
    filter: ctaHovered ? 'brightness(0.99)' : 'none',
  }

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes nwc-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
      <div style={styles.card}>
        <div style={styles.emojiWrap}>
          <span style={styles.emoji} role="img" aria-label="Toilet">
            🚽
          </span>
        </div>
        <h2 style={styles.heading}>When nature calls...</h2>
        <p style={styles.subheading}>
          NearestWC is the community-powered map of the world&apos;s toilets. Find them, rate them,
          and help fellow humans in their hour of need.
        </p>
        <ul style={styles.featureList}>
          {features.map((feature) => (
            <li key={feature.title} style={styles.featureRow}>
              <span style={styles.featureEmoji}>{feature.emoji}</span>
              <div>
                <p style={styles.featureTitle}>{feature.title}</p>
                <p style={styles.featureDescription}>{feature.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          style={ctaStyle}
          onClick={dismiss}
          onMouseEnter={() => setCtaHovered(true)}
          onMouseLeave={() => {
            setCtaHovered(false)
            setCtaPressed(false)
          }}
          onMouseDown={() => setCtaPressed(true)}
          onMouseUp={() => setCtaPressed(false)}
          onBlur={() => setCtaPressed(false)}
        >
          Find me a loo 🚽
        </button>
        <p style={styles.loginHint}>
          Already have an account?{' '}
          <Link style={styles.loginLink} to="/login">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

export default Onboarding
