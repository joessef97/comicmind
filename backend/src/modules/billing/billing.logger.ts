type BillingLogLevel = "info" | "warn" | "error";

export function logBillingEvent(
  level: BillingLogLevel,
  event: string,
  meta: Record<string, unknown> = {},
) {
  const payload = {
    scope: "billing",
    event,
    ...meta,
  };

  const message = JSON.stringify(payload);

  if (level === "error") {
    console.error(message);
    return;
  }

  if (level === "warn") {
    console.warn(message);
    return;
  }

  console.log(message);
}
