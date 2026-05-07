import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const FAQS = [
  {
    q: "How do I add a toilet that's missing?",
    a: 'Open the app, find the location on the map, tap the + button, and fill in the details. The map gets better every time you do.',
  },
  {
    q: 'How do I report incorrect info?',
    a: "Tap any toilet, then 'Report' at the bottom of the detail sheet. Other users vote on the report so the truth wins.",
  },
  {
    q: 'How do I cancel NearestWC Pro?',
    a: 'For App Store purchases: iOS Settings → Apple ID → Subscriptions. If you subscribed on the web, use the Stripe customer portal link in your account.',
  },
  {
    q: 'How is my data used?',
    aJsx: (
      <>
        We collect minimal data — only what we need to keep the map honest and your account working.
        Read the full{' '}
        <Link to="/privacy" style={{ color: '#1a73e8', fontWeight: 700 }}>
          Privacy Policy
        </Link>
        .
      </>
    ),
  },
  {
    q: 'How do I delete my account?',
    aJsx: (
      <>
        Email us at{' '}
        <a href="mailto:hello@nearestwc.app" style={{ color: '#1a73e8', fontWeight: 700 }}>
          hello@nearestwc.app
        </a>{' '}
        and we&apos;ll handle it within 7 days. No hoops, no &ldquo;are you sure?&rdquo; six times.
      </>
    ),
  },
]

function Support() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = width < 768

  const sectionBase = {
    width: '100%',
    padding: isMobile ? '40px 20px' : '64px 24px',
  }

  const container = {
    maxWidth: '880px',
    margin: '0 auto',
  }

  const cardStyle = {
    borderRadius: '16px',
    padding: '18px 20px',
    background: '#ffffff',
    boxShadow: '0 12px 26px rgba(24, 39, 75, 0.08)',
    border: '1px solid #e4ecf8',
  }

  return (
    <div
      style={{
        width: '100%',
        color: '#1f2937',
        background: '#ffffff',
        paddingTop: 'var(--navbar-offset)',
      }}
    >
      <section
        style={{
          background: '#1a73e8',
          color: '#ffffff',
          padding: isMobile ? '48px 20px 56px' : '72px 24px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 18% 25%, rgba(255, 255, 255, 0.15), transparent 42%), radial-gradient(circle at 86% 20%, rgba(255, 255, 255, 0.08), transparent 35%)',
            pointerEvents: 'none',
          }}
        />
        <div style={{ ...container, position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h1
            style={{
              fontSize: isMobile ? '38px' : 'clamp(40px, 5.5vw, 56px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              margin: '0 0 14px',
            }}
          >
            Help &amp; Support
          </h1>
          <p
            style={{
              fontSize: isMobile ? '18px' : '20px',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.94)',
              maxWidth: '620px',
              margin: '0 auto',
            }}
          >
            Got a question, found a bug, spotted a missing toilet? You&apos;re in the right place.
          </p>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#f4f7fc' }}>
        <div style={container}>
          <h2
            style={{
              fontSize: isMobile ? '28px' : 'clamp(28px, 4vw, 36px)',
              letterSpacing: '-0.01em',
              margin: '0 0 6px',
            }}
          >
            Frequently asked questions
          </h2>
          <p style={{ margin: '0 0 22px', color: '#4b5563', fontSize: '15px' }}>
            Tap a question to see the answer.
          </p>

          <div style={{ display: 'grid', gap: '12px' }}>
            {FAQS.map((item) => (
              <details
                key={item.q}
                style={{
                  ...cardStyle,
                  padding: 0,
                }}
              >
                <summary
                  style={{
                    padding: '16px 18px',
                    cursor: 'pointer',
                    fontSize: '17px',
                    fontWeight: 700,
                    color: '#111827',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <span>{item.q}</span>
                  <span aria-hidden style={{ color: '#1a73e8', fontSize: '18px', flexShrink: 0 }}>
                    +
                  </span>
                </summary>
                <div
                  style={{
                    padding: '0 18px 18px',
                    color: '#374151',
                    lineHeight: 1.6,
                    fontSize: '15px',
                  }}
                >
                  {item.aJsx ?? item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#1a73e8', color: '#ffffff' }}>
        <div style={container}>
          <div
            style={{
              borderRadius: '18px',
              background: '#145fc1',
              padding: isMobile ? '24px 20px' : '32px 28px',
              boxShadow: '0 16px 40px rgba(15, 30, 65, 0.18)',
            }}
          >
            <h2
              style={{
                fontSize: isMobile ? '26px' : 'clamp(26px, 3.5vw, 34px)',
                letterSpacing: '-0.01em',
                margin: '0 0 10px',
              }}
            >
              Still stuck? Email us.
            </h2>
            <p
              style={{
                margin: '0 0 18px',
                fontSize: '16px',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.94)',
              }}
            >
              We&apos;re a small team (just one person, actually) so reply times can vary, but we
              read everything.
            </p>
            <a
              href="mailto:hello@nearestwc.app"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                borderRadius: '12px',
                padding: '13px 20px',
                fontSize: '16px',
                fontWeight: 800,
                color: '#1a73e8',
                background: '#ffffff',
              }}
            >
              hello@nearestwc.app
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Support
