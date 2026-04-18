import BackButton from '../components/BackButton'
import styles from './LegalPage.module.css'

function Terms() {
  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.card}>
        <h1 className={styles.title}>Terms of Use</h1>
        <p className={styles.intro}>
          Keep it useful, keep it kind, and keep the map honest for people in genuine need.
        </p>

        <section className={styles.section}>
          <h2>Acceptable use</h2>
          <p>
            Do not post fake listings, spam, offensive reviews, or harmful content. Community trust
            is the whole point.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Community-powered accuracy</h2>
          <p>
            NearestWC is powered by user contributions. We work hard to keep information accurate but
            cannot guarantee every listing is correct, open, or available.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Liability</h2>
          <p>
            The service is provided as-is. We are not liable for losses or inconvenience resulting
            from inaccurate or unavailable listings.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Account moderation</h2>
          <p>
            Accounts may be suspended or removed for abuse, manipulation, harassment, or repeated
            rule-breaking.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Governing law</h2>
          <p>These terms are governed by the laws of Scotland and the United Kingdom.</p>
        </section>
      </div>
    </div>
  )
}

export default Terms
