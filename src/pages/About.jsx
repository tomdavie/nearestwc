import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function About() {
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
    maxWidth: '760px',
    margin: '0 auto',
  }

  const h2Style = {
    fontSize: isMobile ? '26px' : 'clamp(26px, 3.6vw, 32px)',
    letterSpacing: '-0.01em',
    margin: '0 0 14px',
    color: '#111827',
    fontWeight: 700,
  }

  const pStyle = {
    margin: '0 0 12px',
    lineHeight: 1.65,
    color: '#374151',
    fontSize: isMobile ? '16px' : '17px',
  }

  const ulStyle = {
    margin: '0 0 12px',
    paddingLeft: '22px',
    lineHeight: 1.65,
    color: '#374151',
    fontSize: isMobile ? '16px' : '17px',
  }

  const liStyle = {
    margin: '0 0 10px',
  }

  const linkStyle = { color: '#1a73e8', fontWeight: 600 }

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
              margin: 0,
            }}
          >
            About NearestWC
          </h1>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#ffffff' }}>
        <div style={container}>
          <h2 style={h2Style}>The story</h2>
          <p style={pStyle}>
            NearestWC was built by one person in Glasgow, who got tired of frantically Googling
            &ldquo;public toilets near me&rdquo; on every trip out. There had to be a better way.
            Turns out there is, when 360,000 toilets and a community of users get together.
            NearestWC is what happens when convenience meets necessity.
          </p>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#f4f7fc' }}>
        <div style={container}>
          <h2 style={h2Style}>Credits</h2>
          <p style={pStyle}>NearestWC wouldn&apos;t exist without:</p>
          <ul style={ulStyle}>
            <li style={liStyle}>
              <strong>OpenStreetMap contributors:</strong> the initial 360,000+ toilet locations
              were seeded from OpenStreetMap data via the Overpass API. OpenStreetMap is open data,
              licensed under the Open Database Licence (ODbL). © OpenStreetMap contributors. Data
              available at{' '}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                openstreetmap.org
              </a>
              .
            </li>
            <li style={liStyle}>
              <strong>Google Maps:</strong> for map rendering and tiles.
            </li>
            <li style={liStyle}>
              <strong>Our community:</strong> every user who has added a toilet, written a review,
              or flagged something out of date. NearestWC is genuinely powered by you.
            </li>
            <li style={liStyle}>
              <strong>Supabase, Vercel, Stripe and PostHog:</strong> for keeping the lights on
              under the hood.
            </li>
          </ul>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#ffffff' }}>
        <div style={container}>
          <h2 style={h2Style}>Get in touch</h2>
          <p style={pStyle}>
            Found a bug? Got a feature idea? Want to suggest a partnership? Email{' '}
            <a href="mailto:hello@nearestwc.app" style={linkStyle}>
              hello@nearestwc.app
            </a>
            . We read everything.
          </p>
        </div>
      </section>

      <section style={{ ...sectionBase, background: '#1a73e8', color: '#ffffff' }}>
        <div style={container}>
          <h2 style={{ ...h2Style, color: '#ffffff', margin: '0 0 14px' }}>Legal</h2>
          <ul
            style={{
              margin: 0,
              paddingLeft: '22px',
              lineHeight: 1.7,
              fontSize: isMobile ? '16px' : '17px',
              color: 'rgba(255, 255, 255, 0.94)',
            }}
          >
            <li>
              <Link
                to="/privacy"
                style={{ color: '#ffffff', fontWeight: 600, textDecoration: 'underline' }}
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                to="/terms"
                style={{ color: '#ffffff', fontWeight: 600, textDecoration: 'underline' }}
              >
                Terms of Service
              </Link>
            </li>
            <li>
              <Link
                to="/support"
                style={{ color: '#ffffff', fontWeight: 600, textDecoration: 'underline' }}
              >
                Support
              </Link>
            </li>
          </ul>
        </div>
      </section>
    </div>
  )
}

export default About
