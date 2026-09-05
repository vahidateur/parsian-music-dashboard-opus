import { useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { academy } from "@/data/academy";
import { useAuth } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, listDemoAccounts } from "@/domains/auth/demoAuthRepository";
import { isDemoMode } from "@/api/config";
import { roleLabels } from "@/domains/auth/permissions";
import { Button, Surface } from "@/components/ds/primitives";
import { Field, inputCls } from "@/components/ds/patterns";
import { cn } from "@/utils/cn";

/** Login screen — RTL, keyboard-first, using the existing design language. */
export function LoginView() {
  const { login, pending, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [touched, setTouched] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const demo = isDemoMode();

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const emailInvalid = touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordInvalid = touched && password.length === 0;
  const canSubmit = !pending && email.trim().length > 0 && password.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (emailInvalid || password.length === 0 || !canSubmit) return;
    await login({ email: email.trim(), password });
  };

  const demoAccounts = listDemoAccounts();

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-ink-950 px-4 py-10 text-ink-50">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(900px 480px at 88% -10%, rgba(138,90,52,0.16), transparent 60%), radial-gradient(700px 400px at 10% 110%, rgba(110,91,184,0.08), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-6 text-center">
          <div className="text-[11px] font-medium text-gold-400">{academy.tagline}</div>
          <h1 className="mt-1.5 text-[20px] font-semibold text-ink-50">{academy.name}</h1>
          <p className="mt-1.5 text-[12px] text-ink-300">برای ادامه وارد حساب کاربری خود شوید.</p>
        </div>

        <Surface className="p-5">
          <form onSubmit={onSubmit} noValidate>
            <Field label="ایمیل">
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
                aria-invalid={emailInvalid || undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(inputCls, "text-left", emailInvalid && "border-danger-500/60")}
                placeholder="admin@demo.local"
              />
            </Field>
            {emailInvalid && <p className="mt-1 text-[11px] text-danger-400">ایمیل معتبر وارد کنید.</p>}

            <div className="mt-3.5">
              <Field label="گذرواژه">
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
                    aria-invalid={passwordInvalid || undefined}
                    aria-describedby={error ? errorId : undefined}
                    className={cn(inputCls, "pl-11 text-left", passwordInvalid && "border-danger-500/60")}
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((v) => !v)}
                    aria-label={reveal ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
                    aria-pressed={reveal}
                    className="absolute inset-y-0 left-0 flex w-11 items-center justify-center rounded-l-xl text-ink-400 transition-colors hover:text-ink-100 focus-visible:text-gold-400"
                  >
                    {reveal ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </Field>
              {passwordInvalid && <p className="mt-1 text-[11px] text-danger-400">گذرواژه را وارد کنید.</p>}
            </div>

            {error && (
              <div
                id={errorId}
                role="alert"
                className="mt-3.5 flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.07] p-3 text-[11.5px] leading-relaxed text-ink-100"
              >
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-danger-400" />
                <span>{error.message}</span>
              </div>
            )}

            <Button type="submit" variant="primary" disabled={!canSubmit} className="mt-4 w-full">
              {pending ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-ink-950/30 border-t-ink-950" aria-hidden />
                  در حال ورود…
                </>
              ) : (
                <>
                  <LogIn className="size-4" /> ورود
                </>
              )}
            </Button>
            <span aria-live="polite" className="sr-only">
              {pending ? "در حال احراز هویت" : ""}
            </span>
          </form>
        </Surface>

        {demo && (
          <Surface className="mt-4 border-warn-500/20 bg-warn-500/[0.05] p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-warn-400">
              <TriangleAlert className="size-3.5" /> محیط دمو — بدون امنیت واقعی
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-300">
              این ورود صرفاً نمایشی است و هیچ محافظت امنیتی ندارد. گذرواژهٔ همهٔ حساب‌های نمونه{" "}
              <code dir="ltr" className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-100">
                {DEMO_PASSPHRASE}
              </code>{" "}
              است.
            </p>
            <ul className="mt-2.5 space-y-1">
              {demoAccounts.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(DEMO_PASSPHRASE);
                      clearError();
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right text-[11px] text-ink-200 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
                  >
                    <span dir="ltr" className="truncate text-ink-300">
                      {u.email}
                    </span>
                    <span className="shrink-0 text-ink-400">{roleLabels[u.role]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </main>
  );
}
