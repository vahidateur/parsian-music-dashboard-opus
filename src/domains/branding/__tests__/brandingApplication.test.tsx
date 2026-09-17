// @vitest-environment jsdom
/**
 * Applying branding — the WRITE half of M8, plus the two surfaces that read it.
 *
 * WHY THIS FILE EXISTS, NEXT TO `branding.test.ts`
 *
 * The domain suite proves three things: the record persists, the repository
 * refuses invalid fields, and `applyBranding` writes a validated colour. M8's
 * authorization is narrower and stricter than all three: the persisted record
 * must be the identity the RUNNING APP applies, the write must reach the
 * document root, the design-system tokens must actually consume the four custom
 * properties, and the shell and the login screen must render the record rather
 * than the demo fixture that used to supply those strings.
 *
 * A seam with `zero consumers` was exactly the defect D2 was recorded to end —
 * a settings panel that saves an identity the product does not use — so the
 * assertions below are about EFFECT, not about the shape of the code:
 *
 *   - the shipped default name is «آموزشگاه موسیقی پارسیان» (the owner's
 *     decision, written as a literal rather than read back from a variable);
 *   - `applyBranding` writes exactly the four properties it owns, refuses
 *     anything that fails re-validation, per property, and never overwrites an
 *     already-validated value with a refused one;
 *   - the running app (`<App />`, the real boot chain) writes the persisted
 *     record onto `document.documentElement`, and a SAVED CHANGE reaches it;
 *   - `src/index.css` consumes each of the four properties with a fallback, so
 *     the tokens resolve through branding at runtime;
 *   - the sidebar and the login screen show the saved name and tagline and do
 *     NOT show the demo fixture's («آکادمی موسیقی آوا»), and a rename through
 *     the repository moves what they display.
 *
 * The stylesheet point is a source assertion on purpose. Tailwind compiles the
 * theme at build time and jsdom never loads the built stylesheet, so the honest
 * way to pin the wiring is to read the token file and require the `var(...)`
 * chain — the same technique `cspCompatibility.test.ts` uses when it parses what
 * the bundler really emitted instead of trusting that a policy reads securely.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, DemoAuthRepository } from "@/domains/auth/demoAuthRepository";
import { DemoUserRepository } from "@/domains/auth/userRepository";
import { resetRegistry, setAuthRepository, setUserRepository } from "@/domains/registry";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { LoginView } from "@/views/Login";
import { DemoBrandingRepository } from "../demoRepository";
import { DEFAULT_BRANDING } from "../types";
import { applyBranding } from "../useBranding";

/** The four custom properties the branding seam owns — no more, no fewer. */
const BRAND_PROPERTIES = ["--brand-primary", "--brand-accent", "--brand-text", "--brand-font-fa"] as const;

/** The demo fixture's identity: seed material, never the product's name. */
const FIXTURE_NAME = "آکادمی موسیقی آوا";

const onRoot = (property: string) => document.documentElement.style.getPropertyValue(property).toLowerCase();

const brandingRepo = () => new DemoBrandingRepository();

beforeEach(() => {
  /* Order matters: `clear()` wipes everything, so it runs before the dataset is
     seeded — the lifecycle harness explains why in `src/test/demoEnvironment.ts`. */
  localStorage.clear();
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  /* The applier writes onto the shared document root; leave it as it was. */
  for (const property of BRAND_PROPERTIES) document.documentElement.style.removeProperty(property);
});

describe("the shipped default identity", () => {
  it("ships «آموزشگاه موسیقی پارسیان» as the default academy name", () => {
    expect(DEFAULT_BRANDING.academyName).toBe("آموزشگاه موسیقی پارسیان");
  });

  it("ships a tagline, three hex colours and a supported Persian font", () => {
    expect(DEFAULT_BRANDING.tagline.length).toBeGreaterThan(0);
    for (const colour of [DEFAULT_BRANDING.primaryColor, DEFAULT_BRANDING.accentColor, DEFAULT_BRANDING.textColor]) {
      expect(colour).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
    expect(["Vazirmatn", "Estedad", "IranYekan", "Sahel"]).toContain(DEFAULT_BRANDING.persianFont);
  });

  it("keeps the shipped default in an EMPTY academy too — no fabricated identity", async () => {
    resetToEmptyEnvironment();
    const branding = await brandingRepo().get();
    expect(branding.academyName).toBe(DEFAULT_BRANDING.academyName);
    expect(branding.academyName).not.toBe(FIXTURE_NAME);
  });
});

describe("the write onto the document", () => {
  it("writes exactly the four properties it owns, and nothing else", () => {
    const root = document.createElement("div");
    applyBranding(
      {
        ...DEFAULT_BRANDING,
        primaryColor: "#112233",
        accentColor: "#223344",
        textColor: "#334455",
        persianFont: "Estedad",
      },
      root,
    );
    expect(root.style.getPropertyValue("--brand-primary")).toBe("#112233");
    expect(root.style.getPropertyValue("--brand-accent")).toBe("#223344");
    expect(root.style.getPropertyValue("--brand-text")).toBe("#334455");
    expect(root.style.getPropertyValue("--brand-font-fa")).toBe("Estedad");
    expect(root.style.length, "the seam invents no other property").toBe(4);
  });

  it("refuses a value that fails re-validation, per property", () => {
    const root = document.createElement("div");
    /* Simulates a restored backup predating the current validation rules. */
    applyBranding(
      {
        ...DEFAULT_BRANDING,
        primaryColor: "expression(evil)",
        accentColor: "#12345",
        textColor: "url(javascript:alert(1))",
        persianFont: "ComicSans",
      },
      root,
    );
    for (const property of BRAND_PROPERTIES) {
      expect(root.style.getPropertyValue(property), `${property} must stay unwritten`).toBe("");
    }
  });

  it("never overwrites an already-validated value with a refused one", () => {
    const root = document.createElement("div");
    applyBranding({ ...DEFAULT_BRANDING, primaryColor: "#112233" }, root);
    applyBranding({ ...DEFAULT_BRANDING, primaryColor: "javascript:alert(1)" }, root);
    expect(root.style.getPropertyValue("--brand-primary")).toBe("#112233");
  });
});

describe("the running app applies the persisted record", () => {
  it("writes the saved identity onto the document root", async () => {
    render(<App />);
    /* The login screen is where an unauthenticated visitor stops, and it is a
       surface M8 brands — so waiting for it also proves the applier mounted
       above the access path rather than inside the authenticated shell. */
    await screen.findByRole("textbox", { name: "ایمیل" });
    await waitFor(() => expect(onRoot("--brand-primary")).toBe(DEFAULT_BRANDING.primaryColor.toLowerCase()));
    expect(onRoot("--brand-accent")).toBe(DEFAULT_BRANDING.accentColor.toLowerCase());
    expect(onRoot("--brand-text")).toBe(DEFAULT_BRANDING.textColor.toLowerCase());
    expect(onRoot("--brand-font-fa")).toBe(DEFAULT_BRANDING.persianFont.toLowerCase());
  });

  it("applies a SAVED change — the write has a real effect, not just a toast", async () => {
    render(<App />);
    await screen.findByRole("textbox", { name: "ایمیل" });
    await waitFor(() => expect(onRoot("--brand-primary")).toBe(DEFAULT_BRANDING.primaryColor.toLowerCase()));

    await brandingRepo().update({ primaryColor: "#123456", persianFont: "Sahel" });

    await waitFor(() => expect(onRoot("--brand-primary")).toBe("#123456"));
    expect(onRoot("--brand-font-fa")).toBe("sahel");
    expect(onRoot("--brand-primary"), "the previous identity is gone, not merely shadowed").not.toBe(
      DEFAULT_BRANDING.primaryColor.toLowerCase(),
    );
  });
});

describe("the design-system tokens consume the brand properties", () => {
  const css = () => readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

  it("binds every one of the four, each with a fallback", () => {
    for (const property of BRAND_PROPERTIES) {
      /* `var(--brand-x, fallback)` — a bare `var(--brand-x)` with no fallback
         would blank the token whenever no branding record is readable. */
      expect(css(), `src/index.css must consume ${property} with a fallback`).toMatch(
        new RegExp(`var\\(\\s*${property}\\s*,`),
      );
    }
  });

  it("routes the DEFAULT accent scale through the brand colours, tier by tier", () => {
    const block = /:root,\s*\[data-accent="gold"\]\s*\{([\s\S]*?)\n\}/.exec(css());
    expect(block, "the default accent scale must exist as a block").toBeTruthy();
    const scale = block![1];
    /* The two tiers the model owns, used directly — not merely mentioned. */
    expect(scale).toMatch(/--accent-500:\s*var\(--brand-primary,/);
    expect(scale).toMatch(/--accent-300:\s*var\(--brand-accent,/);
    /* And the four derived tiers must resolve through them, so changing one
       branding colour moves the whole scale instead of leaving a stale gold. */
    for (const tier of ["200", "400", "600", "700"]) {
      expect(scale, `--accent-${tier} must derive from a brand colour`).toMatch(
        new RegExp(`--accent-${tier}:[^;]*var\\(--brand-(primary|accent),`),
      );
    }
  });

  it("keeps the pre-branding values as those fallbacks, so nothing changes without a record", () => {
    for (const fallback of ["#d4a853", "#efd89a", "#f5f0e8", '"Vazirmatn"']) {
      expect(css(), `the fallback ${fallback} must survive in the token file`).toContain(fallback);
    }
  });
});

/* ------------------------------------------------------------------ */
/* The two surfaces M8 rewires: shell chrome and the login screen.      */
/* ------------------------------------------------------------------ */

/** Signs in as the demo administrator, then renders the real sidebar. */
async function renderSidebar() {
  window.history.replaceState(null, "", "#/");
  const auth = new DemoAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new DemoUserRepository(demoStore));
  await auth.login({ email: "admin@demo.local", password: DEMO_PASSPHRASE });
  render(
    <AuthProvider repository={auth}>
      <AppProvider>
        <Sidebar mobileOpen={false} onClose={() => undefined} />
      </AppProvider>
    </AuthProvider>,
  );
  await waitFor(() => expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeTruthy());
}

describe("the shell renders the saved identity", () => {
  it("shows the branding name and tagline, and not the demo fixture's", async () => {
    await renderSidebar();
    expect(screen.getByText(DEFAULT_BRANDING.academyName)).toBeTruthy();
    /* The tagline is rendered with a suffix («· پنل مدیریت»), so it is matched
       as a fragment — on the row the branding value and nothing else. */
    const region = screen.getByText(DEFAULT_BRANDING.academyName).parentElement as HTMLElement;
    expect(region.textContent).toContain(DEFAULT_BRANDING.tagline);
    expect(screen.queryAllByText(/آکادمی موسیقی آوا/), "the fixture identity must not be rendered").toHaveLength(0);
    expect(screen.queryAllByText(/سامانهٔ یکپارچهٔ آموزشگاه/)).toHaveLength(0);
  });

  it("moves when the stored identity changes — a rename is rendered, not cached", async () => {
    await renderSidebar();
    await brandingRepo().update({ academyName: "آموزشگاه موسیقی نوا", tagline: "موسیقی برای همه" });
    expect(await screen.findByText("آموزشگاه موسیقی نوا")).toBeTruthy();
    expect(screen.queryAllByText(/آکادمی موسیقی آوا/)).toHaveLength(0);
  });
});

describe("the login screen renders the saved identity", () => {
  it("shows the branding name and tagline, and not the demo fixture's", async () => {
    render(
      <AuthProvider>
        <LoginView />
      </AuthProvider>,
    );
    await screen.findByRole("textbox", { name: "ایمیل" });
    expect(screen.getByText(`© ${new Date().getFullYear()} ${DEFAULT_BRANDING.academyName}`)).toBeTruthy();
    expect(screen.getByText(DEFAULT_BRANDING.tagline)).toBeTruthy();
    expect(screen.queryAllByText(/آکادمی موسیقی آوا/)).toHaveLength(0);
    expect(screen.queryAllByText(/سامانهٔ یکپارچهٔ آموزشگاه/)).toHaveLength(0);
  });

  it("moves when the stored identity changes", async () => {
    render(
      <AuthProvider>
        <LoginView />
      </AuthProvider>,
    );
    await screen.findByRole("textbox", { name: "ایمیل" });
    await brandingRepo().update({ academyName: "آموزشگاه موسیقی نوا", tagline: "موسیقی برای همه" });
    expect(await screen.findByText("موسیقی برای همه")).toBeTruthy();
    expect(screen.getByText(`© ${new Date().getFullYear()} آموزشگاه موسیقی نوا`)).toBeTruthy();
  });
});
