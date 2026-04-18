import { loadStripe } from '@stripe/stripe-js'

let stripePromise = null

function getStripe() {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '')
  }
  return stripePromise
}

export async function startProCheckout(userId) {
  const stripe = await getStripe()
  if (!stripe) throw new Error('Stripe is not configured.')

  const price = import.meta.env.VITE_STRIPE_PRICE_ID
  if (!price) throw new Error('Missing Stripe price ID.')

  const successUrl = `${window.location.origin}/pro-success`
  const cancelUrl = `${window.location.origin}/profile`

  const { error } = await stripe.redirectToCheckout({
    mode: 'subscription',
    lineItems: [{ price, quantity: 1 }],
    successUrl,
    cancelUrl,
    clientReferenceId: userId || undefined,
  })

  if (error) throw error
}
