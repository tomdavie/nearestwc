import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function Landing() {
  const [width, setWidth] = useState(375)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1100

  const sectionBase = {
    width: '100%',
    padding: isMobile ? '56px 24px' : '72px 24px',
  }

  const container = {
    maxWidth: '1120px',
    margin: '0 auto',
  }

  const cardStyle = {
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 12px 26px rgba(24, 39, 75, 0.08)',
  }

  const buttonBase = {
    display: 'inline-block',
    textDecoration: 'none',
    borderRadius: '12px',
    padding: '13px 18px',
    fontWeight: 800,
    textAlign: 'center',
    width: isMobile ? '100%' : 'auto',
  }

  return (
    <div style={{ width: '100%', color: '#1f2937', background: '#ffffff' }}>
      <style>{`
        @keyframes landingBounceDown {
          0%, 100% { transform: translateY(0); opacity: 0.75; }
          50% { transform: translateY(6px); opacity: 1; }
        }
      `}</style>
      <section
        style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          paddingTop: 'env(safe-area-inset-top)',
          background: '#1a73e8',
          color: '#ffffff',
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
        <div
          style={{
            ...container,
            position: 'relative',
            zIndex: 2,
            width: '100%',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            padding: '0 24px',
          }}
        >
          <header
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              padding: isMobile ? '20px 0' : '24px 0',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
              <span
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  background: '#ffffff',
                  color: '#1a73e8',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '19px',
                }}
                aria-hidden
              >
                WC
              </span>
              <span style={{ fontSize: '20px', letterSpacing: '-0.01em' }}>NearestWC</span>
            </div>
            <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto' }}>
              <Link
                to="/login"
                style={{
                  ...buttonBase,
                  width: isMobile ? '100%' : 'auto',
                  fontWeight: 600,
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.45)',
                }}
              >
                Login
              </Link>
              <Link
                to="/login"
                style={{
                  ...buttonBase,
                  width: isMobile ? '100%' : 'auto',
                  color: '#1a73e8',
                  background: '#ffffff',
                }}
              >
                Sign up
              </Link>
            </div>
          </header>

          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingBottom: '15vh',
              textAlign: 'center',
              width: '100%',
            }}
          >
            <h1
              style={{
                fontSize: isMobile ? '38px' : 'clamp(44px, 6vw, 64px)',
                lineHeight: 1.03,
                letterSpacing: '-0.02em',
                marginBottom: '16px',
              }}
            >
              When nature calls... answer it.
            </h1>
            <p
              style={{
                fontSize: isMobile ? '20px' : 'clamp(18px, 2.2vw, 23px)',
                lineHeight: 1.5,
                color: 'rgba(255, 255, 255, 0.94)',
                maxWidth: '620px',
                marginBottom: isMobile ? '24px' : '28px',
              }}
            >
              The community-powered map of public toilets worldwide. Find them, rate them, and never
              be caught short again.
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '12px',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              <Link
                to="/login"
                style={{
                  ...buttonBase,
                  color: '#1a73e8',
                  background: '#ffffff',
                }}
              >
                Find a WC now 🚽
              </Link>
              <a
                href="#how-it-works"
                style={{
                  ...buttonBase,
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.55)',
                }}
              >
                See how it works
              </a>
            </div>
          </div>
          <a
            href="#how-it-works"
            aria-label="Scroll down"
            style={{
              position: 'absolute',
              bottom: isMobile ? '18px' : '24px',
              left: '50%',
              translate: '-50% 0',
              color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none',
              fontSize: '22px',
              lineHeight: 1,
              animation: 'landingBounceDown 1.4s ease-in-out infinite',
            }}
          >
            ⌄
          </a>
        </div>
      </section>

      <section style={{ background: '#145fc1', color: '#ffffff', padding: '16px 24px' }}>
        <div style={{ ...container, display: 'grid', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 700 }}>
            Join thousands of people who&apos;ve never been caught short again 🚽
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '10px',
              color: 'rgba(255,255,255,0.9)',
              fontSize: '14px',
            }}
          >
            <span>350,000+ toilets mapped globally</span>
            <span>Community reviewed</span>
            <span>Free to use</span>
          </div>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#ffffff' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '14px' }}>
            We&apos;ve all been there.
          </h2>
          <div
            style={{
              marginTop: '20px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            <article style={{ ...cardStyle, background: '#f8fbff', border: '1px solid #e4ecf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '20px' }}>🏃 The desperate sprint</h3>
              <p style={{ lineHeight: 1.55 }}>
                you&apos;re out and about and suddenly... you need to go. Now.
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#f8fbff', border: '1px solid #e4ecf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '20px' }}>🚪 The locked door</h3>
              <p style={{ lineHeight: 1.55 }}>
                you find a toilet but it needs a code. Nobody knows the code.
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#f8fbff', border: '1px solid #e4ecf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '20px' }}>🤢 The risk</h3>
              <p style={{ lineHeight: 1.55 }}>you go in blind and regret it immediately.</p>
            </article>
          </div>
          <p style={{ marginTop: '18px', fontSize: '18px', fontWeight: 700, color: '#1a73e8' }}>
            NearestWC solves all three.
          </p>
        </div>
      </section>

      <section id="how-it-works" style={{ ...sectionBase, background: '#eef4ff' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '18px' }}>
            How it works
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '14px',
              position: 'relative',
            }}
          >
            {!isMobile && (
              <div
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: '16.5%',
                  right: '16.5%',
                  height: '2px',
                  background: '#b8cef4',
                  zIndex: 0,
                }}
              />
            )}
            {[
              { title: 'Allow location 📍', sub: 'We find where you are' },
              { title: 'Find a WC 🚽', sub: 'See rated toilets near you instantly' },
              { title: 'Rate it ⭐', sub: 'Help the next person in need' },
            ].map((step, idx) => (
              <article
                key={step.title}
                style={{
                  ...cardStyle,
                  background: '#ffffff',
                  border: '1px solid #dce7fb',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '999px',
                    background: '#1a73e8',
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    marginBottom: '10px',
                  }}
                >
                  {idx + 1}
                </div>
                <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>{step.title}</h3>
                <p style={{ lineHeight: 1.55, margin: 0 }}>{step.sub}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#f4f7fc' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '18px' }}>
            Find. Rate. Repeat.
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isMobile
                ? '1fr'
                : isTablet
                  ? 'repeat(2, minmax(0, 1fr))'
                  : 'repeat(4, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            <article style={{ ...cardStyle, background: '#ffffff' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>📍 Find the nearest WC</h3>
              <p style={{ lineHeight: 1.55 }}>
                community-added toilets worldwide, rated and reviewed by real humans
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#ffffff' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>⭐ Rate and review</h3>
              <p style={{ lineHeight: 1.55 }}>
                cleanliness, facilities, access codes. Everything you need to know before you commit.
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#ffffff' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>🏅 Earn as you go</h3>
              <p style={{ lineHeight: 1.55 }}>
                points, badges and contributor levels for helping fellow humans in need
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#ffffff' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>🚨 Urgent Mode (Pro)</h3>
              <p style={{ lineHeight: 1.55 }}>
                one tap to the nearest open, free, highly rated WC. No browsing. Just go.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#ffffff' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '14px' }}>
            Built for those who need it most.
          </h2>
          <p style={{ lineHeight: 1.65, fontSize: isMobile ? '19px' : '18px', maxWidth: '890px' }}>
            For people living with Crohn&apos;s disease, ulcerative colitis, IBS or other bowel
            conditions, finding a toilet quickly isn&apos;t a convenience - it&apos;s a necessity.
            NearestWC was built with you in mind.
          </p>
          <div
            style={{
              marginTop: '20px',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
              gap: '16px',
            }}
          >
            <article style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #e7edf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>Desperate Mode 🚨</h3>
              <p style={{ lineHeight: 1.55 }}>Prioritised nearby toilets when time matters most.</p>
            </article>
            <article style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #e7edf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>RADAR key indicator</h3>
              <p style={{ lineHeight: 1.55 }}>
                Know ahead of time which locations are accessible with a RADAR key.
              </p>
            </article>
            <article style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #e7edf8' }}>
              <h3 style={{ marginBottom: '10px', fontSize: '19px' }}>🗺️ Route Planning</h3>
              <p style={{ lineHeight: 1.55 }}>
                map toilets along your journey before you leave. Coming soon.
              </p>
            </article>
          </div>
          <p style={{ marginTop: '16px', color: '#4b5563' }}>Supported by the community.</p>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#1a73e8', color: '#ffffff' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '8px' }}>
            Go Pro. Go anywhere.
          </h2>
          <p style={{ fontSize: isMobile ? '38px' : '42px', margin: '0 0 14px', fontWeight: 800 }}>
            £1.99/month
          </p>
          <ul style={{ paddingLeft: '18px', lineHeight: 1.7, marginBottom: '18px' }}>
            <li>Urgent Mode with one-tap toilet directions</li>
            <li>🗺️ Route Planning (coming soon)</li>
            <li>Pro badges and priority feature access</li>
            <li>Support development for people who rely on this every day</li>
          </ul>
          <Link
            to="/upgrade"
            style={{
              ...buttonBase,
              color: '#1a73e8',
              background: '#ffffff',
            }}
          >
            Go Pro 🚽
          </Link>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#ffffff' }}>
        <div style={container}>
          <h2 style={{ fontSize: isMobile ? '34px' : 'clamp(30px, 5vw, 44px)', marginBottom: '12px' }}>
            Put your business on the map.
          </h2>
          <p style={{ lineHeight: 1.6, maxWidth: '760px', marginBottom: '18px' }}>
            Reach people exactly when they&apos;re nearby. Sponsored listings help cafes, restaurants and
            hotels surface their facilities to the NearestWC community.
          </p>
          <Link
            to="/advertise"
            style={{
              ...buttonBase,
              color: '#ffffff',
              background: '#1a73e8',
              fontWeight: 700,
            }}
          >
            Get in touch
          </Link>
        </div>
      </section>

      <footer style={{ background: '#111827', color: '#d1d5db', padding: '34px 24px' }}>
        <div style={{ ...container, display: 'grid', gap: '16px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontWeight: 800 }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: '#1a73e8',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
              }}
              aria-hidden
            >
              WC
            </span>
            <span style={{ color: '#f9fafb', fontSize: '18px' }}>NearestWC</span>
          </div>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <Link to="/privacy" style={{ color: '#c9ddff', textDecoration: 'none' }}>
              Privacy Policy
            </Link>
            <Link to="/terms" style={{ color: '#c9ddff', textDecoration: 'none' }}>
              Terms
            </Link>
            <Link to="/advertise" style={{ color: '#c9ddff', textDecoration: 'none' }}>
              Advertise with us
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '12px' }}>
            <a
              href="#"
              style={{
                width: isMobile ? '100%' : '186px',
                textDecoration: 'none',
                minHeight: '56px',
                borderRadius: '12px',
                background: '#000000',
                border: '1px solid #333333',
                color: '#ffffff',
                display: 'grid',
                alignContent: 'center',
                padding: '8px 14px',
              }}
            >
              <span style={{ fontSize: '11px', lineHeight: 1.1, opacity: 0.85 }}>Download on the</span>
              <span style={{ fontSize: '18px', lineHeight: 1.1, fontWeight: 700 }}>App Store</span>
            </a>
            <a
              href="#"
              style={{
                width: isMobile ? '100%' : '186px',
                textDecoration: 'none',
                minHeight: '56px',
                borderRadius: '12px',
                background: '#000000',
                border: '1px solid #333333',
                color: '#ffffff',
                display: 'grid',
                alignContent: 'center',
                padding: '8px 14px',
              }}
            >
              <span style={{ fontSize: '11px', lineHeight: 1.1, opacity: 0.85 }}>Get it on</span>
              <span style={{ fontSize: '18px', lineHeight: 1.1, fontWeight: 700 }}>Google Play</span>
            </a>
          </div>

          <p style={{ margin: 0, color: '#9ca3af' }}>© 2026 NearestWC</p>
        </div>
      </footer>
    </div>
  )
}

export default Landing
