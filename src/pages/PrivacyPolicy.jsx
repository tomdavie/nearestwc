import { useEffect, useState } from 'react'

const LAST_UPDATED = '7 May 2026'

function PrivacyPolicy() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 375)

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isMobile = width < 768

  const container = {
    maxWidth: '760px',
    margin: '0 auto',
  }

  const sectionBlockStyle = {
    marginTop: '28px',
  }

  const h2Style = {
    fontSize: isMobile ? '22px' : '24px',
    letterSpacing: '-0.01em',
    margin: '0 0 10px',
    color: '#111827',
    fontWeight: 700,
  }

  const pStyle = {
    margin: '0 0 12px',
    lineHeight: 1.65,
    color: '#374151',
    fontSize: '16px',
  }

  const ulStyle = {
    margin: '0 0 12px',
    paddingLeft: '22px',
    lineHeight: 1.65,
    color: '#374151',
    fontSize: '16px',
  }

  const liStyle = {
    margin: '0 0 6px',
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
          padding: isMobile ? '40px 20px 48px' : '64px 24px 72px',
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
              fontSize: isMobile ? '36px' : 'clamp(40px, 5.5vw, 52px)',
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              margin: '0 0 12px',
            }}
          >
            Privacy Policy
          </h1>
          <p
            style={{
              fontSize: isMobile ? '15px' : '17px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
            }}
          >
            Last updated: {LAST_UPDATED}
          </p>
        </div>
      </section>

      <section
        style={{
          width: '100%',
          padding: isMobile ? '40px 20px 56px' : '56px 24px 80px',
          background: '#ffffff',
        }}
      >
        <div style={container}>
          <section>
            <h2 style={h2Style}>Who we are</h2>
            <p style={pStyle}>
              NearestWC is operated by Thomas Davie, a sole trader based in Glasgow, Scotland (the
              &ldquo;data controller&rdquo;). You can contact us at{' '}
              <a href="mailto:hello@nearestwc.app" style={linkStyle}>
                hello@nearestwc.app
              </a>
              .
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>What this policy covers</h2>
            <p style={pStyle}>
              This policy explains what data we collect when you use the NearestWC app and website
              (nearestwc.app), why we collect it, how we use it, and your rights under UK GDPR and
              the Data Protection Act 2018.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>What data we collect</h2>
            <p style={pStyle}>
              <strong>Account data:</strong> email address, and (if you sign in with Google) your
              Google account name and profile photo.
            </p>
            <p style={pStyle}>
              <strong>Location data:</strong> your device&apos;s GPS location, used only to show you
              nearby toilets. Location is not stored on our servers; it stays on your device.
            </p>
            <p style={pStyle}>
              <strong>Contributions:</strong> any reviews, ratings, opening hours edits, reports, or
              new toilet entries you create. These are public on the app.
            </p>
            <p style={pStyle}>
              <strong>Profile data:</strong> optional information you choose to add about your
              accessibility needs or health conditions (e.g. IBD, IBS, Crohn&apos;s, ulcerative
              colitis).
            </p>
            <p style={pStyle}>
              <strong>Subscription data:</strong> if you subscribe to NearestWC Pro, we record your
              subscription status. Payment details (card numbers, etc.) are handled by Stripe and
              Apple; we never see or store them.
            </p>
            <p style={pStyle}>
              <strong>Usage data:</strong> anonymised analytics about how the app is used (page
              views, feature usage, crash reports), collected via PostHog.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Health and condition data (special category data)</h2>
            <p style={pStyle}>
              If you choose to add information about a health condition to your profile, we treat
              this as special category data under UK GDPR Article 9. We process it only with your
              explicit consent, given when you add it to your profile. You can remove it at any time
              from the profile screen, and it will be deleted from our systems.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Why we collect data and our legal basis</h2>
            <p style={pStyle}>
              <strong>To provide the app&apos;s core functionality</strong> (finding and
              contributing to toilets): performance of contract.
            </p>
            <p style={pStyle}>
              <strong>To send you essential service emails</strong> (e.g. password resets, account
              changes): performance of contract.
            </p>
            <p style={pStyle}>
              <strong>To process subscription payments:</strong> performance of contract.
            </p>
            <p style={pStyle}>
              <strong>To improve the app via analytics:</strong> legitimate interest.
            </p>
            <p style={pStyle}>
              <strong>To process health and condition data:</strong> explicit consent.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Who we share data with</h2>
            <p style={pStyle}>
              We use the following third parties to operate the app. Each has its own privacy
              policy.
            </p>
            <ul style={ulStyle}>
              <li style={liStyle}>
                <strong>Supabase</strong> (database and authentication): data stored in EU regions.
              </li>
              <li style={liStyle}>
                <strong>Vercel</strong> (website hosting): globally distributed, primarily EU and
                US.
              </li>
              <li style={liStyle}>
                <strong>Google Maps</strong> (map rendering): Google&apos;s privacy policy applies.
              </li>
              <li style={liStyle}>
                <strong>Stripe</strong> (web subscription payments): Stripe&apos;s privacy policy
                applies.
              </li>
              <li style={liStyle}>
                <strong>Apple</strong> (iOS subscription payments, via In-App Purchase):
                Apple&apos;s privacy policy applies.
              </li>
              <li style={liStyle}>
                <strong>PostHog</strong> (analytics): EU-hosted instance.
              </li>
            </ul>
            <p style={pStyle}>We do not sell your data. We do not share data with advertisers.</p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>International transfers</h2>
            <p style={pStyle}>
              Some service providers (Vercel, PostHog) may transfer data outside the UK. Where they
              do, we rely on Standard Contractual Clauses or equivalent safeguards as required by
              UK GDPR.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>How long we keep your data</h2>
            <p style={pStyle}>
              <strong>Account data:</strong> until you delete your account, then deleted within 30
              days.
            </p>
            <p style={pStyle}>
              <strong>Contributions</strong> (reviews, edits): retained even after account deletion,
              but anonymised so they are not linked to you.
            </p>
            <p style={pStyle}>
              <strong>Subscription records:</strong> retained for 7 years to comply with UK tax law.
            </p>
            <p style={pStyle}>
              <strong>Analytics:</strong> anonymised at collection; retained for 24 months.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Your rights</h2>
            <p style={pStyle}>Under UK GDPR you have the right to:</p>
            <ul style={ulStyle}>
              <li style={liStyle}>access the data we hold about you</li>
              <li style={liStyle}>correct inaccurate data</li>
              <li style={liStyle}>
                request deletion of your data (&ldquo;right to be forgotten&rdquo;)
              </li>
              <li style={liStyle}>request a portable copy of your data</li>
              <li style={liStyle}>object to processing based on legitimate interest</li>
              <li style={liStyle}>withdraw consent for any consent-based processing</li>
            </ul>
            <p style={pStyle}>
              To exercise any of these, email{' '}
              <a href="mailto:hello@nearestwc.app" style={linkStyle}>
                hello@nearestwc.app
              </a>
              . We will respond within one calendar month. You can also complain to the Information
              Commissioner&apos;s Office (
              <a
                href="https://ico.org.uk"
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
              >
                ico.org.uk
              </a>
              ) if you are unhappy with how we have handled your data.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Children</h2>
            <p style={pStyle}>
              NearestWC is not directed at children under 13. We do not knowingly collect data from
              children under 13.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Changes to this policy</h2>
            <p style={pStyle}>
              We will update this page if our data practices change. Material changes will be
              notified by email.
            </p>
          </section>

          <section style={sectionBlockStyle}>
            <h2 style={h2Style}>Contact</h2>
            <p style={pStyle}>
              <a href="mailto:hello@nearestwc.app" style={linkStyle}>
                hello@nearestwc.app
              </a>
            </p>
          </section>
        </div>
      </section>
    </div>
  )
}

export default PrivacyPolicy
