import crypto from "crypto";

const DEFAULT_WEBHOOK_TOLERANCE_SECONDS = 300;

function parsePaddleSignature(header: string) {
  const parts = header.split(";").reduce<Record<string, string[]>>((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || !value) return acc;
    acc[key] = [...(acc[key] || []), value];
    return acc;
  }, {});

  return {
    timestamp: parts.ts?.[0],
    signatures: parts.h1 || [],
  };
}

function timingSafeEqualHex(a: string, b: string) {
  const aBuffer = Buffer.from(a, "hex");
  const bBuffer = Buffer.from(b, "hex");
  return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyPaddleWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
  toleranceSeconds = DEFAULT_WEBHOOK_TOLERANCE_SECONDS,
}: {
  rawBody: Buffer;
  signatureHeader?: string | string[];
  secret: string;
  toleranceSeconds?: number;
}) {
  const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
  if (!header || !secret) return false;

  const { timestamp, signatures } = parsePaddleSignature(header);
  if (!timestamp || signatures.length === 0) return false;

  const timestampNumber = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampNumber)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampNumber);
  if (ageSeconds > toleranceSeconds) return false;

  const signedPayload = `${timestamp}:${rawBody.toString("utf8")}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");

  return signatures.some((signature) => timingSafeEqualHex(expectedSignature, signature));
}
