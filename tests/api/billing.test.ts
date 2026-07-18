import crypto from "crypto";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadTestApp } from "../helpers/test-app";
import { makeTestToken } from "../helpers/auth";
import { testMocks } from "../helpers/mock-modules";

vi.mock("../../backend/src/modules/auth/auth.model", () => ({ UserModel: testMocks.userModel }));
vi.mock("../../backend/src/modules/billing/paddle-event.model", () => ({
  PaddleEventModel: testMocks.paddleEventModel,
}));

function paddleSignature(body: string, secret: string) {
  const ts = Math.floor(Date.now() / 1000).toString();
  const h1 = crypto.createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

describe("billing endpoints", () => {
  let app: Awaited<ReturnType<typeof loadTestApp>>;
  const token = makeTestToken("user-1");

  beforeAll(async () => {
    process.env.PADDLE_WEBHOOK_SECRET = "test-webhook-secret";
    process.env.PADDLE_STARTER_PRICE_ID = "pri_starter";
    process.env.PADDLE_PRO_PRICE_ID = "pri_pro";
    process.env.PADDLE_CREATOR_PRICE_ID = "pri_creator";
    app = await loadTestApp();
  });

  beforeEach(() => {
    testMocks.paddleEventModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });
    testMocks.paddleEventModel.create.mockResolvedValue({});
  });

  it("returns configured Paddle pricing plans", async () => {
    const response = await request(app).get("/api/billing/plans");

    expect(response.status).toBe(200);
    expect(response.body.plans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "starter", priceId: "pri_starter" }),
        expect.objectContaining({ key: "pro", priceId: "pri_pro" }),
        expect.objectContaining({ key: "creator", priceId: "pri_creator" }),
      ]),
    );
  });

  it("updates a user when a verified Paddle subscription is created", async () => {
    const payload = {
      event_id: "evt_subscription_created",
      event_type: "subscription.created",
      data: {
        id: "sub_123",
        customer_id: "ctm_123",
        custom_data: { userId: "user-1" },
        items: [{ price: { id: "pri_pro" } }],
        current_billing_period: { ends_at: "2026-08-18T00:00:00Z" },
      },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(testMocks.userModel.updateOne).toHaveBeenCalledWith(
      { _id: "user-1" },
      {
        $set: expect.objectContaining({
          "subscription.plan": "pro",
          "subscription.status": "active",
          "subscription.subscriptionId": "sub_123",
          "subscription.customerId": "ctm_123",
          "subscription.priceId": "pri_pro",
          "usage.monthlyComicLimit": 5,
          "usage.comicsGeneratedThisMonth": 0,
        }),
      },
    );
    expect(testMocks.paddleEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "evt_subscription_created",
        eventType: "subscription.created",
      }),
    );
  });

  it("rejects webhooks with invalid Paddle signatures", async () => {
    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", "ts=123;h1=bad")
      .send({ event_type: "subscription.created", data: {} });

    expect(response.status).toBe(401);
  });

  it("ignores duplicate webhook delivery", async () => {
    testMocks.paddleEventModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ eventId: "evt_duplicate" }),
    });

    const payload = {
      event_id: "evt_duplicate",
      event_type: "subscription.canceled",
      data: { id: "sub_123" },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
    expect(testMocks.userModel.updateOne).not.toHaveBeenCalled();
  });

  it("marks subscriptions past due after failed renewal payments", async () => {
    const payload = {
      event_id: "evt_payment_failed",
      event_type: "transaction.payment_failed",
      data: {
        subscription_id: "sub_123",
        billing_period: { ends_at: "2026-08-18T00:00:00Z" },
      },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(testMocks.userModel.updateOne).toHaveBeenCalledWith(
      { "subscription.subscriptionId": "sub_123" },
      {
        $set: expect.objectContaining({
          "subscription.status": "past_due",
          "usage.monthlyComicLimit": 0,
        }),
      },
    );
  });

  it("resets usage only after successful renewal payment", async () => {
    const payload = {
      event_id: "evt_renewal_paid",
      event_type: "transaction.completed",
      data: {
        subscription_id: "sub_123",
        customer_id: "ctm_123",
        items: [{ price: { id: "pri_creator" } }],
        billing_period: { ends_at: "2026-08-18T00:00:00Z" },
      },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(testMocks.userModel.updateOne).toHaveBeenCalledWith(
      { "subscription.subscriptionId": "sub_123" },
      {
        $set: expect.objectContaining({
          "subscription.status": "active",
          "usage.monthlyComicLimit": 15,
          "usage.comicsGeneratedThisMonth": 0,
        }),
      },
    );
  });

  it("returns users to free when Paddle cancels a subscription", async () => {
    const payload = {
      event_id: "evt_cancel",
      event_type: "subscription.canceled",
      data: { id: "sub_123" },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(testMocks.userModel.updateOne).toHaveBeenCalledWith(
      { "subscription.subscriptionId": "sub_123" },
      {
        $set: expect.objectContaining({
          "subscription.plan": "free",
          "subscription.status": "inactive",
          "usage.monthlyComicLimit": 0,
          "usage.comicsGeneratedThisMonth": 0,
        }),
      },
    );
  });

  it("restores access when Paddle recovers a past due subscription", async () => {
    const payload = {
      event_id: "evt_recovered",
      event_type: "subscription.updated",
      data: {
        id: "sub_123",
        customer_id: "ctm_123",
        status: "active",
        items: [{ price: { id: "pri_starter" } }],
      },
    };
    const body = JSON.stringify(payload);

    const response = await request(app)
      .post("/api/billing/webhook")
      .set("Paddle-Signature", paddleSignature(body, process.env.PADDLE_WEBHOOK_SECRET!))
      .set("Content-Type", "application/json")
      .send(body);

    expect(response.status).toBe(200);
    expect(testMocks.userModel.updateOne).toHaveBeenCalledWith(
      { "subscription.subscriptionId": "sub_123" },
      {
        $set: expect.objectContaining({
          "subscription.status": "active",
          "subscription.plan": "starter",
          "usage.monthlyComicLimit": 3,
        }),
      },
    );
    expect(testMocks.userModel.updateOne.mock.calls[0][1].$set).not.toHaveProperty(
      "usage.comicsGeneratedThisMonth",
    );
  });

  it("blocks checkout for active subscribers", async () => {
    testMocks.userModel.findById.mockResolvedValue({
      subscription: {
        plan: "pro",
        status: "active",
        subscriptionId: "sub_123",
        customerId: "ctm_123",
      },
    });

    const response = await request(app)
      .get("/api/billing/checkout-eligibility")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      canCheckout: false,
      reason: "active_subscription",
      hasCustomerPortal: true,
    });
  });
});
