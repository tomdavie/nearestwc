/**
 * NearestWC Pro checkout uses a Stripe Payment Link (no Stripe.js).
 *
 * IMPORTANT — where the user lands after paying:
 * Stripe Payment Links do **not** reliably support arbitrary query params on the buy.stripe.com URL
 * for “success redirects” in app code. The **return URL after checkout is configured in Stripe**:
 *
 * 1. Stripe Dashboard → **Payment Links** → open your NearestWC Pro link → **Settings**
 * 2. Under **After payment** / confirmation: choose **“Don’t show confirmation page”** (or equivalent)
 *    and set the **redirect URL** to your deployed app, e.g.
 *    `https://your-app.vercel.app/pro-success`
 *    (use your real production URL; for local dev, use something like `http://localhost:5173/pro-success`
 *    if Stripe allows it, or test against your staging URL).
 * 3. Optionally use Stripe’s **{CHECKOUT_SESSION_ID}** placeholder in the dashboard if offered for
 *    server-side verification — the app’s `/pro-success` page activates Pro once the user is logged in.
 *
 * Set the link URL in `.env` as `VITE_STRIPE_PAYMENT_LINK` (Vite `VITE_` prefix; restart dev server after edits).
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
