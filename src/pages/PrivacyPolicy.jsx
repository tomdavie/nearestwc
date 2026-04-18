import BackButton from '../components/BackButton'
import styles from './LegalPage.module.css'

function PrivacyPolicy() {
  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.card}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.intro}>
          We take your privacy as seriously as you take finding a clean toilet.
        </p>

        <section className={styles.section}>
          <h2>What we collect</h2>
          <p>
            We collect account email, location-related data you submit (including toilet locations),
            reviews, and points/badge activity linked to your profile.
          </p>
        </section>

        <section className={styles.section}>
          <h2>How we use it</h2>
          <p>
            We use your data to run NearestWC, improve map accuracy, power community features,
            detect abuse, and help you track contributions and rewards.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Third parties and selling data</h2>
          <p>
            We do not sell your personal data. We use trusted service providers (such as hosting and
            map services) only to operate the app.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Cookies</h2>
          <p>
            We use essential cookies/local storage for login state, onboarding progress, and basic
            app preferences. No creepy tracking nonsense.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Your rights</h2>
          <p>
            You can request deletion of your account and associated data at any time. Contact us at{' '}
            <a href="mailto:privacy@nearestwc.app">privacy@nearestwc.app</a>.
          </p>
        </section>
      </div>
    </div>
  )
}

export default PrivacyPolicy
