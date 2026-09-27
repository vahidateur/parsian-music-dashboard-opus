import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, Lock, ShieldAlert, TriangleAlert, User } from "lucide-react";
import { useBranding } from "@/domains/branding/useBranding";
import { useAuth } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { isDemoMode } from "@/api/config";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { useLifecycleRecovery } from "@/components/lifecycle/LifecycleRecoveryContext";
import { LifecycleRecoveryPanel } from "@/components/lifecycle/LifecycleRecoveryPanel";
import { DemoBackedNotice } from "@/components/shell/DemoBackedNotice";
import { roleLabel } from "@/domains/auth/permissions";
import portalBg from "@/assets/login-portal.webp";
import portalBgSm from "@/assets/login-portal-sm.webp";
import { checkThrottle, describeWait, type ThrottleVerdict } from "@/security/loginThrottle";
import { cn } from "@/utils/cn";

/**
 * Login — Persian-first, RTL, cinematic sanctuary.
 *
 * WORLD: the academy sits inside an ancient mountain sanctuary. The full-bleed
 * artwork (a monumental stone gate over water) is the PLACE; the login panel
 * renders as real, focusable HTML placed INSIDE that architecture — nothing
 * user-facing is baked into the image.
 *
 * FORM ↔ ARCH (the panel is an object inside the arch's safe region):
 *
 *   The backdrop is `object-cover` + a 1.05 seat zoom, so the artwork's
 *   on-screen box is a pure function of the viewport. `.login-stage` (see
 *   index.css) lays out exactly that box and `--stage-*` exposes it as
 *   lengths: one coordinate system shared by the painting and the DOM. A
 *   pixel census of the artwork fixed the arch's geometry (tunnel crown
 *   0.2542 h, waterline 0.7503 h, structure span 0.309 w). From those:
 *
 *     — the panel keeps its OWN compact proportions: a 400-px design grid,
 *       ≈450 px tall at full size. It never stretches to fill the opening.
 *     — ONE unit drives it: `--form-u` (one design pixel) is the smaller of
 *       the width ratio (stone silhouette ÷ 400) and the height ratio
 *       (opening ÷ 480); the width `--form-w` = u × 400 FOLLOWS the unit,
 *       so the panel scales as a whole and keeps its design aspect;
 *     — every spacing/type/control length is design-px × u with a usability
 *       floor (38 px fields, 40 px button, ≥11.5 px text);
 *     — the column is anchored just under the tunnel crown
 *       (`--arch-open-top-y`) so the panel begins where the doorway begins
 *       and ends above the waterline.
 *
 *   The result is breathing room on every side: stone, then panel, then
 *   stone — the arch is the frame, the form an intentionally placed object.
 *   No `transform: scale()`, no per-height breakpoints.
 *
 * TYPOGRAPHY: Persian is always Vazirmatn. The Latin wordmark, side mottos
 * and footer motto use `font-display` (Georgia/Times stack) — the classical
 * serif voice of the branding tokens. It has no Persian glyphs, so it is
 * never applied to Persian text.
 *
 * RTL: the page inherits `dir="rtl"` from the document. Physical
 * `left/right` utilities appear only where the design is direction-symmetric
 * or already fixed a side (the password toggle, the flank mottos). No flex
 * `direction` is overridden anywhere.
 *
 * MOTION: entrance rise, sun rays and drifting motes are decorative only and
 * are disabled by the global `prefers-reduced-motion` contract (plus explicit
 * `motion-reduce:animate-none`). The only spinner is bound to the real
 * `pending` flag from the auth repository.
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
    <main className="login-root relative min-h-svh overflow-x-clip bg-ink-950 text-ink-50">
      {/* The place: arch, mountains, waterfalls, lake. Presentational only. */}
      <PortalBackdrop />

      {/* Restrained magic: light rays and drifting motes, behind the content. */}
      <PortalAtmosphere />

      <div className="relative z-10 flex min-h-svh flex-col pb-[92px] sm:pb-20 lg:h-svh lg:pb-11 lg:overflow-y-auto">
        {/*
          Vertical arch lock: on `lg`+ the column starts where the tunnel crown
          starts (--arch-open-top-y, a pure stage fraction — see the FORM ↔ ARCH
          note), so the rune apex stays visible above the panel and the panel
          ends above the waterline. Below `lg` the artwork is mostly crown and
          peaks, so the panel enters after a modest fixed descent and the page
          scrolls naturally.
        */}
        <div className="relative flex flex-1 justify-center px-4 pt-[min(var(--arch-open-top-y),96px)] sm:px-6 lg:pt-[var(--arch-open-top-y)]">
          <PortalMotto side="left" />
          <PortalMotto side="right" />

          <div
            data-login-panel
            className="relative z-10 mt-[clamp(4px,calc(var(--arch-safe-h)*0.026),22px)] w-[var(--form-w)] max-w-full animate-[loginRise_640ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none"
          >
            {/*
              The compact premium panel — a fixed-proportion object placed
              inside the arch. Antique-gold reflective border (a real gradient
              border, not a glow), obsidian fill, localized warm highlights at
              the crown of the panel only.
            */}
            <div
              data-login-card
              className="relative rounded-[22px] px-[var(--p-pad-x)] pb-[var(--p-pad-bot)] pt-[var(--p-pad-top)] text-center"
              style={{
                border: "1px solid transparent",
                background:
                  "linear-gradient(180deg, rgb(10 12 16 / 0.92), rgb(7 9 12 / 0.96)) padding-box, " +
                  "linear-gradient(165deg, rgb(228 197 122 / 0.5), rgb(143 106 44 / 0.26) 30%, rgb(24 26 32 / 0.35) 52%, rgb(212 168 83 / 0.38) 84%, rgb(228 197 122 / 0.48)) border-box",
                boxShadow:
                  "inset 0 1px 0 rgb(255 255 255 / 0.05), 0 30px 80px -24px rgb(0 0 0 / 0.9), 0 0 46px -18px rgb(212 168 83 / 0.3)",
              }}
            >
              {/* Localized warm highlights — the panel's own candlelight. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[22px]"
                style={{
                  background:
                    "radial-gradient(60% 30% at 50% 0%, rgb(212 168 83 / 0.12), transparent 72%), " +
                    "radial-gradient(26% 18% at 10% 2%, rgb(212 168 83 / 0.07), transparent 70%), " +
                    "radial-gradient(26% 18% at 90% 2%, rgb(212 168 83 / 0.07), transparent 70%)",
                }}
              />

              {/* — Branding: star, lyre, wordmark, ornament, academy title — */}
              <div className="relative">
                <StarMark />
                <LyreMark className="mx-auto mt-[calc(var(--form-u)*6)] size-[var(--p-lyre)] text-gold-300" />
                <p
                  className="mt-[calc(var(--form-u)*9)] font-display text-[length:var(--p-word-f)] leading-none text-gold-300"
                  style={{
                    textShadow:
                      "0 1px 0 rgb(0 0 0 / 0.85), 0 2px 8px rgb(0 0 0 / 0.55), 0 -1px 0 rgb(246 230 184 / 0.16)",
                  }}
                >
                  <span
                    dir="ltr"
                    className="inline-block"
                    style={{ letterSpacing: "0.32em", marginRight: "-0.32em" }}
                  >
                    PARSIAN
                  </span>
                </p>
                <p className="mt-[calc(var(--form-u)*6)] font-display text-[length:var(--p-sub-f)] text-gold-400/90">
                  <span
                    dir="ltr"
                    className="inline-block"
                    style={{ letterSpacing: "0.46em", marginRight: "-0.46em" }}
                  >
                    MUSIC ACADEMY
                  </span>
                </p>
                <OrnamentDivider className="mx-auto mt-[calc(var(--form-u)*12)] max-w-[calc(var(--form-u)*250)]" />
                <h1
                  className="mt-[calc(var(--form-u)*10)] text-[length:var(--p-tag-f)] font-semibold text-gold-200"
                  style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.7)" }}
                >
                  {branding.tagline}
                </h1>
                <p className="mt-[calc(var(--form-u)*5)] text-[length:var(--p-text-sm)] leading-relaxed text-ink-300">
                  برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.
                </p>
              </div>

              {/* D8: the disclosure precedes authentication, not just follows it. */}
              <DemoBackedNotice className="mt-[var(--p-sec-gap)]" />

              <form onSubmit={onSubmit} noValidate className="mt-[var(--p-sec-gap)]">
                {/*
                  The labels stay in the accessibility tree (sr-only) — the
                  fields are announced exactly as before — while the visible
                  hint lives in the placeholder, engraved-style.
                */}
                <label className="block">
                  <span className="sr-only">ایمیل</span>
                  <div className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 flex w-[var(--p-icon-w)] items-center justify-center text-ink-400"
                    >
                      <User className="size-4" />
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
                      className={cn(fieldCls, "pr-[var(--p-icon-w)]", emailInvalid && invalidCls)}
                      placeholder="ایمیل یا شماره همراه"
                    />
                  </div>
                  {emailInvalid && (
                    <p id={emailErrorId} className="mt-[calc(var(--form-u)*6)] text-[length:var(--p-text-xs)] text-danger-400">
                      ایمیل معتبر وارد کنید.
                    </p>
                  )}
                </label>

                <label className="mt-[var(--p-field-gap)] block">
                  <span className="sr-only">گذرواژه</span>
                  <div className="relative">
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 flex w-[var(--p-icon-w)] items-center justify-center text-ink-400"
                    >
                      <Lock className="size-4" />
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
                      className={cn(fieldCls, "pl-[var(--p-icon-w)] pr-[var(--p-icon-w)]", passwordInvalid && invalidCls)}
                      placeholder="گذرواژه"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((v) => !v)}
                      aria-label={reveal ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                      aria-pressed={reveal}
                      disabled={pending}
                      className="absolute inset-y-0 left-0 flex w-[var(--p-icon-w)] items-center justify-center rounded-l-xl text-ink-400 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none disabled:opacity-40"
                    >
                      {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                    </button>
                  </div>
                  {passwordInvalid && (
                    <p id={passwordErrorId} className="mt-[calc(var(--form-u)*6)] text-[length:var(--p-text-xs)] text-danger-400">
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
                    className="mt-[var(--p-field-gap)] flex items-start gap-2.5 rounded-xl border border-warn-500/25 bg-warn-500/[0.07] p-[max(10px,calc(var(--form-u)*14))] text-[length:var(--p-text-sm)] leading-relaxed text-ink-100"
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
                    className="mt-[var(--p-field-gap)] flex items-start gap-2.5 rounded-xl border border-danger-500/25 bg-danger-500/[0.08] p-[max(10px,calc(var(--form-u)*14))] text-[length:var(--p-text-sm)] leading-relaxed text-ink-100"
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
                    "group relative mt-[var(--p-sec-gap)] flex h-[var(--p-btn-h)] w-full items-center justify-center overflow-hidden rounded-xl",
                    "text-[length:var(--p-text)] font-semibold text-ink-950 transition-all duration-300",
                    "bg-gradient-to-l from-gold-500 via-gold-300 to-gold-500 bg-[length:200%_100%] bg-right",
                    "hover:bg-left hover:shadow-[0_14px_38px_-12px_color-mix(in_srgb,var(--accent-500)_55%,transparent)]",
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
                    <>ورود به پنل</>
                  )}
                </button>

                <span aria-live="polite" className="sr-only">
                  {pending ? "در حال احراز هویت" : ""}
                </span>

                {/*
                  The recovery inscription — an academy plaque under the seal,
                  not a web alert. Static by design: recovery happens through
                  the academy, so the line only states where.
                */}
                <div className="mt-[var(--p-rec-gap)]">
                  <span
                    aria-hidden
                    className="mx-auto mb-[calc(var(--form-u)*7)] block h-px w-[calc(var(--form-u)*180)] bg-gradient-to-l from-transparent via-gold-500/40 to-transparent"
                  />
                  <p className="flex items-center justify-center gap-[calc(var(--form-u)*8)] text-[length:var(--p-text-xs)] leading-relaxed text-gold-400/85">
                    <LyreMark className="size-[calc(var(--form-u)*15)] shrink-0 text-gold-500/75" />
                    <span>برای ریکاوری رمز عبور با آموزشگاه تماس بگیرید</span>
                    <LyreMark className="size-[calc(var(--form-u)*15)] shrink-0 -scale-x-100 text-gold-500/75" />
                  </p>
                </div>
              </form>
            </div>

            {demo && <DemoPanel demoEnvironment={demoEnvironment} onPick={(nextEmail) => {
              setEmail(nextEmail);
              setPassword(DEMO_PASSPHRASE);
              clearError();
            }} />}
            {lifecycleRecovery && <LifecycleRecoveryPanel controller={lifecycleRecovery} />}
          </div>
        </div>

        <PortalFooter academyName={branding.academyName} />
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Scene layers                                                        */
/* ------------------------------------------------------------------ */

/**
 * The full-bleed environment. One optimized WebP with a `srcset` fallback
 * (880w for phones, 1600w for desktop), laid out inside `.login-stage` — the
 * element that IS the artwork's coordinate system (see the FORM ↔ ARCH note).
 * The image carries zero baked-in UI — everything interactive is DOM above
 * it. `sizes` advertises the stage's real painted width, not the viewport's,
 * so height-bound viewports (portrait phones) still fetch the sharp 1600w.
 */
function PortalBackdrop() {
  return (
    <div aria-hidden className="fixed inset-0 z-0 overflow-hidden">
      <div className="login-stage">
        <img
          src={portalBg}
          srcSet={`${portalBgSm} 880w, ${portalBg} 1600w`}
          sizes="calc(max(100vw, 100svh * 1.791713) * 1.05)"
          alt=""
          className="size-full object-cover object-center"
        />
      </div>
      {/* Vignette — pulls the eye to the gate and darkens the flanks for the mottos. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(115% 88% at 50% 42%, transparent 52%, rgba(6,7,10,0.52) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[30%]"
        style={{ background: "linear-gradient(to top, rgba(6,7,10,0.78), transparent)" }}
      />
      <div
        className="absolute inset-x-0 top-0 h-[16%]"
        style={{ background: "linear-gradient(to bottom, rgba(6,7,10,0.42), transparent)" }}
      />
    </div>
  );
}

/**
 * Ancient, believable magic: two slow warm rays from the upper-left (where the
 * artwork's sun sits) and a handful of drifting gold motes. Ten DOM nodes
 * total, all `aria-hidden`, all frozen by the reduced-motion contract.
 */
const MOTES = [
  { x: 30, y: 64, d: 16, delay: 0, s: 2.5 },
  { x: 36, y: 78, d: 21, delay: 4, s: 2 },
  { x: 42, y: 58, d: 18, delay: 9, s: 3 },
  { x: 47, y: 84, d: 24, delay: 2, s: 2 },
  { x: 53, y: 70, d: 19, delay: 7, s: 2.5 },
  { x: 58, y: 60, d: 15, delay: 12, s: 2 },
  { x: 63, y: 80, d: 22, delay: 5, s: 3 },
  { x: 68, y: 66, d: 17, delay: 10, s: 2 },
  { x: 73, y: 74, d: 20, delay: 1, s: 2.5 },
  { x: 27, y: 46, d: 23, delay: 8, s: 2 },
] as const;

function PortalAtmosphere() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[5] hidden overflow-hidden sm:block">
      {/* God rays from the artwork's upper-left sun. */}
      <div className="absolute -top-[22%] left-[5%] h-[85%] w-[22%] rotate-[18deg] bg-gradient-to-b from-gold-300/[0.13] via-gold-300/[0.05] to-transparent blur-2xl motion-reduce:animate-none lg:animate-[rayShift_12s_ease-in-out_infinite_alternate]" />
      <div className="absolute -top-[16%] left-[19%] hidden h-[68%] w-[10%] rotate-[24deg] bg-gradient-to-b from-gold-200/[0.09] to-transparent blur-xl motion-reduce:animate-none lg:block lg:animate-[rayShift_16s_ease-in-out_infinite_alternate-reverse]" />
      {/* Drifting motes over the water. */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-gold-300/50 blur-[1px] motion-reduce:animate-none lg:animate-[moteFloat_18s_linear_infinite]"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            width: m.s,
            height: m.s,
            animationDuration: `${m.d}s`,
            animationDelay: `-${m.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Branding marks                                                      */
/* ------------------------------------------------------------------ */

/** Four-point star above the lyre — the reference's quiet crest. */
function StarMark() {
  return (
    <svg viewBox="0 0 12 12" className="mx-auto size-[var(--p-star)] text-gold-300/90" aria-hidden>
      <path d="M6 0 L7.4 4.6 L12 6 L7.4 7.4 L6 12 L4.6 7.4 L0 6 L4.6 4.6 Z" fill="currentColor" />
    </svg>
  );
}

/** A classical lyre in gold linework — the academy emblem. Decorative. */
function LyreMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M15 5c-4.5 3.4-7 8.4-7 13.6C8 27 14 31.6 20 33" />
      <path d="M33 5c4.5 3.4 7 8.4 7 13.6C40 27 34 31.6 28 33" />
      <path d="M14.5 9.5h19" opacity="0.75" />
      <path d="M19.5 9.5v21M24 9.5v23M28.5 9.5v21" opacity="0.85" strokeWidth={1.15} />
      <path d="M24 32.5v4" opacity="0.75" />
      <path d="M16.5 41c2.2-2.2 4.6-3.2 7.5-3.2s5.3 1 7.5 3.2" />
    </svg>
  );
}

/** Hairline — diamond — hairline, the panel's ornamental divider. */
function OrnamentDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex w-full items-center gap-3", className)}>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent via-gold-500/40 to-gold-500/60" />
      <span className="size-[7px] rotate-45 border border-gold-400/70 bg-gold-500/20" />
      <span className="h-px flex-1 bg-gradient-to-r from-transparent via-gold-500/40 to-gold-500/60" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Atmospheric copy                                                    */
/* ------------------------------------------------------------------ */

const MOTTO_LEFT = ["DISCIPLINE", "CREATIVITY", "A HIGHER YOU"] as const;
const MOTTO_RIGHT = ["MORE", "THAN LESSONS", "A LIFETIME", "OF HARMONY"] as const;

/**
 * The reference's flank inscriptions. Secondary by design — decorative
 * (`aria-hidden`), serif, wide-tracked — and only present where there is
 * room: xl+ so they never crowd the panel on smaller desktops. Physical
 * absolute offsets keep the LEFT motto on the LEFT flank regardless of RTL.
 */
function PortalMotto({ side }: { side: "left" | "right" }) {
  const lines = side === "left" ? MOTTO_LEFT : MOTTO_RIGHT;
  return (
    <div
      aria-hidden
      className={cn(
        "absolute top-1/2 hidden -translate-y-1/2 text-center font-display text-[10.5px] leading-[2.5] text-ink-100/70 xl:block",
        "animate-[loginRise_900ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none 2xl:text-[11.5px]",
        side === "left" ? "left-[4.5%] 2xl:left-[8%]" : "right-[4.5%] 2xl:right-[8%]",
      )}
      style={{
        letterSpacing: "0.42em",
        /* Keep the flank inscriptions legible over the busy painting. */
        textShadow: "0 1px 2px rgb(0 0 0 / 0.85), 0 0 12px rgb(0 0 0 / 0.5)",
      }}
    >
      {lines.map((line) => (
        <div key={line}>
          <span dir="ltr" className="inline-block" style={{ marginRight: "-0.42em" }}>
            {line}
          </span>
        </div>
      ))}
      {side === "left" && (
        <span className="mx-auto mt-3 block h-px w-10 bg-gradient-to-r from-transparent via-gold-500/50 to-transparent" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

/**
 * The academy's copyright line, set INTO the bottom edge of the scene over the
 * water — anchored to the viewport/document bottom like the reference, so it
 * stays visible at every height instead of trailing the scroll. Right (reading
 * first in RTL) carries the legal line, left carries the decorative Latin
 * motto. The scroll column carries matching bottom padding so content never
 * hides behind it.
 */
function PortalFooter({ academyName }: { academyName: string }) {
  return (
    <footer className="absolute inset-x-0 bottom-0 z-20 text-[10.5px] text-ink-300/80">
      {/* Scrim: content that scrolls beneath the anchored footer fades into the water, it never collides with the type. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{ background: "linear-gradient(to top, rgba(6,7,10,0.92) 12%, rgba(6,7,10,0.55) 55%, transparent)" }}
      />
      <div className="relative mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 [@media(max-height:700px)]:pb-[max(0.55rem,env(safe-area-inset-bottom))] [@media(max-height:700px)]:pt-1.5">
        <p className="nums">© {new Date().getFullYear()} {academyName}</p>
        <p
          aria-hidden
          className="font-display text-[9px] text-ink-400/70"
          style={{ letterSpacing: "0.34em" }}
        >
          PARSIAN MUSIC ACADEMY
        </p>
      </div>
    </footer>
  );
}

const fieldCls =
  "h-[var(--p-input-h)] w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-[length:var(--p-text)] text-ink-50 " +
  "placeholder:text-ink-500 transition-colors duration-200 " +
  "hover:border-white/[0.14] " +
  "focus:border-gold-500/50 focus:bg-white/[0.06] focus:outline-none focus:ring-[3px] focus:ring-gold-500/15 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const invalidCls = "border-danger-500/55 focus:border-danger-500/70 focus:ring-danger-500/15";

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
    <div className="mt-[var(--p-field-gap)] rounded-2xl border border-warn-500/[0.18] bg-warn-500/[0.045] p-[max(12px,calc(var(--form-u)*14))]">
      <div className="flex items-center gap-1.5 text-[length:var(--p-text-xs)] font-semibold text-warn-400">
        <TriangleAlert className="size-3.5" aria-hidden />{" "}
        {demoEnvironment ? "محیط دمو — بدون امنیت واقعی" : "دادهٔ محلی — بدون امنیت واقعی"}
      </div>
      <p className="mt-[calc(var(--form-u)*6)] text-[length:var(--p-text-xs)] leading-relaxed text-ink-300">
        {demoEnvironment
          ? "این ورود صرفاً نمایشی است و هیچ محافظت امنیتی ندارد. گذرواژهٔ همهٔ حساب‌های نمونه"
          : "این ورود روی دادهٔ ذخیره‌شده در همین مرورگر است و هیچ محافظت امنیتی ندارد. گذرواژهٔ حساب دسترسیِ این محیط"}{" "}
        <code dir="ltr" className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[length:var(--p-text-xs)] text-ink-100">
          {DEMO_PASSPHRASE}
        </code>{" "}
        است.
      </p>
      {/* Two columns where there is width: five one-tap accounts are the tallest
          honest element on the screen, and pairing them is what keeps a desktop
          demo environment inside one viewport. */}
      <ul className="mt-[calc(var(--form-u)*8)] grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-[max(4px,calc(var(--form-u)*6))] text-right text-[length:var(--p-text-xs)] text-ink-200 transition-colors hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
            >
              <span dir="ltr" className="truncate text-ink-300">
                {account.email}
              </span>
              <span className="shrink-0 text-ink-400">{roleLabel(account.role)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
