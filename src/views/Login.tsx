import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldAlert, TriangleAlert } from "lucide-react";
import { useBranding } from "@/domains/branding/useBranding";
import { useAuth } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { isDemoMode } from "@/api/config";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { useLifecycleRecovery } from "@/components/lifecycle/LifecycleRecoveryContext";
import { LifecycleRecoveryPanel } from "@/components/lifecycle/LifecycleRecoveryPanel";
import { DemoBackedNotice } from "@/components/shell/DemoBackedNotice";
import { roleLabels } from "@/domains/auth/permissions";
import hallImage from "@/assets/login-hall.jpg";
import { checkThrottle, describeWait, type ThrottleVerdict } from "@/security/loginThrottle";
import { cn } from "@/utils/cn";

/**
 * Login — Persian-first, RTL, the academy entrance.
 *
 * ART DIRECTION. The whole viewport is the hall: `login-hall.jpg` (gothic
 * nave, window light, grand piano, burgundy drape, candlelight — the same
 * stage identity the product has always carried, staged as an old academy)
 * fills the frame at every breakpoint, scrimmed on the left so the
 * credential plaque floats over the shadowed aisle exactly as the brand
 * composition intends. Dust drifts through the window light; grain and a
 * vignette close the frame. The plaque itself is a chamfered obsidian plate
 * with a brass edge, an inner hairline and a crest on its top edge.
 * Every atmospheric layer lives in `src/index.css` ("academy entrance") and
 * is `aria-hidden` here.
 *
 * LAYOUT: on large screens the plaque column is inset from the LEFT edge
 * (the inline-END side of this RTL document) and the branding column —
 * lyre, PARSIAN / MUSIC ACADEMY, motto — holds the RIGHT, over the hall.
 * That relationship (form inline-end, brand inline-start) is unchanged from
 * the previous composition; nothing here re-orders the two sides for an
 * assumed layout model. Below `lg` the hall becomes a dimmed full-bleed
 * backdrop and the columns stack, so the identity survives on a phone
 * without costing a second image request.
 *
 * SHORT VIEWPORTS (preserved fix): `min-h-svh` on both the page and the flex
 * row, a `max-height:700px` compaction of paddings/controls, and a failed
 * submit scrolls the submit/error pair back into view (`submitRef`) so the
 * alert can never push its own explanation below the fold.
 *
 * TYPOGRAPHY: Persian is always Vazirmatn. The Latin wordmark
 * (PARSIAN / MUSIC ACADEMY) uses the system old-style serif stack
 * (`--font-display`); it has no Persian glyphs, so Persian is never set in
 * it — that would silently fall back to a different face mid-sentence.
 *
 * MOTION: entrance, dust and the window-light breathe are decorative and
 * freeze under `prefers-reduced-motion` / `[data-motion="off"]` via the
 * global contract. Nothing here fakes progress — the only spinner is bound
 * to the real `pending` flag from the auth repository.
 *
 * HONESTY (§37/§38): the credential panel is rendered strictly behind
 * `isDemoMode()`, so in api mode the hints, the passphrase and the one-tap fill
 * buttons do not exist in the DOM at all. Its WORDING is gated one level deeper,
 * by `isDemoEnvironment()`: in a customer's EMPTY environment the passphrase
 * must stay reachable — it is the only way into the bootstrap account that
 * environment creates — but the environment may not be called a demo, nor that
 * account a sample one. Two axes, two different questions; see
 * `docs/architecture/environments.md`.
 */
export function LoginView() {
  const { login, pending, error, clearError } = useAuth();
  /*
    The academy's own name and tagline (D2 / M8). The login screen is the first
    surface a visitor sees, so it renders the persisted identity — the branding
    domain's record — and not the demo fixture it used to read.
  */
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  // Short-viewport fallback: a failed submit inserts the alert above the button and
  // can push the submit/error pair below the fold — scrolled back into view below.
  const submitRef = useRef<HTMLButtonElement>(null);
  // Client-side backoff state. The enforcing limit is server-side; this makes
  // repeated failures visibly slow and tells the user the truth about why.
  const [throttle, setThrottle] = useState<ThrottleVerdict>(() => checkThrottle());
  const errorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const demo = isDemoMode();
  // The data source decides WHETHER a credential panel exists at all; the
  // persisted lifecycle state decides what that panel may CALL itself. In an
  // EMPTY environment the accounts on screen are the visitor's own, so labelling
  // them demo data is the same dishonesty in the opposite direction.
  const demoEnvironment = useIsDemoEnvironment();
  const lifecycleRecovery = useLifecycleRecovery();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Keep the submit/error pair reachable when the alert's insertion pushes it past
  // the fold (short viewports). Optional-call: `scrollIntoView` is absent in jsdom.
  useEffect(() => {
    if (error) submitRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [error]);

  // Tick while a wait is active so the countdown stays truthful.
  useEffect(() => {
    if (throttle.allowed) return;
    const id = window.setInterval(() => setThrottle(checkThrottle()), 500);
    return () => window.clearInterval(id);
  }, [throttle.allowed]);

  const emailInvalid = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordInvalid = touched && password.length === 0;
  const canSubmit = !pending && throttle.allowed && email.trim().length > 0 && password.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailInvalid || password.length === 0 || !canSubmit) return;

    // Re-check immediately before the call: the interval may not have fired.
    const verdict = checkThrottle();
    if (!verdict.allowed) {
      setThrottle(verdict);
      return;
    }
    await login({ email: email.trim(), password });
    setThrottle(checkThrottle());
  };

  return (
    <main className="relative min-h-svh overflow-hidden bg-ink-950 text-ink-50">
      {/*
        The hall. Full-bleed at every breakpoint; on phones the scrims below
        deepen into a dimmed backdrop rather than the image being dropped, so
        the brand still reads without costing a second request.
      */}
      <div className="absolute inset-0" aria-hidden>
        <img
          src={hallImage}
          alt=""
          className="size-full object-cover object-[58%_44%] opacity-[0.24] lg:opacity-100"
        />
        {/* The window light, breathing — tied to where the artwork's beams fall. */}
        <div
          className="login-halo absolute inset-0"
          style={{
            background:
              "radial-gradient(40% 50% at 72% 18%, color-mix(in srgb, var(--accent-300) 13%, transparent), transparent 70%)",
          }}
        />
        {/*
          Scrims: the shadowed aisle behind the plaque (left), the floor and
          the vault. Legibility first — the plaque must sit in darkness, not
          compete with the architecture.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, color-mix(in srgb, var(--color-ink-950) 90%, transparent) 0%, color-mix(in srgb, var(--color-ink-950) 64%, transparent) 20%, transparent 48%)," +
              "linear-gradient(to top, color-mix(in srgb, var(--color-ink-950) 82%, transparent), transparent 32%)," +
              "linear-gradient(to bottom, color-mix(in srgb, var(--color-ink-950) 58%, transparent), transparent 20%)",
          }}
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--color-ink-950) 84%, transparent), color-mix(in srgb, var(--color-ink-950) 92%, transparent))",
          }}
        />
        <DustMotes />
      </div>

      {/* Vignette + film grain close the frame. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(120% 95% at 50% 42%, transparent 58%, rgba(0,0,0,0.55) 100%)" }}
        />
        <div className="login-grain absolute inset-0" />
      </div>

      <div className="relative z-10 flex min-h-svh flex-col lg:flex-row">
        {/* Brand side — the academy's own plate, held over the hall. */}
        <section className="hidden flex-1 flex-col items-start justify-center p-10 lg:flex lg:pb-[9vh] xl:p-14 xl:pb-[10vh] [@media(max-height:700px)]:p-7 [@media(max-height:700px)]:pb-7">
          <div className="w-full max-w-[460px]">
            <div className="animate-[loginRise_680ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none">
              <Wordmark />
            </div>

            <div className="mt-10 animate-[loginRise_720ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none">
              <h2 className="text-[28px] font-semibold leading-[1.65] text-ink-50 xl:text-[32px]">
                هر اجرای بزرگ،
                <br />
                از یک تمرین کوچک
                <br />
                آغاز می‌شود.
              </h2>
              <p className="mt-5 text-[12.5px] leading-[2.1] text-ink-300">
                سامانهٔ یکپارچهٔ مدیریت آموزشگاه موسیقی — هنرجویان، کلاس‌ها، پیشرفت و رپرتوار، در یک جا.
              </p>
            </div>

            <p className="mt-10 text-[10.5px] text-ink-500">
              © {new Date().getFullYear()} {branding.academyName}
            </p>
          </div>
        </section>

        {/* Form side — inset from the left edge, floating over the aisle. */}
        <section className="flex w-full flex-1 items-center justify-center px-5 py-10 [@media(max-height:700px)]:py-5 sm:px-8 lg:ml-[6%] lg:w-[30%] lg:max-w-[520px] lg:flex-none lg:px-0 xl:w-[27%]">
          <div className="w-full max-w-[430px] animate-[loginRise_620ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none lg:max-w-none">
            {/* Compact wordmark for small screens, where the brand panel is hidden. */}
            <div className="mb-7 flex justify-center lg:hidden">
              <Wordmark compact />
            </div>

            <div className="login-plaque login-chamfer relative">
              <Crest />
              <div className="login-chamfer login-plaque-inner relative p-6 sm:p-8 [@media(max-height:700px)]:p-5">
                <div className="relative mb-6 text-center [@media(max-height:700px)]:mb-4">
                  <div className="text-[11px] font-medium tracking-wide text-gold-400">{branding.tagline}</div>
                  <h1 className="mt-2 text-[25px] font-semibold leading-tight text-ink-50">خوش آمدید</h1>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">
                    برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.
                  </p>
                </div>

                {/* D8: the disclosure precedes authentication, not just follows it. */}
                <DemoBackedNotice className="mb-5" />

                <form onSubmit={onSubmit} noValidate>
                  <label className="block">
                    <span className="mb-2 block text-[12px] font-medium text-ink-200">ایمیل</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-[42px] items-center justify-center text-ink-500">
                        <Mail className="size-[16px]" strokeWidth={1.6} aria-hidden />
                      </span>
                      <input
                        ref={emailRef}
                        type="email"
                        name="email"
                        dir="ltr"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) clearError();
                        }}
                        disabled={pending}
                        aria-invalid={emailInvalid || undefined}
                        aria-describedby={emailInvalid ? emailErrorId : error ? errorId : undefined}
                        className={cn(fieldCls, emailInvalid && invalidCls)}
                        placeholder="you@example.com"
                      />
                    </div>
                    {emailInvalid && (
                      <p id={emailErrorId} className="mt-1.5 text-[11px] text-danger-400">
                        ایمیل معتبر وارد کنید.
                      </p>
                    )}
                  </label>

                  <label className="mt-4 block">
                    <span className="mb-2 block text-[12px] font-medium text-ink-200">گذرواژه</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex w-[42px] items-center justify-center text-ink-500">
                        <Lock className="size-[16px]" strokeWidth={1.6} aria-hidden />
                      </span>
                      <input
                        type={reveal ? "text" : "password"}
                        name="password"
                        dir="ltr"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) clearError();
                        }}
                        disabled={pending}
                        aria-invalid={passwordInvalid || undefined}
                        aria-describedby={passwordInvalid ? passwordErrorId : error ? errorId : undefined}
                        className={cn(fieldCls, "pr-[48px]", passwordInvalid && invalidCls)}
                      />
                      <button
                        type="button"
                        onClick={() => setReveal((v) => !v)}
                        aria-label={reveal ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                        aria-pressed={reveal}
                        disabled={pending}
                        className="absolute inset-y-0 right-0 flex w-[48px] items-center justify-center rounded-r-[9px] text-ink-400 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none disabled:opacity-40"
                      >
                        {reveal ? <EyeOff className="size-[17px]" /> : <Eye className="size-[17px]" />}
                      </button>
                    </div>
                    {passwordInvalid && (
                      <p id={passwordErrorId} className="mt-1.5 text-[11px] text-danger-400">
                        گذرواژه را وارد کنید.
                      </p>
                    )}
                  </label>

                  {/*
                    Throttle notice. Stated plainly, with a real countdown —
                    never a silent dead button, which reads as "the app is
                    broken" rather than "you are being rate limited".
                  */}
                  {!throttle.allowed && (
                    <div
                      role="status"
                      className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-warn-500/25 bg-warn-500/[0.07] p-3.5 text-[12px] leading-relaxed text-ink-100"
                    >
                      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warn-400" aria-hidden />
                      <span>
                        {throttle.lockedOut
                          ? `به دلیل تلاش‌های ناموفق پیاپی، ورود به مدت ${describeWait(throttle.waitMs)} مسدود شده است.`
                          : `تلاش‌های ناموفق زیاد بوده است. ${describeWait(throttle.waitMs)} دیگر دوباره تلاش کنید.`}
                      </span>
                    </div>
                  )}

                  {error && (
                    <div
                      id={errorId}
                      role="alert"
                      className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-danger-500/25 bg-danger-500/[0.08] p-3.5 text-[12px] leading-relaxed text-ink-100"
                    >
                      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-400" aria-hidden />
                      <span>{error.message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    ref={submitRef}
                    disabled={!canSubmit}
                    className={cn(
                      "group relative mt-6 flex h-[52px] [@media(max-height:700px)]:h-[46px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[9px]",
                      "text-[14px] font-semibold text-ink-950 transition-all duration-300",
                      "bg-gradient-to-l from-gold-600 via-gold-300 to-gold-600 bg-[length:160%_100%] bg-center",
                      "shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-8px_18px_rgba(0,0,0,0.2),0_14px_34px_-14px_color-mix(in_srgb,var(--accent-500)_60%,transparent)]",
                      "hover:bg-[position:60%_0] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.5),inset_0_-8px_18px_rgba(0,0,0,0.16),0_18px_40px_-14px_color-mix(in_srgb,var(--accent-500)_70%,transparent)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950",
                      "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
                    )}
                  >
                    {pending ? (
                      <>
                        <span
                          className="size-4 animate-spin rounded-full border-2 border-ink-950/25 border-t-ink-950"
                          aria-hidden
                        />
                        در حال ورود…
                      </>
                    ) : (
                      <>
                        ورود به پنل
                        <ArrowLeft
                          className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
                          aria-hidden
                        />
                      </>
                    )}
                  </button>

                  <span aria-live="polite" className="sr-only">
                    {pending ? "در حال احراز هویت" : ""}
                  </span>
                </form>
              </div>
            </div>

            {demo && (
              <DemoPanel
                demoEnvironment={demoEnvironment}
                onPick={(nextEmail) => {
                  setEmail(nextEmail);
                  setPassword(DEMO_PASSPHRASE);
                  clearError();
                }}
              />
            )}
            {lifecycleRecovery && <LifecycleRecoveryPanel controller={lifecycleRecovery} />}
          </div>
        </section>
      </div>
    </main>
  );
}

const fieldCls =
  "h-[54px] [@media(max-height:700px)]:h-[46px] w-full rounded-[9px] border border-white/[0.09] bg-ink-950/55 pl-[42px] pr-3.5 text-[13.5px] text-ink-50 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.03),inset_0_3px_12px_rgba(0,0,0,0.4)] " +
  "placeholder:text-ink-500 transition-all duration-200 " +
  "hover:border-white/[0.16] " +
  "focus:border-gold-500/50 focus:bg-ink-950/75 focus:outline-none focus:ring-[3px] focus:ring-gold-500/15 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const invalidCls = "border-danger-500/55 focus:border-danger-500/70 focus:ring-danger-500/15";

/* ------------------------------------------------------------------ */
/* The staged room's fixtures — all decorative, all aria-hidden.       */
/* ------------------------------------------------------------------ */

/**
 * The wordmark: lyre, PARSIAN, MUSIC ACADEMY — a centred classical stack,
 * set in the old-style serif stack. `dir=ltr` on the Latin lines so their
 * letterspacing and optical centre behave in this RTL document; the
 * tracking's trailing space is compensated with a negative margin.
 */
function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex flex-col items-center text-center">
      <LyreEmblem className={compact ? "size-14" : "size-20"} />
      <span
        dir="ltr"
        className={cn(
          "mt-4 font-display text-gold-300",
          compact ? "-mr-[0.3em] text-[18px] tracking-[0.3em]" : "-mr-[0.3em] text-[32px] tracking-[0.3em] xl:text-[38px]",
        )}
      >
        PARSIAN
      </span>
      <span
        dir="ltr"
        className={cn(
          "mt-1.5 font-display text-gold-500",
          compact ? "-mr-[0.42em] text-[8.5px] tracking-[0.42em]" : "-mr-[0.5em] text-[10.5px] tracking-[0.5em]",
        )}
      >
        MUSIC ACADEMY
      </span>
      <span className={cn("hairline-gold mt-4 h-px", compact ? "w-10" : "w-14")} aria-hidden />
    </div>
  );
}

/** A restrained classical lyre — the academy's emblem, free-standing brass. */
function LyreEmblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      aria-hidden
      className={cn(
        "text-gold-400 drop-shadow-[0_0_16px_color-mix(in_srgb,var(--accent-500)_40%,transparent)]",
        className,
      )}
    >
      <path
        d="M20 12 C 12 22, 10 34, 16 44 C 19 49, 25 52, 32 52 C 39 52, 45 49, 48 44 C 54 34, 52 22, 44 12"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M20 12 C 17 8, 20 4, 24 5.5 M44 12 C 47 8, 44 4, 40 5.5" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 26 H 46.5" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M25 26 V 49.5 M28.5 26 V 51 M32 26 V 52 M35.5 26 V 51 M39 26 V 49.5" strokeWidth="0.9" opacity="0.9" />
      <path d="M27 52 h10 l2 6 H25 z" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** The crest straddling the plaque's top edge — a diamond fleuron with scrolls. */
function Crest() {
  return (
    <span aria-hidden className="absolute -top-[13px] left-1/2 -translate-x-1/2 rounded-full bg-ink-950 px-2">
      <svg
        viewBox="0 0 48 26"
        fill="none"
        stroke="currentColor"
        className="h-[26px] w-[48px] text-gold-400 drop-shadow-[0_0_10px_color-mix(in_srgb,var(--accent-500)_45%,transparent)]"
        aria-hidden
      >
        <path d="M24 3 l6.5 10 -6.5 10 -6.5 -10 z" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M24 8 l3 5 -3 5 -3 -5 z" strokeWidth="0.8" opacity="0.7" />
        <path d="M15 13 C 10 13, 8 8, 3.5 10 M33 13 C 38 13, 40 8, 44.5 10" strokeWidth="1" strokeLinecap="round" />
        <circle cx="3.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="44.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

/**
 * Dust in the window light, choreographed along the beam's diagonal. Fixed
 * values, never `Math.random` at render: the room looks alive but the DOM is
 * stable for tests and for repeat visits.
 */
const MOTES: Array<{ l: string; t: string; s: number; d: number; dur: number; o: number; x: string; y: string }> = [
  { l: "72%", t: "14%", s: 2, d: 0, dur: 17, o: 0.34, x: "-14px", y: "-150px" },
  { l: "68%", t: "22%", s: 1.5, d: 2.4, dur: 21, o: 0.28, x: "16px", y: "-180px" },
  { l: "64%", t: "30%", s: 2.5, d: 5.1, dur: 16, o: 0.4, x: "-20px", y: "-130px" },
  { l: "60%", t: "38%", s: 1.5, d: 1.2, dur: 19, o: 0.3, x: "12px", y: "-120px" },
  { l: "56%", t: "46%", s: 2, d: 7.6, dur: 18, o: 0.36, x: "-10px", y: "-170px" },
  { l: "52%", t: "54%", s: 1.5, d: 3.8, dur: 22, o: 0.26, x: "14px", y: "-110px" },
  { l: "48%", t: "62%", s: 2.5, d: 9.2, dur: 15, o: 0.42, x: "-18px", y: "-140px" },
  { l: "76%", t: "10%", s: 1.5, d: 6.4, dur: 20, o: 0.3, x: "10px", y: "-190px" },
  { l: "62%", t: "42%", s: 2, d: 11.1, dur: 17, o: 0.34, x: "-12px", y: "-120px" },
  { l: "44%", t: "70%", s: 1.5, d: 4.6, dur: 23, o: 0.24, x: "14px", y: "-160px" },
  { l: "58%", t: "50%", s: 1.5, d: 8.3, dur: 24, o: 0.22, x: "-16px", y: "-100px" },
  { l: "40%", t: "76%", s: 2, d: 12.7, dur: 16, o: 0.36, x: "18px", y: "-200px" },
];

function DustMotes() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="login-mote"
          style={
            {
              left: m.l,
              top: m.t,
              width: m.s,
              height: m.s,
              animationDelay: `${m.d}s`,
              animationDuration: `${m.dur}s`,
              "--mote-o": m.o,
              "--mote-x": m.x,
              "--mote-y": m.y,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/**
 * Local credentials.
 *
 * Rendered only when the data source is demo; in api mode it is not in the DOM
 * at all. The wording states plainly that this login has no security — claiming
 * otherwise about localStorage auth would be dishonest.
 *
 * `demoEnvironment` chooses the LABELS only, never the capability: an EMPTY
 * environment still needs the passphrase on screen, because the bootstrap
 * account it created is the only way in. What it must not do is call that
 * customer environment a demo, or that account a sample one.
 */
function DemoPanel({ demoEnvironment, onPick }: { demoEnvironment: boolean; onPick: (email: string) => void }) {
  const accounts = listDemoAccounts();
  return (
    <div className="mt-5 rounded-[14px] border border-gold-500/[0.16] bg-ink-950/70 p-4 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warn-400">
        <TriangleAlert className="size-3.5" aria-hidden />{" "}
        {demoEnvironment ? "محیط دمو — بدون امنیت واقعی" : "دادهٔ محلی — بدون امنیت واقعی"}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-300">
        {demoEnvironment
          ? "این ورود صرفاً نمایشی است و هیچ محافظت امنیتی ندارد. گذرواژهٔ همهٔ حساب‌های نمونه"
          : "این ورود روی دادهٔ ذخیره‌شده در همین مرورگر است و هیچ محافظت امنیتی ندارد. گذرواژهٔ حساب دسترسیِ این محیط"}{" "}
        <code dir="ltr" className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[10.5px] text-ink-100">
          {DEMO_PASSPHRASE}
        </code>{" "}
        است.
      </p>
      <ul className="mt-2 divide-y divide-white/[0.06]">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-right text-[11px] text-ink-200 transition-colors hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
            >
              <span dir="ltr" className="truncate text-ink-300">
                {account.email}
              </span>
              <span className="shrink-0 text-ink-400">{roleLabels[account.role]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
