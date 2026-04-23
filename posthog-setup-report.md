<wizard-report>
# PostHog post-wizard report

The wizard has completed a server-side integration of PostHog into NearestWC's Stripe webhook handler (`api/stripe-webhook.js`). The `posthog-node` SDK was installed and configured for Vercel's serverless environment (using `flushAt: 1`, `flushInterval: 0`, and `await posthog.shutdown()` in a `finally` block to guarantee delivery before the function exits). Two critical business events are now tracked server-side, with user identification and error capture also in place.

| Event Name | Description | File |
|---|---|---|
| `pro_subscription_activated` | Fired when a Stripe `checkout.session.completed` event is processed and the user's Pro status is successfully set. Includes `stripe_session_id` and `email`. | `api/stripe-webhook.js` |
| `pro_subscription_cancelled` | Fired when a Stripe `customer.subscription.deleted` event is processed and the user's Pro status is removed. Includes `stripe_subscription_id` and `email`. | `api/stripe-webhook.js` |

**User identification:** On each subscription event, `posthog.identify()` is called with the user's Supabase UUID as `distinctId` and their `email` and `is_pro` status as person properties. This links server-side events to frontend events captured by `posthog-js`.

**Error tracking:** `posthog.captureException(error)` is called in the catch block of the webhook handler so any processing failure is tracked with a full stack trace.

**Environment variables added to `.env`:**
- `POSTHOG_API_KEY` — your PostHog project token
- `POSTHOG_HOST` — `https://us.i.posthog.com`

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/394585/dashboard/1503416
- **Pro subscription activations over time:** https://us.posthog.com/project/394585/insights/7vwcgm9u
- **Pro subscription cancellations over time:** https://us.posthog.com/project/394585/insights/5yXm1jGs
- **Upgrade conversion funnel** (upgrade page → checkout → activation): https://us.posthog.com/project/394585/insights/97jgXp8N
- **Active Pro subscribers:** https://us.posthog.com/project/394585/insights/60ZE4bwN
- **Net Pro subscriber growth** (activations vs cancellations by week): https://us.posthog.com/project/394585/insights/3vIIJqiM

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-javascript_node/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
