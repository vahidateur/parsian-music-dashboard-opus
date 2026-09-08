import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, ShieldAlert, TriangleAlert } from "lucide-react";
import { academy } from "@/data/academy";
import { useAuth } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { isDemoMode } from "@/api/config";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { roleLabels } from "@/domains/auth/permissions";
import stageImage from "@/assets/login-stage.jpg";
import { checkThrottle, describeWait, type ThrottleVerdict } from "@/security/loginThrottle";
import { cn } from "@/utils/cn";

/**
 * Login — Persian-first, RTL, cinematic.
 *
 * LAYOUT: a 68/32 split on large screens — stage artwork carries the brand,
 * a glass card carries the form. Below `lg` the artwork becomes a dimmed
 * full-bleed backdrop instead of disappearing, so the identity survives on a
 * phone without costing a second image request.
 *
 * TYPOGRAPHY: Persian is always Vazirmatn. Playfair Display appears only on
 * the Latin wordmark — it has no Persian glyphs, so setting Persian in it
 * would silently fall back to a different face mid-sentence.
 *
 * MOTION: the entrance animation is decorative and is skipped entirely under
 * `prefers-reduced-motion`. Nothing here fakes progress — the only spinner is
 * bound to the real `pending` flag from the auth repository.
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

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
    <main className="relative min-h-screen overflow-hidden bg-[#0E1018] text-ink-50">
      {/*
        The artwork. On small screens it stays as a heavily dimmed backdrop
        rather than being dropped, so the brand still reads on a phone.
      */}
      <div className="absolute inset-0 lg:inset-y-0 lg:right-0 lg:left-[32%]" aria-hidden>
        <img
          src={stageImage}
          alt=""
          className="size-full object-cover object-[60%_center] opacity-[0.22] lg:opacity-100"
        />
        {/* Feathered edge so the photo dissolves into the card instead of butting against it. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to left, rgba(14,16,24,0) 30%, rgba(14,16,24,0.72) 72%, #0E1018 97%)",
          }}
        />
        <div
          className="absolute inset-0 lg:hidden"
          style={{ background: "linear-gradient(to bottom, rgba(14,16,24,0.86), rgba(14,16,24,0.94))" }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col lg:flex-row-reverse">
        {/* Brand side */}
        <section className="hidden flex-1 flex-col justify-between p-12 lg:flex xl:p-16">
          <div className="flex items-center gap-2.5">
            <StageMark />
            <span className="font-display text-[15px] tracking-[0.14em] text-gold-300">AVA</span>
          </div>

          <div className="max-w-[30ch] animate-[loginRise_720ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none">
            <div className="mb-4 h-px w-14 bg-gradient-to-l from-gold-500/70 to-transparent" />
            <h2 className="text-[30px] font-semibold leading-[1.5] text-ink-50 xl:text-[34px]">
              هر اجرای بزرگ،
              <br />
              از یک تمرین کوچک آغاز می‌شود.
            </h2>
            <p className="mt-4 text-[13px] leading-[2] text-ink-300">
              سامانهٔ یکپارچهٔ مدیریت آموزشگاه موسیقی — هنرجویان، کلاس‌ها، پیشرفت و رپرتوار، در یک جا.
            </p>
          </div>

          <p className="text-[11px] text-ink-500">
            © {new Date().getFullYear()} {academy.name}
          </p>
        </section>

        {/* Form side */}
        <section className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:w-[32%] lg:max-w-[560px] lg:flex-none lg:px-10">
          <div className="w-full max-w-[430px] animate-[loginRise_620ms_cubic-bezier(0.16,1,0.3,1)_both] motion-reduce:animate-none">
            {/* Compact wordmark for small screens, where the brand panel is hidden. */}
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <StageMark />
              <span className="font-display text-[14px] tracking-[0.14em] text-gold-300">AVA</span>
            </div>

            <div
              className="rounded-[28px] border border-white/[0.07] p-7 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85)] sm:p-10"
              style={{ background: "rgba(10,12,18,0.42)", backdropFilter: "blur(28px)" }}
            >
              <div className="mb-7">
                <div className="text-[11px] font-medium tracking-wide text-gold-400">{academy.tagline}</div>
                <h1 className="mt-2 text-[24px] font-semibold leading-tight text-ink-50">خوش آمدید</h1>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-300">
                  برای ورود به پنل مدیریت، اطلاعات حساب خود را وارد کنید.
                </p>
              </div>

              <form onSubmit={onSubmit} noValidate>
                <label className="block">
                  <span className="mb-2 block text-[12px] font-medium text-ink-200">ایمیل</span>
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
                  {emailInvalid && (
                    <p id={emailErrorId} className="mt-1.5 text-[11px] text-danger-400">
                      ایمیل معتبر وارد کنید.
                    </p>
                  )}
                </label>

                <label className="mt-4 block">
                  <span className="mb-2 block text-[12px] font-medium text-ink-200">گذرواژه</span>
                  <div className="relative">
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
                      className={cn(fieldCls, "pl-[52px]", passwordInvalid && invalidCls)}
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((v) => !v)}
                      aria-label={reveal ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                      aria-pressed={reveal}
                      disabled={pending}
                      className="absolute inset-y-0 left-0 flex w-[52px] items-center justify-center rounded-l-[18px] text-ink-400 transition-colors hover:text-gold-300 focus-visible:text-gold-300 focus-visible:outline-none disabled:opacity-40"
                    >
                      {reveal ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
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
                    className="mt-4 flex items-start gap-2.5 rounded-2xl border border-warn-500/25 bg-warn-500/[0.07] p-3.5 text-[12px] leading-relaxed text-ink-100"
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
                    className="mt-4 flex items-start gap-2.5 rounded-2xl border border-danger-500/25 bg-danger-500/[0.08] p-3.5 text-[12px] leading-relaxed text-ink-100"
                  >
                    <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-400" aria-hidden />
                    <span>{error.message}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={cn(
                    "group relative mt-6 flex h-[68px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[18px]",
                    "text-[14px] font-semibold text-[#1a1206] transition-all duration-300",
                    "bg-gradient-to-l from-[#D5AF58] via-[#F4D28B] to-[#D5AF58] bg-[length:200%_100%] bg-right",
                    "hover:bg-left hover:shadow-[0_14px_38px_-12px_rgba(213,175,88,0.55)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0E1018]",
                    "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none",
                  )}
                >
                  {pending ? (
                    <>
                      <span
                        className="size-4 animate-spin rounded-full border-2 border-[#1a1206]/25 border-t-[#1a1206]"
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

            {demo && <DemoPanel demoEnvironment={demoEnvironment} onPick={(nextEmail) => {
              setEmail(nextEmail);
              setPassword(DEMO_PASSPHRASE);
              clearError();
            }} />}
          </div>
        </section>
      </div>
    </main>
  );
}

const fieldCls =
  "h-[70px] w-full rounded-[18px] border border-white/[0.09] bg-white/[0.035] px-4 text-[14px] text-ink-50 " +
  "placeholder:text-ink-500 transition-all duration-200 " +
  "hover:border-white/[0.14] " +
  "focus:border-gold-500/45 focus:bg-white/[0.055] focus:outline-none focus:ring-[3px] focus:ring-gold-500/12 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const invalidCls = "border-danger-500/55 focus:border-danger-500/70 focus:ring-danger-500/15";

/** Minimal stage-light wordmark. Decorative, so hidden from assistive tech. */
function StageMark() {
  return (
    <span
      aria-hidden
      className="flex size-9 items-center justify-center rounded-xl border border-gold-500/25 bg-gradient-to-b from-gold-500/[0.16] to-transparent"
    >
      <span className="block h-3.5 w-px bg-gradient-to-b from-gold-300 to-transparent" />
      <span className="block h-2.5 w-px bg-gradient-to-b from-gold-400/70 to-transparent" />
      <span className="block h-4 w-px bg-gradient-to-b from-gold-300/85 to-transparent" />
    </span>
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
    <div className="mt-5 rounded-2xl border border-warn-500/[0.18] bg-warn-500/[0.045] p-4">
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
      <ul className="mt-3 space-y-0.5">
        {accounts.map((account) => (
          <li key={account.id}>
            <button
              type="button"
              onClick={() => onPick(account.email)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-right text-[11px] text-ink-200 transition-colors hover:bg-white/[0.055] focus-visible:bg-white/[0.055] focus-visible:outline-none"
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
