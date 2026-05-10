// RevenueCat → Supabase webhook for NearestWC Pro.
//
// Mirrors the upsert pattern used by api/stripe-webhook.js: writes to
// public.user_points (user_id, is_pro, pro_expires_at). The frontend gates
// features on `is_pro` (boolean), so EXPIRATION events flip it to false and
// active-subscription events flip it to true.
//
// Authentication: RevenueCat will not send a Supabase JWT. Instead we expect
// a shared secret on the Authorization header (configured under "Authorization
// header value" in the RevenueCat webhook integration settings). We compare it
// against the REVENUECAT_WEBHOOK_SECRET function secret.
//
// Deploy with: supabase functions deploy revenuecat-webhook --no-verify-jwt

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'UNCANCELLATION'
  | 'PRODUCT_CHANGE'
  | 'NON_RENEWING_PURCHASE'
  | 'TEMPORARY_ENTITLEMENT_GRANT'
  | 'EXPIRATION'
  | 'CANCELLATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIPTION_PAUSED'
  | 'TRANSFER'
  | 'SUBSCRIPTION_EXTENDED'
  | 'TEST'

interface RevenueCatEvent {
  type?: RevenueCatEventType | string
  app_user_id?: string
  original_app_user_id?: string
  expiration_at_ms?: number | null
  event_timestamp_ms?: number
  product_id?: string
  environment?: 'SANDBOX' | 'PRODUCTION' | string
  store?: string
  [key: string]: unknown
}

interface RevenueCatPayload {
  event?: RevenueCatEvent
  api_version?: string
}

const ACTIVATE_EVENTS = new Set<string>([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'SUBSCRIPTION_EXTENDED',
])

const DEACTIVATE_EVENTS = new Set<string>(['EXPIRATION'])

const NOOP_EVENTS = new Set<string>([
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIPTION_PAUSED',
  'TRANSFER',
  'TEST',
])

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function getServiceRoleClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function authoriseRequest(req: Request): { ok: boolean; reason?: string } {
  const expected = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
  if (!expected) {
    return { ok: false, reason: 'REVENUECAT_WEBHOOK_SECRET not configured' }
  }
  const header = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!header) return { ok: false, reason: 'Missing Authorization header' }
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : header.trim()
  if (provided !== expected) return { ok: false, reason: 'Invalid Authorization header' }
  return { ok: true }
}

function expirationToIso(expirationAtMs: number | null | undefined): string | null {
  if (typeof expirationAtMs !== 'number' || !Number.isFinite(expirationAtMs) || expirationAtMs <= 0) {
    return null
  }
  return new Date(expirationAtMs).toISOString()
}

async function setProStatus(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userId: string,
  isPro: boolean,
  proExpiresAt: string | null,
) {
  const payload = {
    user_id: userId,
    is_pro: isPro,
    pro_expires_at: proExpiresAt,
  }
  const { error } = await supabase
    .from('user_points')
    .upsert(payload, { onConflict: 'user_id', ignoreDuplicates: false })
  if (error) throw error
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { allow: 'POST' },
    })
  }

  const auth = authoriseRequest(req)
  if (!auth.ok) {
    console.warn('[revenuecat-webhook] auth rejected', { reason: auth.reason })
    return jsonResponse(401, { error: auth.reason ?? 'Unauthorised' })
  }

  let payload: RevenueCatPayload
  try {
    payload = (await req.json()) as RevenueCatPayload
  } catch (err) {
    console.error('[revenuecat-webhook] invalid JSON body', err)
    return jsonResponse(400, { error: 'Invalid JSON body' })
  }

  const event = payload?.event
  const eventType = String(event?.type ?? '')
  const userId = event?.app_user_id || event?.original_app_user_id || null
  const environment = event?.environment ?? null
  const productId = event?.product_id ?? null

  console.log('[revenuecat-webhook] received', {
    type: eventType,
    user_id: userId,
    environment,
    product_id: productId,
    expiration_at_ms: event?.expiration_at_ms ?? null,
  })

  if (!eventType) {
    console.warn('[revenuecat-webhook] missing event.type, returning 200 to avoid retries')
    return jsonResponse(200, { received: true, action: 'ignored', reason: 'missing event.type' })
  }

  if (eventType === 'TEST') {
    console.log('[revenuecat-webhook] TEST event acknowledged')
    return jsonResponse(200, { received: true, action: 'test_ack' })
  }

  if (NOOP_EVENTS.has(eventType)) {
    console.log('[revenuecat-webhook] no-op event, leaving Pro state intact', { type: eventType })
    return jsonResponse(200, { received: true, action: 'noop', type: eventType })
  }

  if (!userId) {
    console.warn('[revenuecat-webhook] event has no app_user_id, cannot route', { type: eventType })
    return jsonResponse(200, { received: true, action: 'ignored', reason: 'missing app_user_id' })
  }

  let supabase: ReturnType<typeof getServiceRoleClient>
  try {
    supabase = getServiceRoleClient()
  } catch (err) {
    console.error('[revenuecat-webhook] service role client init failed', err)
    return jsonResponse(500, { error: (err as Error).message || 'Service role init failed' })
  }

  try {
    if (ACTIVATE_EVENTS.has(eventType)) {
      const proExpiresAt = expirationToIso(event?.expiration_at_ms ?? null)
      await setProStatus(supabase, userId, true, proExpiresAt)
      console.log('[revenuecat-webhook] activated Pro', {
        user_id: userId,
        type: eventType,
        pro_expires_at: proExpiresAt,
      })
      return jsonResponse(200, {
        received: true,
        action: 'activated',
        type: eventType,
        user_id: userId,
        pro_expires_at: proExpiresAt,
      })
    }

    if (DEACTIVATE_EVENTS.has(eventType)) {
      await setProStatus(supabase, userId, false, null)
      console.log('[revenuecat-webhook] deactivated Pro', { user_id: userId, type: eventType })
      return jsonResponse(200, {
        received: true,
        action: 'deactivated',
        type: eventType,
        user_id: userId,
      })
    }

    console.log('[revenuecat-webhook] unrecognised event, returning 200', { type: eventType })
    return jsonResponse(200, { received: true, action: 'ignored', type: eventType })
  } catch (err) {
    console.error('[revenuecat-webhook] handler error', err)
    return jsonResponse(500, {
      error: (err as Error).message || 'Webhook processing failed',
      type: eventType,
      user_id: userId,
    })
  }
})
