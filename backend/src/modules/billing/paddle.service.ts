const PADDLE_API_VERSION = "1";

function getPaddleApiBaseUrl() {
  return process.env.PADDLE_ENVIRONMENT === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
}

export async function paddleApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY is not configured");
  }

  const response = await fetch(`${getPaddleApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Paddle-Version": PADDLE_API_VERSION,
      ...(options.headers || {}),
    },
  });

  const body = await response.text();
  const payload = body ? JSON.parse(body) : {};

  if (!response.ok) {
    const detail = payload?.error?.detail || payload?.error?.message || response.statusText;
    throw new Error(`Paddle API request failed: ${detail}`);
  }

  return payload as T;
}

export async function createCustomerPortalSession(customerId: string, subscriptionId?: string) {
  const payload = await paddleApiRequest<{
    data: {
      urls: {
        general: { overview: string };
        subscriptions?: Array<{
          id: string;
          cancel_subscription?: string;
          update_subscription_payment_method?: string;
        }>;
      };
    };
  }>(`/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: "POST",
    body: subscriptionId ? JSON.stringify({ subscription_ids: [subscriptionId] }) : undefined,
  });

  return payload.data.urls;
}
