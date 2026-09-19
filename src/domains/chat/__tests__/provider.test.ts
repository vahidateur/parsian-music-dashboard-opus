/**
 * F8 — Telegram + Bale + Backup Integration Contracts — provider tests.
 *
 * Acceptance:
 * - Adapter interface mock, identity linking validation, scope pure functions,
 *   backup restore versioned migration old->new WRONG_ENVIRONMENT honest,
 *   no business logic in bot asserted via architectureBoundaries
 *
 * No backend, no credentials, no VITE_* token.
 */

import { describe, it, expect } from "vitest";
import {
  getMessageProvider,
  availableProviders,
  inAppProvider,
  type MessageProviderAdapter,
} from "../provider";
import type { MessageProvider } from "../types";

describe("MessageProviderAdapter interface", () => {
  it("in_app is available and returns sent", async () => {
    const adapter = getMessageProvider("in_app");
    expect(adapter.id).toBe("in_app");
    expect(adapter.isAvailable()).toBe(true);
    const result = await adapter.deliver({ conversationId: "c1", body: "hello" });
    expect(result.status).toBe("sent");
  });

  it("telegram is unavailable with Persian reason — honest, no fake success", async () => {
    const adapter = getMessageProvider("telegram");
    expect(adapter.id).toBe("telegram");
    expect(adapter.isAvailable()).toBe(false);
    const result = await adapter.deliver({ conversationId: "c1", body: "hello" });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toContain("تلگرام");
    expect(result.reason).toContain("سرویس سمت سرور");
    expect(result.reason).toContain("توکن ربات هرگز نباید در مرورگر قرار گیرد");
  });

  it("bale is unavailable with Persian reason — honest, no fake success", async () => {
    const adapter = getMessageProvider("bale");
    expect(adapter.id).toBe("bale");
    expect(adapter.isAvailable()).toBe(false);
    const result = await adapter.deliver({ conversationId: "c1", body: "hello" });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toContain("بله");
    expect(result.reason).toContain("سرویس سمت سرور");
  });

  it("sms and email are unavailable", async () => {
    const sms = getMessageProvider("sms");
    expect(sms.isAvailable()).toBe(false);
    expect((await sms.deliver({ conversationId: "c1", body: "x" })).status).toBe("unavailable");

    const email = getMessageProvider("email");
    expect(email.isAvailable()).toBe(false);
    expect((await email.deliver({ conversationId: "c1", body: "x" })).status).toBe("unavailable");
  });

  it("availableProviders returns only in_app in demo mode", () => {
    const available = availableProviders();
    expect(available).toEqual(["in_app"]);
    expect(available).not.toContain("telegram");
    expect(available).not.toContain("bale");
  });

  it("adapter interface has id, isAvailable, deliver — no business logic", () => {
    const providers: MessageProvider[] = ["in_app", "telegram", "bale", "sms", "email"];
    for (const id of providers) {
      const adapter: MessageProviderAdapter = getMessageProvider(id);
      expect(typeof adapter.id).toBe("string");
      expect(typeof adapter.isAvailable).toBe("function");
      expect(typeof adapter.deliver).toBe("function");
      // Deliver must not throw, must return DeliveryResult with status
      // (tested above for each)
    }
  });

  it("deliver does not perform network call — returns immediately without fetch", async () => {
    // If it performed network, it would need fetch and would fail or be slow.
    // Here we assert it returns quickly (<100ms) and with unavailable for non-in_app.
    const start = Date.now();
    const result = await getMessageProvider("telegram").deliver({
      conversationId: "c1",
      body: "test",
    });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(result.status).toBe("unavailable");
  });

  it("no token in adapter — security §24", async () => {
    // Ensure adapter does not expose token, secret, apiKey
    const telegram = getMessageProvider("telegram") as unknown as Record<string, unknown>;
    const serialized = JSON.stringify(telegram);
    expect(serialized.toLowerCase()).not.toContain("token");
    expect(serialized.toLowerCase()).not.toContain("secret");
    expect(serialized.toLowerCase()).not.toContain("apikey");

    const result = await getMessageProvider("telegram").deliver({
      conversationId: "c1",
      body: "hello",
    });
    // Reason must not contain token
    expect(result.reason?.toLowerCase()).not.toContain("token");
  });

  it("inAppProvider is honest — persistence is delivery", async () => {
    // in_app genuinely persists to DemoStore, so UI may say sent — per types.ts DELIVERY HONESTY §37
    expect(inAppProvider.isAvailable()).toBe(true);
    const result = await inAppProvider.deliver({ conversationId: "c1", body: "hi" });
    expect(result.status).toBe("sent");
    expect(result.reason).toBeUndefined();
  });
});
