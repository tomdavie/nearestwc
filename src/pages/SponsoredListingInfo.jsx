function SponsoredListingInfo() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#fff',
        padding: 'calc(var(--navbar-offset) + 24px) 20px 28px',
      }}
    >
      <div
        style={{
          width: 'min(100%, 760px)',
          margin: '0 auto',
          border: '1px solid var(--color-border-light)',
          borderRadius: '18px',
          padding: '22px 18px',
          boxShadow: 'var(--shadow-sm)',
          background: '#fff',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(30px, 6vw, 44px)',
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
          }}
        >
          Put your business on the map. Literally.
        </h1>
        <p style={{ margin: '14px 0 18px', fontSize: '16px', lineHeight: 1.55, color: 'var(--color-text-secondary)' }}>
          NearestWC is used by people who need a toilet urgently - often near your business. As a
          featured partner, your venue appears prominently on the map with your offer highlighted.
        </p>

        <div
          style={{
            border: '1px solid var(--color-border-light)',
            borderRadius: '14px',
            padding: '14px',
            background: 'var(--color-surface)',
            marginBottom: '16px',
          }}
        >
          <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 700, color: 'var(--color-text)' }}>
            What your business gets
          </p>
          <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            <li>Featured gold pin on the map</li>
            <li>Offer shown to users in your listing</li>
            <li>Business logo displayed in the offer card</li>
            <li>Monthly analytics summary</li>
          </ul>
        </div>

        <p style={{ margin: '0 0 14px', fontSize: '19px', fontWeight: 700, color: '#145fcf' }}>£20/month</p>

        <a
          href="mailto:partners@nearestwc.app"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            textDecoration: 'none',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '15px',
            fontWeight: 700,
            color: '#fff',
            background: 'var(--color-primary)',
          }}
        >
          Get in touch
        </a>
      </div>
    </div>
  )
}

export default SponsoredListingInfo
