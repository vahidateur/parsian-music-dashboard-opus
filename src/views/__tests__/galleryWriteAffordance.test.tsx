// @vitest-environment jsdom
/**
 * The gallery view's permission banner follows `gallery.write` — and only it.
 *
 * The banner once read `!bytes.unavailable && !canWrite ? null : <note/>`,
 * which is backwards: a writer saw "you may not change the gallery" while a
 * reader saw nothing. These cases assert the behaviour, not the gate's shape:
 *
 *   - with `gallery.write` (manager) the note is absent and the add controls
 *     are enabled;
 *   - without it (staff) the note names the missing capability and the add
 *     controls are disabled.
 *
 * The sessions are real (`LocalAuthRepository`, the seeded demo users) and the
 * gallery rows are the real demo seed; every assertion is made on what the
 * operator can actually reach in the DOM.
 */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/targets/galleryProvisioning", () => ({
  // Bytes available: the permission branch — not the blob-store branch — is
  // what this file pins. (In plain jsdom the bundled-photo provisioning
  // cannot run, so without this the view always reports its store
  // unavailable and the permission note never renders either way.)
  useDemoGalleryBytes: () => ({ settled: true, unavailable: false }),
}));

import { AppProvider } from "@/context/AppContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { GalleryView } from "@/views/Gallery";

const MANAGER = "manager@demo.local";
const STAFF = "desk@demo.local";

const BANNER = /حساب شما حق تغییر در گالری ندارد/;

/** Signs in as a real seeded user; the view reads the session, not a stub. */
async function signInAs(email: string) {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  await auth.login({ email, password: DEMO_PASSPHRASE });
}

function renderGallery() {
  return render(
    <AuthProvider>
      <AppProvider>
        <GalleryView />
      </AppProvider>
    </AuthProvider>,
  );
}

async function settled() {
  await waitFor(() => expect(screen.queryByText("در حال باز کردن تالار گالری…")).toBeNull());
}

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  // jsdom implements neither of these; without them the view reports its
  // blob store unavailable and the permission branch never renders.
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  }
});
afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("the gallery permission banner", () => {
  it("stays silent for a writer and enables the add controls", async () => {
    await signInAs(MANAGER);
    renderGallery();
    await settled();

    expect(screen.queryByText(BANNER)).toBeNull();
    for (const button of screen.getAllByRole("button", { name: /افزودن تصویر/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("names the missing capability for a reader and disables the add controls", async () => {
    await signInAs(STAFF);
    renderGallery();
    await settled();

    expect(screen.getByText(BANNER)).toBeDefined();
    for (const button of screen.getAllByRole("button", { name: /افزودن تصویر/ })) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
