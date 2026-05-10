# revenuecat-webhook

Supabase Edge Function that receives webhook events from RevenueCat and writes
NearestWC Pro status to `public.user_points` (`is_pro`, `pro_expires_at`).

It mirrors the upsert pattern used by the Stripe webhook (`api/stripe-webhook.js`)
so iOS (RevenueCat / Apple IAP) and web (Stripe) flows share the same source
of truth.

## Required environment variables (function secrets)

Supabase auto-injects `SUPABASE_URL` and `SUPABASE_ANON_KEY` for Edge Functions.
This function additionally needs:

- `SUPABASE_SERVICE_ROLE_KEY` (so it can write to `user_points` bypassing RLS)
- `REVENUECAT_WEBHOOK_SECRET` (the shared secret you paste into RevenueCat's
  webhook integration as the Authorization header value)

Set them with:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set REVENUECAT_WEBHOOK_SECRET=<your-shared-secret>
```

`SUPABASE_SERVICE_ROLE_KEY` does have to be set explicitly. Until
`REVENUECAT_WEBHOOK_SECRET` is set, every call returns 401, which is the
intended behaviour while you generate the secret in the RevenueCat dashboard.

## Deploy

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

`--no-verify-jwt` is required: RevenueCat will not send a Supabase JWT, we
authenticate via the shared secret on the Authorization header instead.

## RevenueCat dashboard configuration

1. Project settings → Integrations → Webhooks → Add webhook.
2. URL: `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
3. Authorization header value: the same string set as
   `REVENUECAT_WEBHOOK_SECRET`.

## Event handling

| Event type                     | Action          |
| ------------------------------ | --------------- |
| INITIAL_PURCHASE               | activate Pro    |
| RENEWAL                        | activate Pro    |
| UNCANCELLATION                 | activate Pro    |
| PRODUCT_CHANGE                 | activate Pro    |
| NON_RENEWING_PURCHASE          | activate Pro    |
| TEMPORARY_ENTITLEMENT_GRANT    | activate Pro    |
| SUBSCRIPTION_EXTENDED          | activate Pro    |
| EXPIRATION                     | deactivate Pro  |
| CANCELLATION                   | log only        |
| BILLING_ISSUE                  | log only        |
| SUBSCRIPTION_PAUSED            | log only        |
| TRANSFER                       | log only        |
| TEST                           | acknowledge 200 |
| anything else                  | log + 200 OK    |

CANCELLATION etc. are intentionally no-ops: RevenueCat sends EXPIRATION when
access actually ends, so the user retains Pro until that moment.

## Local test

```bash
supabase functions serve revenuecat-webhook --no-verify-jwt --env-file ./supabase/functions/.env.local

curl -i -X POST http://localhost:54321/functions/v1/revenuecat-webhook \
  -H "Authorization: $REVENUECAT_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"event":{"type":"INITIAL_PURCHASE","app_user_id":"<auth-user-uuid>","expiration_at_ms":'"$(($(date +%s)000 + 30*86400000))"'}}'
```
