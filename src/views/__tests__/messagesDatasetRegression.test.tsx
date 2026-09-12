// @vitest-environment jsdom
/**
 * Messages — regression for the reported crash.
 *
 *   URL:   #/messages
 *   Error: بارگذاری گفتگوها ناموفق بود
 *          Cannot read properties of undefined (reading 'filter')
 *
 * Root cause: a dataset persisted by an older build has no `chatConversations`
 * collection, and `snapshot()` handed it to the repository verbatim (see
 * `services/__tests__/demoStoreMigration.test.ts`). These tests pin the
 * user-visible outcome: the thread list loads, an empty thread list is a valid
 * state, sending still persists, and a genuine repository failure is STILL
 * reported — the fix repairs the data contract, it does not hide errors.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { MessagesView } from "@/views/Messages";
import { DemoChatRepository } from "@/domains/chat/demoRepository";
import type { ChatRepository } from "@/domains/chat/repository";
import { getChatRepository, resetRegistry, setChatRepository } from "@/domains/registry";
import { createEmptyDataset, createSeedDataset } from "@/domains/demo/seed";
import { DEMO_COLLECTIONS, type DemoDataset } from "@/domains/demo/types";
import { DEMO_STORAGE_KEY, demoStore, migrateDataset } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

const ERROR_TITLE = "بارگذاری گفتگوها ناموفق بود";

/** The collections a pre-migration build persisted. */
const LEGACY_COLLECTIONS = [
  "rooms",
  "teachers",
  "students",
  "classes",
  "enrollments",
  "sessions",
  "attendance",
  "invoices",
  "payments",
  "conversations",
  "resources",
  "users",
  "roles",
] as const;

/** Persists a dataset exactly as an older build would have written it. */
function installLegacyPayload(): void {
  const full = createSeedDataset() as unknown as Record<string, unknown>;
  const legacy: Record<string, unknown> = { organization: full.organization };
  for (const key of LEGACY_COLLECTIONS) legacy[key] = full[key];
  localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(legacy));
}

function renderMessages() {
  window.location.hash = "#/messages";
  return render(
    <AppProvider>
      <MessagesView />
    </AppProvider>,
  );
}

async function waitForThreads() {
  await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());
}

/** A repository whose thread list genuinely fails, everything else real. */
function failingChatRepository(message: string): ChatRepository {
  const real: ChatRepository = new DemoChatRepository();
  return {
    listConversations: () =>
      Promise.reject(new ApiError({ kind: "server", status: 500, code: "CHAT_UNAVAILABLE", message })),
    getConversation: (id, signal) => real.getConversation(id, signal),
    createConversation: (input) => real.createConversation(input),
    updateConversation: (id, patch) => real.updateConversation(id, patch),
    archiveConversation: (id) => real.archiveConversation(id),
    listMessages: (params, signal) => real.listMessages(params, signal),
    sendMessage: (input) => real.sendMessage(input),
    markRead: (id) => real.markRead(id),
  };
}

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

describe("messages on a dataset persisted by an older build", () => {
  it("loads the thread list instead of crashing on undefined.filter", async () => {
    installLegacyPayload();
    renderMessages();
    await waitForThreads();

    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    expect(document.body.textContent).not.toContain("Cannot read properties of undefined");

    // Real threads from the migrated dataset, not an empty fallback. The first
    // thread is also selected, so its name renders twice (list row + header):
    // `findAllByText` rather than `findByText`, which would be timing-dependent.
    const page = await getChatRepository().listConversations({ per_page: 100 });
    expect(page.meta.total).toBeGreaterThan(0);
    expect(await screen.findAllByText(page.data[0].name)).not.toHaveLength(0);
  });

  it("still sends and persists a message", async () => {
    installLegacyPayload();
    renderMessages();
    await waitForThreads();

    const box = await screen.findByLabelText("متن پیام");
    fireEvent.change(box, { target: { value: "پیام پس از مهاجرت داده" } });
    fireEvent.click(screen.getByRole("button", { name: /ارسال/ }));

    await screen.findByText("پیام پس از مهاجرت داده");

    const threads = await getChatRepository().listConversations({ per_page: 50 });
    const messages = await getChatRepository().listMessages({ conversationId: threads.data[0].id, per_page: 200 });
    expect(messages.data.some((m) => m.body === "پیام پس از مهاجرت داده")).toBe(true);
  });
});

describe("messages on a dataset with no conversations", () => {
  it("renders the empty state rather than an error", async () => {
    // Zero threads is a valid environment, not a failure.
    demoStore.replace(createEmptyDataset());
    renderMessages();
    await waitForThreads();

    expect(screen.queryByText(ERROR_TITLE)).toBeNull();
    await screen.findByText("گفتگویی پیدا نشد");
  });

  it("keeps every collection an array after clearing", () => {
    demoStore.replace(createEmptyDataset());
    const snapshot = demoStore.snapshot();
    for (const name of DEMO_COLLECTIONS) expect(Array.isArray(snapshot[name])).toBe(true);
    expect(snapshot.chatConversations).toHaveLength(0);
  });
});

describe("messages on the shipped demo dataset", () => {
  it("shows the seeded conversations", async () => {
    renderMessages();
    await waitForThreads();

    const page = await getChatRepository().listConversations({ per_page: 100 });
    expect(page.meta.total).toBeGreaterThan(0);
    for (const thread of page.data.slice(0, 3)) {
      expect(await screen.findAllByText(thread.name)).not.toHaveLength(0);
    }
  });
});

describe("error honesty", () => {
  it("still reports a genuine repository failure", async () => {
    // The migration fixes the DATA contract. It must not become a blanket
    // catch that turns a real backend failure into a silent empty list.
    setChatRepository(failingChatRepository("سرور گفتگوها پاسخ نداد."));
    renderMessages();

    await screen.findByText(ERROR_TITLE);
    expect(document.body.textContent).toContain("سرور گفتگوها پاسخ نداد.");
  });

  it("migration never invents rows for a dataset that is already complete", () => {
    const dataset = createSeedDataset();
    const before = dataset.chatConversations.length;
    const { dataset: after, migrated } = migrateDataset(dataset as DemoDataset);
    expect(migrated).toBe(false);
    expect(after.chatConversations).toHaveLength(before);
  });
});
