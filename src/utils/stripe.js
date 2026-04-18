/**
 * NearestWC Pro checkout uses a Stripe Payment Link (no Stripe.js / no redirectToCheckout).
 *
 * In Stripe Dashboard: Payment Links → Create → select your NearestWC Pro £1.99/mo product →
 * copy the link (e.g. https://buy.stripe.com/xxxx) and set it below.
 *
 * Vite only exposes env vars prefixed with VITE_. Restart the dev server after editing `.env`.
 */
export function startProCheckout() {
  const url = import.meta.env.VITE_STRIPE_PAYMENT_LINK
  if (!url || typeof url !== 'string' || !url.trim()) {
    console.error('Stripe Payment Link URL missing')
    throw new Error(
      'Payment link is not configured. Add VITE_STRIPE_PAYMENT_LINK to `.env` (your https://buy.stripe.com/... URL) and restart Vite.',
    )
  }
  window.location.href = url.trim()

}
