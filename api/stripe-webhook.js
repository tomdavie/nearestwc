import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { PostHog } from 'posthog-node'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder')

function getPostHog() {
  return new PostHog(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST,
    enableExceptionAutocapture: true,
    flushAt: 1,
    flushInterval: 0,
  })
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

async function getRawBody(req) {
  if (req.body) {
    if (Buffer.isBuffer(req.body)) return req.body
    if (typeof req.body === 'string') return Buffer.from(req.body)
    return Buffer.from(JSON.stringify(req.body))
  }
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function findUserByEmail(supabase, email) {
  if (!email) return null
  const target = email.toLowerCase()
  let page = 1

  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const users = data?.users || []
    const matched = users.find((u) => String(u.email || '').toLowerCase() === target)
    if (matched) return matched
    if (users.length < 200) break
    page += 1
  }
  return null
}

async function setProStatus(supabase, userId, isPro) {
  if (!userId) return
  const expiresAt = isPro ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null
  const payload = {
    user_id: userId,
    is_pro: isPro,
    pro_expires_at: expiresAt,
  }
  const { error } = await supabase
    .from('user_points')
    .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false })
  if (error) throw error
}

async function resolveEmailFromSubscription(subscription) {
  const maybeEmail = subscription?.customer_email
  if (maybeEmail) return maybeEmail
  const customerId = subscription?.customer
  if (!customerId || !process.env.STRIPE_SECRET_KEY) return null
  const customer = await stripe.customers.retrieve(customerId)
  if (!customer || customer.deleted) return null
  return customer.email || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).send('Method Not Allowed')
  }

  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!signingSecret) return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET' })

  const signature = req.headers['stripe-signature']
  if (!signature) return res.status(400).json({ error: 'Missing Stripe signature' })

  const rawBody = await getRawBody(req)
  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, signingSecret)
  } catch (error) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` })
  }

  const posthog = getPostHog()
  try {
    const supabase = getSupabaseAdmin()

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const email = session?.customer_details?.email || session?.customer_email || null
      const user = await findUserByEmail(supabase, email)
      if (user?.id) {
        await setProStatus(supabase, user.id, true)
        posthog.identify({ distinctId: user.id, properties: { $set: { email: user.email, is_pro: true } } })
        posthog.capture({
          distinctId: user.id,
          event: 'pro_subscription_activated',
          properties: {
            stripe_session_id: session.id,
            email: user.email,
          },
        })
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const email = await resolveEmailFromSubscription(subscription)
      const user = await findUserByEmail(supabase, email)
      if (user?.id) {
        await setProStatus(supabase, user.id, false)
        posthog.identify({ distinctId: user.id, properties: { $set: { email: user.email, is_pro: false } } })
        posthog.capture({
          distinctId: user.id,
          event: 'pro_subscription_cancelled',
          properties: {
            stripe_subscription_id: subscription.id,
            email: user.email,
          },
        })
      }
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('[stripe-webhook] handler error', error)
    posthog.captureException(error)
    return res.status(500).json({ error: error.message || 'Webhook processing failed' })
  } finally {
    await posthog.shutdown()
  }
}

