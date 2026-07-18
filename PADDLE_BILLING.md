# ComicMind Paddle Billing Setup

ComicMind uses Paddle Billing for monthly subscriptions. Stripe is not used.

## Paddle Catalog

Create three recurring monthly products and prices in Paddle:

| Product | Price | Env var |
| --- | --- | --- |
| ComicMind Starter | USD 4.99/month | `PADDLE_STARTER_PRICE_ID` |
| ComicMind Pro | USD 7.99/month | `PADDLE_PRO_PRICE_ID` |
| ComicMind Creator | USD 19.99/month | `PADDLE_CREATOR_PRICE_ID` |

Do not configure annual billing or free trials.

## Required Environment Variables

Backend:

```bash
PADDLE_ENVIRONMENT=sandbox
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_STARTER_PRICE_ID=
PADDLE_PRO_PRICE_ID=
PADDLE_CREATOR_PRICE_ID=
```

Frontend:

```bash
VITE_PADDLE_CLIENT_TOKEN=
VITE_PADDLE_ENVIRONMENT=sandbox
```

Use `sandbox` while testing. For production, omit `sandbox` or set the environment to production and use live Paddle credentials.

## Webhook Destination

Create a Paddle notification destination pointing to:

```text
https://your-domain.com/api/billing/webhook
```

Subscribe to these events:

```text
transaction.completed
transaction.payment_failed
transaction.past_due
subscription.created
subscription.updated
subscription.past_due
subscription.canceled
subscription.expired
subscription.paused
subscription.resumed
```

Copy the destination secret into `PADDLE_WEBHOOK_SECRET`. Every webhook is verified with `Paddle-Signature` before processing.

## Checkout Flow

1. The Pricing page loads plan metadata from `GET /api/billing/plans`.
2. When a signed-in user clicks Subscribe, the frontend calls `GET /api/billing/checkout-eligibility`.
3. If the user already has an active subscription, the frontend creates a customer portal session with `POST /api/billing/portal-session` and redirects the user to Paddle.
4. If checkout is allowed, Paddle Checkout opens with the selected price ID and `customData.userId`.
5. Account access is not granted by the browser. Access changes only after verified Paddle webhooks are processed.

## Webhook Flow

1. `POST /api/billing/webhook` receives Paddle notifications.
2. The handler verifies `Paddle-Signature` using the raw request body and `PADDLE_WEBHOOK_SECRET`.
3. The handler checks `PaddleEvent.eventId` to ignore duplicate deliveries.
4. After successful processing, the event ID is stored so Paddle retries do not double-apply state changes.
5. Processing emits structured JSON billing logs for observability.

## Renewal Flow

ComicMind never resets usage because the calendar month changes.

`usage.comicsGeneratedThisMonth` resets only when Paddle sends a verified successful payment event:

```text
transaction.completed
```

For existing subscriptions, this event is matched by `subscription_id`. The active plan and limit are refreshed from the Paddle price ID, then monthly usage is reset to zero.

## Failed Payment And Recovery Flow

Failed renewal payments are handled with:

```text
transaction.payment_failed
transaction.past_due
subscription.past_due
```

These set:

```json
{
  "subscription.status": "past_due",
  "usage.monthlyComicLimit": 0
}
```

The generation middleware only allows `subscription.status === "active"`, so past-due, paused, inactive, canceled, and expired subscriptions cannot generate premium comics.

If Paddle payment recovery succeeds, Paddle sends `subscription.updated` with `status: "active"`. ComicMind restores the matching plan limit from the price ID without resetting usage. The next successful renewal payment resets usage.

## Cancellation Flow

`subscription.canceled` and `subscription.expired` return the account to:

```json
{
  "subscription": {
    "plan": "free",
    "status": "inactive",
    "subscriptionId": "",
    "priceId": "",
    "nextBillingDate": null
  },
  "usage": {
    "monthlyComicLimit": 0,
    "comicsGeneratedThisMonth": 0
  }
}
```

Scheduled cancellations remain active until Paddle changes the subscription status and sends the final cancellation event.

## User State

Each user stores Paddle subscription state and monthly usage:

```json
{
  "subscription": {
    "plan": "free",
    "status": "inactive",
    "subscriptionId": "",
    "customerId": "",
    "priceId": "",
    "nextBillingDate": null
  },
  "usage": {
    "monthlyComicLimit": 0,
    "comicsGeneratedThisMonth": 0
  }
}
```

Paddle checkout sends `customData.userId`, so webhook events can upgrade the correct ComicMind account.

## Usage Rules

Comic creation is protected by `requireAvailableComicGeneration`.

When a saved comic is created, `usage.comicsGeneratedThisMonth` increments by one. If usage reaches the monthly limit, the API returns HTTP 403:

```text
Monthly limit reached. Upgrade your subscription or wait until your subscription renews.
```

When Paddle sends a new completed transaction or subscription creation event, usage resets to zero and the active plan limit is applied. When Paddle sends `subscription.canceled` or `subscription.expired`, the account returns to the free plan.

## Rate Limiting And Abuse Protection

Expensive AI generation endpoints use `aiLimiter`, currently configured for 20 generation requests per hour per client. The limiter can be disabled only outside production with `BENCHMARK_MODE=true` or `DISABLE_RATE_LIMIT=true`.

Comic creation also checks subscription status and monthly quota immediately before saving.

## Deployment Checklist

- Create Paddle products and monthly prices for Starter, Pro, and Creator.
- Set all backend Paddle environment variables.
- Set `VITE_PADDLE_CLIENT_TOKEN` and `VITE_PADDLE_ENVIRONMENT` for the frontend build.
- Configure Paddle website approval for the deployed domain.
- Configure the webhook destination and copy its endpoint secret.
- Confirm webhook delivery for successful payment, failed payment, recovery, cancellation, and duplicate retry scenarios.
- Run `tsc --noEmit`.
- Run `vitest run tests/api --hookTimeout=30000`.
- Confirm production has `NODE_ENV=production` and does not set `DISABLE_RATE_LIMIT=true`.
