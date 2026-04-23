import posthog from 'posthog-js'

let analyticsEnabled = false

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY?.trim()
  const host = import.meta.env.VITE_POSTHOG_HOST?.trim()

  if (!key || !host) return

  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: true,
  })
  analyticsEnabled = true
}

export function track(eventName, properties = {}) {
  if (!analyticsEnabled || !eventName) return
  posthog.capture(eventName, properties)
}

