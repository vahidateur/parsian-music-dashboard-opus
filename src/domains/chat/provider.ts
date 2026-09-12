/**
 * Message-provider abstraction.
 *
 * The UI never knows which transport a message takes. It calls the chat
 * repository, which asks the registry for a provider and reports back whatever
 * the provider honestly returns.
 *
 * WHY THE UI IS NOT COUPLED TO TELEGRAM/BALE
 *
 * Telegram and Bale are bot APIs driven by a bot token. A token shipped to a
 * browser is a published credential — anyone can read it from the bundle and
 * take over the bot. They also require a webhook endpoint to receive updates,
 * which a static SPA cannot host. Both therefore MUST be server-side, and the
 * only correct frontend artifact is this contract plus an adapter that states
 * the capability is unavailable until the backend exists.
 *
 * SECURITY (§24): no bot token, chat id, or provider secret may appear in React
 * code, a `VITE_*` variable, localStorage, or committed demo data. `VITE_*`
 * values are inlined into the bundle at build time and are NOT secret.
 *
 * BACKEND REQUIRED to implement any non-`in_app` provider:
 *   POST /messages                      — enqueue an outbound message
 *   GET  /messages/{id}                 — delivery status
 *   POST /webhooks/telegram             — receive updates (server-only)
 *   POST /webhooks/bale                 — receive updates (server-only)
 * The server holds the credentials, enforces per-provider rate limits, maps
 * academy contacts to provider chat ids, and persists delivery receipts.
 *
 * Provider APIs were NOT researched or relied upon in this phase: nothing here
 * hardcodes an endpoint, payload shape, or rate limit. Per the brief, that
 * research happens when the integration is actually built server-side, so no
 * outdated or invented endpoint is baked into the frontend.
 */
import type { MessageProvider, MessageStatus } from "./types";

/** What a provider reports after being asked to deliver. */
export interface DeliveryResult {
  status: MessageStatus;
  /** Operator-facing explanation; required whenever status is not `sent`. */
  reason?: string;
}

/**
 * One transport. Implementations must be honest: an adapter that cannot
 * deliver returns `unavailable`, and never `sent`.
 */
export interface MessageProviderAdapter {
  readonly id: MessageProvider;
  /** False when the adapter cannot deliver in the current environment. */
  isAvailable(): boolean;
  deliver(input: { conversationId: string; body: string }): Promise<DeliveryResult>;
}

/**
 * In-app delivery. Genuinely "delivers" because persistence to the demo store
 * *is* the delivery mechanism for an in-app thread — the recipient reads the
 * same store. The repository performs the write; this adapter just confirms
 * the transport is real.
 */
export const inAppProvider: MessageProviderAdapter = {
  id: "in_app",
  isAvailable: () => true,
  deliver: async () => ({ status: "sent" }),
};

/**
 * Adapter for every transport that needs server infrastructure.
 *
 * It deliberately performs no network call. Returning `unavailable` with a
 * concrete reason is the honest answer (§37) — the alternative, a `setTimeout`
 * that resolves to "sent", would be exactly the fake success the brief forbids.
 */
function backendRequiredProvider(id: MessageProvider, reason: string): MessageProviderAdapter {
  return {
    id,
    isAvailable: () => false,
    deliver: async () => ({ status: "unavailable", reason }),
  };
}

const ADAPTERS: Record<MessageProvider, MessageProviderAdapter> = {
  in_app: inAppProvider,
  telegram: backendRequiredProvider(
    "telegram",
    "ارسال از طریق تلگرام به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد.",
  ),
  bale: backendRequiredProvider(
    "bale",
    "ارسال از طریق بله به سرویس سمت سرور نیاز دارد؛ توکن ربات هرگز نباید در مرورگر قرار گیرد.",
  ),
  sms: backendRequiredProvider("sms", "ارسال پیامک به درگاه سمت سرور نیاز دارد."),
  email: backendRequiredProvider("email", "ارسال ایمیل به سرویس سمت سرور نیاز دارد."),
};

export function getMessageProvider(id: MessageProvider): MessageProviderAdapter {
  return ADAPTERS[id];
}

/** Providers that can actually deliver right now — used to build the UI picker. */
export function availableProviders(): MessageProvider[] {
  return (Object.keys(ADAPTERS) as MessageProvider[]).filter((id) => ADAPTERS[id].isAvailable());
}
