# Native build quick guide (iOS)

1. Build the web app:

```bash
npm run build
```

2. Sync web assets and native plugins into Capacitor projects:

```bash
npx cap sync
```

3. Open the iOS project in Xcode:

```bash
npx cap open ios
```

4. In Xcode:
- Choose a simulator or physical device
- Set signing/team details if needed
- Build and run

For Android, use `npx cap open android` and build from Android Studio.

## Stripe Webhook Setup (Pro activation)

1. In Stripe Dashboard, go to **Developers → Webhooks**.
2. Add endpoint:
   - `https://nearestwc.vercel.app/api/stripe-webhook`
3. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
4. Copy the signing secret and set it in Vercel env vars as:
   - `STRIPE_WEBHOOK_SECRET`
