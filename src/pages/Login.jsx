import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useToast } from '../context/useToast'
import BackButton from '../components/BackButton'
import styles from './Login.module.css'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) showToast(error.message, 'error')
      else showToast('Check your email to confirm your account.', 'success', 6000)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) showToast(error.message, 'error')
      else {
        showToast('Welcome back.', 'success')
        setTimeout(() => navigate('/'), 600)
      }
    }
  }

  return (
    <div className={styles.page}>
      <BackButton />
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <span className={styles.mark} aria-hidden>
            W
          </span>
        </div>
        <h1 className={styles.heading}>{isSignUp ? 'Create account' : 'Sign in'}</h1>
        <p className={styles.sub}>
          {isSignUp
            ? 'Use your email to join NearestWC and add verified listings.'
            : 'Continue with your NearestWC account.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className={styles.field}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className={styles.field}
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              minLength={6}
            />
          </div>
          <button className={styles.primaryBtn} type="submit">
            {isSignUp ? 'Sign up' : 'Next'}
          </button>
          {isSignUp && (
            <p className={styles.legalNote}>
              By signing up you agree to our <Link to="/terms">Terms of Use</Link> and{' '}
              <Link to="/privacy">Privacy Policy</Link>.
            </p>
          )}
        </form>

        <p className={styles.switch}>
          {isSignUp ? 'Already have an account? ' : 'New to NearestWC? '}
          <button
            type="button"
            className={styles.switchBtn}
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? 'Sign in' : 'Create account'}
          </button>
        </p>
      </div>
    </div>
  )
}

export default Login
